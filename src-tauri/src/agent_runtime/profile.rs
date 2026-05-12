use sea_orm::DatabaseConnection;
use std::path::{Path, PathBuf};
use wisespace_core::repo::{agent_profile, agent_run, agent_session};
use wisespace_core::types::{AgentProfile, AgentSession};

fn default_workspace_root(conversation_id: &str) -> String {
    wisespace_core::storage_paths::conversation_workspace_dir(conversation_id)
        .to_string_lossy()
        .to_string()
}

fn legacy_workspace_root(conversation_id: &str) -> PathBuf {
    crate::paths::wisespace_home()
        .join("workspace")
        .join(conversation_id)
}

fn decode_workspace_root(path: &str) -> PathBuf {
    PathBuf::from(wisespace_core::path_vars::decode_path(path))
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| {
        format!(
            "Failed to create workspace directory '{}': {}",
            dst.display(),
            e
        )
    })?;
    for entry in std::fs::read_dir(src).map_err(|e| {
        format!(
            "Failed to read workspace directory '{}': {}",
            src.display(),
            e
        )
    })? {
        let entry = entry
            .map_err(|e| format!("Failed to read workspace entry '{}': {}", src.display(), e))?;
        let entry_path = entry.path();
        let target_path = dst.join(entry.file_name());
        let file_type = entry.file_type().map_err(|e| {
            format!(
                "Failed to inspect workspace entry '{}': {}",
                entry_path.display(),
                e
            )
        })?;
        if file_type.is_dir() {
            copy_dir_recursive(&entry_path, &target_path)?;
        } else {
            if let Some(parent) = target_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| {
                    format!(
                        "Failed to create workspace parent '{}': {}",
                        parent.display(),
                        e
                    )
                })?;
            }
            std::fs::copy(&entry_path, &target_path).map_err(|e| {
                format!(
                    "Failed to copy workspace entry '{}' to '{}': {}",
                    entry_path.display(),
                    target_path.display(),
                    e
                )
            })?;
        }
    }
    Ok(())
}

fn migrate_legacy_workspace_dir(conversation_id: &str) -> Result<String, String> {
    let old_dir = legacy_workspace_root(conversation_id);
    let new_dir = wisespace_core::storage_paths::conversation_workspace_dir(conversation_id);
    let workspace_root = wisespace_core::storage_paths::workspace_root();

    std::fs::create_dir_all(&workspace_root).map_err(|e| {
        format!(
            "Failed to create workspace root '{}': {}",
            workspace_root.display(),
            e
        )
    })?;

    if new_dir.exists() && !new_dir.is_dir() {
        return Err(format!(
            "Agent workspace target exists but is not a directory: {}",
            new_dir.display()
        ));
    }

    if old_dir.exists() {
        if !old_dir.is_dir() {
            return Err(format!(
                "Legacy agent workspace exists but is not a directory: {}",
                old_dir.display()
            ));
        }

        if !new_dir.exists() {
            match std::fs::rename(&old_dir, &new_dir) {
                Ok(_) => {}
                Err(_) => {
                    copy_dir_recursive(&old_dir, &new_dir)?;
                    std::fs::remove_dir_all(&old_dir).map_err(|e| {
                        format!(
                            "Failed to remove legacy workspace '{}' after copy: {}",
                            old_dir.display(),
                            e
                        )
                    })?;
                }
            }
        }
    }

    std::fs::create_dir_all(&new_dir).map_err(|e| {
        format!(
            "Failed to create agent workspace '{}': {}",
            new_dir.display(),
            e
        )
    })?;

    Ok(new_dir.to_string_lossy().to_string())
}

async fn ensure_profile_workspace_location(
    db: &DatabaseConnection,
    profile: AgentProfile,
) -> Result<AgentProfile, String> {
    let desired = default_workspace_root(&profile.conversation_id);
    let current = profile.workspace_root.clone().unwrap_or_default();

    if current.is_empty() {
        let updated = agent_profile::upsert_profile(
            db,
            &profile.conversation_id,
            Some(&desired),
            None,
            None,
            None,
            None,
        )
        .await
        .map_err(|e| e.to_string())?;
        let _ =
            agent_session::upsert_agent_session(db, &profile.conversation_id, Some(&desired), None)
                .await;
        return Ok(updated);
    }

    let current_path = decode_workspace_root(&current);
    let legacy_path = legacy_workspace_root(&profile.conversation_id);
    let desired_path = PathBuf::from(&desired);

    if current_path == legacy_path {
        let migrated = migrate_legacy_workspace_dir(&profile.conversation_id)?;
        let updated = agent_profile::upsert_profile(
            db,
            &profile.conversation_id,
            Some(&migrated),
            None,
            None,
            None,
            None,
        )
        .await
        .map_err(|e| e.to_string())?;
        let _ = agent_session::upsert_agent_session(
            db,
            &profile.conversation_id,
            Some(&migrated),
            None,
        )
        .await;
        return Ok(updated);
    }

    if current_path == desired_path {
        if current != desired {
            let updated = agent_profile::upsert_profile(
                db,
                &profile.conversation_id,
                Some(&desired),
                None,
                None,
                None,
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
            let _ = agent_session::upsert_agent_session(
                db,
                &profile.conversation_id,
                Some(&desired),
                None,
            )
            .await;
            return Ok(updated);
        }
        return Ok(profile);
    }

    Ok(profile)
}

pub async fn get_or_create_profile(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<AgentProfile, String> {
    if let Some(profile) = agent_profile::get_profile_by_conversation_id(db, conversation_id)
        .await
        .map_err(|e| e.to_string())?
    {
        return ensure_profile_workspace_location(db, profile).await;
    }

    if let Some(session) = agent_session::get_agent_session_by_conversation_id(db, conversation_id)
        .await
        .map_err(|e| e.to_string())?
    {
        let profile = agent_profile::ensure_profile_from_session(db, &session)
            .await
            .map_err(|e| e.to_string())?;
        return ensure_profile_workspace_location(db, profile).await;
    }

    let profile = agent_profile::upsert_profile(
        db,
        conversation_id,
        Some(&default_workspace_root(conversation_id)),
        Some("default"),
        Some("sdk"),
        None,
        None,
    )
    .await
    .map_err(|e| e.to_string())?;

    ensure_profile_workspace_location(db, profile).await
}

pub async fn list_profiles(db: &DatabaseConnection) -> Result<Vec<AgentProfile>, String> {
    agent_profile::list_profiles(db)
        .await
        .map_err(|e| e.to_string())
}

pub async fn update_profile_from_legacy_inputs(
    db: &DatabaseConnection,
    conversation_id: &str,
    cwd: Option<&str>,
    permission_mode: Option<&str>,
) -> Result<AgentProfile, String> {
    let profile =
        agent_profile::upsert_profile(db, conversation_id, cwd, permission_mode, None, None, None)
            .await
            .map_err(|e| e.to_string())?;

    let _ = agent_session::upsert_agent_session(db, conversation_id, cwd, permission_mode).await;
    Ok(profile)
}

pub async fn get_compat_session(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<Option<AgentSession>, String> {
    let profile = match get_or_create_profile(db, conversation_id).await {
        Ok(profile) => profile,
        Err(_) => return Ok(None),
    };

    let latest_run = agent_run::get_latest_run_for_conversation(db, conversation_id)
        .await
        .map_err(|e| e.to_string())?;
    let (total_tokens, total_cost_usd) =
        agent_run::aggregate_usage_for_conversation(db, conversation_id)
            .await
            .map_err(|e| e.to_string())?;

    let runtime_status = latest_run
        .as_ref()
        .map(|run| match run.status.as_str() {
            "queued" | "starting" | "running" => "running".to_string(),
            "waiting_approval" => "waiting_approval".to_string(),
            "waiting_input" => "waiting_approval".to_string(),
            "failed" => "error".to_string(),
            "completed" => "completed".to_string(),
            "cancelled" => "idle".to_string(),
            other => other.to_string(),
        })
        .unwrap_or_else(|| "idle".to_string());

    Ok(Some(AgentSession {
        id: profile.id.clone(),
        conversation_id: profile.conversation_id.clone(),
        cwd: profile.workspace_root.clone(),
        permission_mode: profile.permission_mode.clone(),
        runtime_status,
        sdk_context_json: latest_run
            .as_ref()
            .and_then(|run| run.sdk_context_json.clone()),
        sdk_context_backup_json: None,
        total_tokens: total_tokens.clamp(i32::MIN as i64, i32::MAX as i64) as i32,
        total_cost_usd,
        created_at: profile.created_at.clone(),
        updated_at: latest_run
            .as_ref()
            .map(|run| {
                run.finished_at
                    .clone()
                    .unwrap_or_else(|| run.started_at.clone())
            })
            .unwrap_or_else(|| profile.updated_at.clone()),
    }))
}

#[cfg(test)]
mod tests {
    use super::{default_workspace_root, get_or_create_profile, legacy_workspace_root};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_id(prefix: &str) -> String {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        format!("{}_{}_{}", prefix, std::process::id(), ts)
    }

    #[test]
    fn default_workspace_root_uses_documents_workspace_dir() {
        let root = default_workspace_root("conv-xyz");
        let expected = wisespace_core::storage_paths::conversation_workspace_dir("conv-xyz")
            .to_string_lossy()
            .to_string();
        assert_eq!(root, expected);
    }

    #[tokio::test]
    async fn get_or_create_profile_migrates_legacy_workspace_to_documents_root() {
        let pool = wisespace_core::db::create_test_pool().await.unwrap();
        let db = pool.conn;
        let docs_root = std::env::temp_dir().join(unique_id("wisespace_docs_root"));
        let conversation_id = unique_id("conv");
        let old_workspace = legacy_workspace_root(&conversation_id);

        let _ = std::fs::remove_dir_all(&docs_root);
        let _ = std::fs::remove_dir_all(&old_workspace);

        wisespace_core::storage_paths::set_documents_root(docs_root.clone());
        let new_workspace =
            wisespace_core::storage_paths::conversation_workspace_dir(&conversation_id);
        let _ = std::fs::remove_dir_all(&new_workspace);
        std::fs::create_dir_all(&old_workspace).unwrap();
        std::fs::write(old_workspace.join("hello.txt"), "hello").unwrap();

        let old_workspace_str = old_workspace.to_string_lossy().to_string();
        wisespace_core::repo::agent_profile::upsert_profile(
            &db,
            &conversation_id,
            Some(&old_workspace_str),
            Some("default"),
            Some("sdk"),
            None,
            None,
        )
        .await
        .unwrap();

        let profile = get_or_create_profile(&db, &conversation_id).await.unwrap();

        assert_eq!(
            profile.workspace_root.as_deref(),
            Some(new_workspace.to_string_lossy().as_ref())
        );
        assert!(new_workspace.exists());
        assert!(new_workspace.join("hello.txt").exists());
        assert!(!old_workspace.exists());

        wisespace_core::storage_paths::clear_documents_root_override();
        let _ = std::fs::remove_dir_all(&docs_root);
        let _ = std::fs::remove_dir_all(&old_workspace);
        let _ = std::fs::remove_dir_all(&new_workspace);
    }
}
