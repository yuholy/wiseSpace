use sea_orm::*;

use crate::entity::{
    agent_profiles, agent_runs, agent_sessions, agent_tasks, conversations, stored_files,
    workspace_knowledge_bindings, workspace_mcp_bindings, workspace_memory_bindings, workspaces,
};
use crate::error::{Result, WiseSpaceError};
use crate::types::Workspace;
use crate::utils::{gen_id, now_ts};

fn workspace_from_model(model: workspaces::Model) -> Workspace {
    Workspace {
        id: model.id,
        slug: model.slug,
        name: model.name,
        root_path: model.root_path,
        source: model.source,
        description: model.description,
        created_at: model.created_at,
        updated_at: model.updated_at,
    }
}

fn workspace_name_from_title(title: &str) -> String {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        "Untitled Workspace".to_string()
    } else {
        trimmed.to_string()
    }
}

fn managed_workspace_root_path(title: &str, conversation_id: &str) -> String {
    let path = if title.trim().is_empty() {
        crate::storage_paths::conversation_workspace_dir(conversation_id)
    } else {
        crate::storage_paths::titled_conversation_workspace_dir(title, conversation_id)
    };
    path.to_string_lossy().to_string()
}

pub async fn get_workspace(db: &DatabaseConnection, id: &str) -> Result<Workspace> {
    let model = workspaces::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Workspace {}", id)))?;
    Ok(workspace_from_model(model))
}

pub async fn list_workspaces(db: &DatabaseConnection) -> Result<Vec<Workspace>> {
    let rows = workspaces::Entity::find()
        .order_by_desc(workspaces::Column::UpdatedAt)
        .all(db)
        .await?;
    Ok(rows.into_iter().map(workspace_from_model).collect())
}

pub async fn rename_workspace(
    db: &DatabaseConnection,
    workspace_id: &str,
    name: &str,
) -> Result<Workspace> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(WiseSpaceError::Validation(
            "Workspace name cannot be empty".to_string(),
        ));
    }

    let model = workspaces::Entity::find_by_id(workspace_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Workspace {}", workspace_id)))?;

    let mut am: workspaces::ActiveModel = model.into();
    am.name = Set(trimmed.to_string());
    am.slug = Set(crate::storage_paths::workspace_dir_name_from_title(
        trimmed,
        workspace_id,
    ));
    // A user rename should take precedence over future conversation-title sync.
    am.source = Set("manual".to_string());
    am.updated_at = Set(chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string());
    let updated = am.update(db).await?;
    Ok(workspace_from_model(updated))
}

pub async fn get_workspace_by_conversation_id(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<Option<Workspace>> {
    let Some(conversation) = conversations::Entity::find_by_id(conversation_id).one(db).await? else {
        return Ok(None);
    };

    let Some(workspace_id) = conversation.workspace_id else {
        return Ok(None);
    };

    let workspace = workspaces::Entity::find_by_id(workspace_id).one(db).await?;
    Ok(workspace.map(workspace_from_model))
}

pub async fn attach_conversation_to_workspace(
    db: &DatabaseConnection,
    conversation_id: &str,
    workspace_id: &str,
) -> Result<Workspace> {
    let workspace = workspaces::Entity::find_by_id(workspace_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Workspace {}", workspace_id)))?;

    let conversation = conversations::Entity::find_by_id(conversation_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", conversation_id)))?;

    let mut am: conversations::ActiveModel = conversation.into();
    am.workspace_id = Set(Some(workspace_id.to_string()));
    am.updated_at = Set(now_ts());
    am.update(db).await?;

    propagate_workspace_id_for_conversation(db, conversation_id, workspace_id).await?;
    Ok(workspace_from_model(workspace))
}

pub async fn ensure_workspace_identity_for_conversation(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<Workspace> {
    let workspace = ensure_canonical_workspace_for_conversation(db, conversation_id).await?;
    propagate_workspace_id_for_conversation(db, conversation_id, &workspace.id).await?;
    Ok(workspace)
}

pub async fn ensure_workspace_identity_backfilled(db: &DatabaseConnection) -> Result<()> {
    let conversation_ids = conversations::Entity::find()
        .select_only()
        .column(conversations::Column::Id)
        .into_tuple::<String>()
        .all(db)
        .await?;

    for conversation_id in conversation_ids {
        let _ = ensure_workspace_identity_for_conversation(db, &conversation_id).await?;
    }

    Ok(())
}

pub async fn ensure_canonical_workspace_for_conversation(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<Workspace> {
    let conversation = conversations::Entity::find_by_id(conversation_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", conversation_id)))?;

    if let Some(workspace_id) = conversation.workspace_id.clone() {
        if let Some(existing) = workspaces::Entity::find_by_id(&workspace_id).one(db).await? {
            return Ok(workspace_from_model(existing));
        }
    }

    let name = workspace_name_from_title(&conversation.title);
    let slug = crate::storage_paths::workspace_dir_name_from_title(&name, conversation_id);
    let root_path = managed_workspace_root_path(&conversation.title, conversation_id);
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let workspace_id = gen_id();

    let workspace = workspaces::ActiveModel {
        id: Set(workspace_id.clone()),
        slug: Set(slug),
        name: Set(name),
        root_path: Set(root_path),
        source: Set("conversation".to_string()),
        description: Set(None),
        created_at: Set(now.clone()),
        updated_at: Set(now.clone()),
    }
    .insert(db)
    .await?;

    let mut conversation_am: conversations::ActiveModel = conversation.into();
    conversation_am.workspace_id = Set(Some(workspace_id));
    conversation_am.updated_at = Set(now_ts());
    conversation_am.update(db).await?;

    Ok(workspace_from_model(workspace))
}

pub async fn sync_workspace_metadata_from_conversation(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<Option<Workspace>> {
    let workspace = ensure_canonical_workspace_for_conversation(db, conversation_id).await?;
    let workspace_model = workspaces::Entity::find_by_id(&workspace.id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Workspace {}", workspace.id)))?;
    if workspace_model.source != "conversation" {
        return Ok(Some(workspace_from_model(workspace_model)));
    }

    let workspace_usage_count = conversations::Entity::find()
        .filter(conversations::Column::WorkspaceId.eq(&workspace.id))
        .count(db)
        .await?;
    if workspace_usage_count > 1 {
        return Ok(Some(workspace_from_model(workspace_model)));
    }

    let conversation = conversations::Entity::find_by_id(conversation_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", conversation_id)))?;

    let next_name = workspace_name_from_title(&conversation.title);
    let next_slug = crate::storage_paths::workspace_dir_name_from_title(&next_name, conversation_id);
    let next_root_path = managed_workspace_root_path(&conversation.title, conversation_id);

    let mut am: workspaces::ActiveModel = workspace_model.into();
    am.name = Set(next_name);
    am.slug = Set(next_slug);
    am.root_path = Set(next_root_path);
    am.updated_at = Set(chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string());
    let updated = am.update(db).await?;
    Ok(Some(workspace_from_model(updated)))
}

pub async fn sync_workspace_bindings_from_conversation(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<()> {
    let conversation = conversations::Entity::find_by_id(conversation_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", conversation_id)))?;
    let workspace = ensure_canonical_workspace_for_conversation(db, conversation_id).await?;

    let mcp_ids: Vec<String> = serde_json::from_str(&conversation.enabled_mcp_server_ids)
        .expect("conversation enabled_mcp_server_ids JSON is invalid");
    let knowledge_ids: Vec<String> = serde_json::from_str(&conversation.enabled_knowledge_base_ids)
        .expect("conversation enabled_knowledge_base_ids JSON is invalid");
    let memory_ids: Vec<String> = serde_json::from_str(&conversation.enabled_memory_namespace_ids)
        .expect("conversation enabled_memory_namespace_ids JSON is invalid");

    replace_workspace_mcp_bindings(db, &workspace.id, &mcp_ids).await?;
    replace_workspace_knowledge_bindings(db, &workspace.id, &knowledge_ids).await?;
    replace_workspace_memory_bindings(db, &workspace.id, &memory_ids).await?;
    Ok(())
}

pub async fn resolve_effective_binding_ids(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<(Vec<String>, Vec<String>, Vec<String>)> {
    let conversation = conversations::Entity::find_by_id(conversation_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", conversation_id)))?;

    let fallback_mcp: Vec<String> = serde_json::from_str(&conversation.enabled_mcp_server_ids)
        .expect("conversation enabled_mcp_server_ids JSON is invalid");
    let fallback_knowledge: Vec<String> =
        serde_json::from_str(&conversation.enabled_knowledge_base_ids)
            .expect("conversation enabled_knowledge_base_ids JSON is invalid");
    let fallback_memory: Vec<String> =
        serde_json::from_str(&conversation.enabled_memory_namespace_ids)
            .expect("conversation enabled_memory_namespace_ids JSON is invalid");

    let Some(workspace_id) = conversation.workspace_id else {
        return Ok((fallback_mcp, fallback_knowledge, fallback_memory));
    };

    let workspace_mcp = list_workspace_mcp_bindings(db, &workspace_id).await?;
    let workspace_knowledge = list_workspace_knowledge_bindings(db, &workspace_id).await?;
    let workspace_memory = list_workspace_memory_bindings(db, &workspace_id).await?;

    Ok((
        if workspace_mcp.is_empty() {
            fallback_mcp
        } else {
            workspace_mcp
        },
        if workspace_knowledge.is_empty() {
            fallback_knowledge
        } else {
            workspace_knowledge
        },
        if workspace_memory.is_empty() {
            fallback_memory
        } else {
            workspace_memory
        },
    ))
}

pub async fn list_workspace_mcp_bindings(
    db: &DatabaseConnection,
    workspace_id: &str,
) -> Result<Vec<String>> {
    let rows = workspace_mcp_bindings::Entity::find()
        .filter(workspace_mcp_bindings::Column::WorkspaceId.eq(workspace_id))
        .filter(workspace_mcp_bindings::Column::Enabled.eq(1))
        .order_by_asc(workspace_mcp_bindings::Column::SortOrder)
        .order_by_asc(workspace_mcp_bindings::Column::CreatedAt)
        .all(db)
        .await?;
    Ok(rows.into_iter().map(|row| row.server_id).collect())
}

pub async fn list_workspace_knowledge_bindings(
    db: &DatabaseConnection,
    workspace_id: &str,
) -> Result<Vec<String>> {
    let rows = workspace_knowledge_bindings::Entity::find()
        .filter(workspace_knowledge_bindings::Column::WorkspaceId.eq(workspace_id))
        .filter(workspace_knowledge_bindings::Column::Enabled.eq(1))
        .order_by_asc(workspace_knowledge_bindings::Column::SortOrder)
        .order_by_asc(workspace_knowledge_bindings::Column::CreatedAt)
        .all(db)
        .await?;
    Ok(rows.into_iter().map(|row| row.knowledge_base_id).collect())
}

pub async fn list_workspace_memory_bindings(
    db: &DatabaseConnection,
    workspace_id: &str,
) -> Result<Vec<String>> {
    let rows = workspace_memory_bindings::Entity::find()
        .filter(workspace_memory_bindings::Column::WorkspaceId.eq(workspace_id))
        .filter(workspace_memory_bindings::Column::Enabled.eq(1))
        .order_by_asc(workspace_memory_bindings::Column::SortOrder)
        .order_by_asc(workspace_memory_bindings::Column::CreatedAt)
        .all(db)
        .await?;
    Ok(rows.into_iter().map(|row| row.memory_namespace_id).collect())
}

async fn replace_workspace_mcp_bindings(
    db: &DatabaseConnection,
    workspace_id: &str,
    server_ids: &[String],
) -> Result<()> {
    workspace_mcp_bindings::Entity::delete_many()
        .filter(workspace_mcp_bindings::Column::WorkspaceId.eq(workspace_id))
        .exec(db)
        .await?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    for (sort_order, server_id) in server_ids.iter().enumerate() {
        workspace_mcp_bindings::ActiveModel {
            id: Set(gen_id()),
            workspace_id: Set(workspace_id.to_string()),
            server_id: Set(server_id.clone()),
            enabled: Set(1),
            sort_order: Set(sort_order as i32),
            created_at: Set(now.clone()),
            updated_at: Set(now.clone()),
        }
        .insert(db)
        .await?;
    }

    Ok(())
}

async fn replace_workspace_knowledge_bindings(
    db: &DatabaseConnection,
    workspace_id: &str,
    knowledge_base_ids: &[String],
) -> Result<()> {
    workspace_knowledge_bindings::Entity::delete_many()
        .filter(workspace_knowledge_bindings::Column::WorkspaceId.eq(workspace_id))
        .exec(db)
        .await?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    for (sort_order, knowledge_base_id) in knowledge_base_ids.iter().enumerate() {
        workspace_knowledge_bindings::ActiveModel {
            id: Set(gen_id()),
            workspace_id: Set(workspace_id.to_string()),
            knowledge_base_id: Set(knowledge_base_id.clone()),
            enabled: Set(1),
            sort_order: Set(sort_order as i32),
            created_at: Set(now.clone()),
            updated_at: Set(now.clone()),
        }
        .insert(db)
        .await?;
    }

    Ok(())
}

async fn replace_workspace_memory_bindings(
    db: &DatabaseConnection,
    workspace_id: &str,
    memory_namespace_ids: &[String],
) -> Result<()> {
    workspace_memory_bindings::Entity::delete_many()
        .filter(workspace_memory_bindings::Column::WorkspaceId.eq(workspace_id))
        .exec(db)
        .await?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    for (sort_order, memory_namespace_id) in memory_namespace_ids.iter().enumerate() {
        workspace_memory_bindings::ActiveModel {
            id: Set(gen_id()),
            workspace_id: Set(workspace_id.to_string()),
            memory_namespace_id: Set(memory_namespace_id.clone()),
            enabled: Set(1),
            sort_order: Set(sort_order as i32),
            created_at: Set(now.clone()),
            updated_at: Set(now.clone()),
        }
        .insert(db)
        .await?;
    }

    Ok(())
}

async fn propagate_workspace_id_for_conversation(
    db: &DatabaseConnection,
    conversation_id: &str,
    workspace_id: &str,
) -> Result<()> {
    let profile_rows = agent_profiles::Entity::find()
        .filter(agent_profiles::Column::ConversationId.eq(conversation_id))
        .all(db)
        .await?;
    for row in profile_rows {
        if row.workspace_id.as_deref() == Some(workspace_id) {
            continue;
        }
        let mut am: agent_profiles::ActiveModel = row.into();
        am.workspace_id = Set(Some(workspace_id.to_string()));
        am.updated_at = Set(chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string());
        am.update(db).await?;
    }

    let run_rows = agent_runs::Entity::find()
        .filter(agent_runs::Column::ConversationId.eq(conversation_id))
        .all(db)
        .await?;
    for row in run_rows {
        if row.workspace_id.as_deref() == Some(workspace_id) {
            continue;
        }
        let mut am: agent_runs::ActiveModel = row.into();
        am.workspace_id = Set(Some(workspace_id.to_string()));
        am.update(db).await?;
    }

    let session_rows = agent_sessions::Entity::find()
        .filter(agent_sessions::Column::ConversationId.eq(conversation_id))
        .all(db)
        .await?;
    for row in session_rows {
        if row.workspace_id.as_deref() == Some(workspace_id) {
            continue;
        }
        let mut am: agent_sessions::ActiveModel = row.into();
        am.workspace_id = Set(Some(workspace_id.to_string()));
        am.updated_at = Set(chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string());
        am.update(db).await?;
    }

    let task_rows = agent_tasks::Entity::find()
        .filter(agent_tasks::Column::ConversationId.eq(conversation_id))
        .all(db)
        .await?;
    for row in task_rows {
        if row.workspace_id.as_deref() == Some(workspace_id) {
            continue;
        }
        let mut am: agent_tasks::ActiveModel = row.into();
        am.workspace_id = Set(Some(workspace_id.to_string()));
        am.updated_at = Set(now_ts());
        am.update(db).await?;
    }

    let file_rows = stored_files::Entity::find()
        .filter(stored_files::Column::ConversationId.eq(conversation_id))
        .all(db)
        .await?;
    for row in file_rows {
        if row.workspace_id.as_deref() == Some(workspace_id) {
            continue;
        }
        let mut am: stored_files::ActiveModel = row.into();
        am.workspace_id = Set(Some(workspace_id.to_string()));
        am.update(db).await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::create_test_pool;

    #[tokio::test]
    async fn ensure_workspace_identity_backfilled_propagates_related_workspace_ids() {
        let db = create_test_pool().await.unwrap().conn;
        let now = now_ts();
        let now_text = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        crate::entity::external_agents::ActiveModel {
            id: Set("external-agent-1".to_string()),
            name: Set("External Agent".to_string()),
            kind: Set("generic_http".to_string()),
            base_url: Set(None),
            auth_type: Set("none".to_string()),
            auth_config_json: Set(None),
            capabilities_json: Set("{}".to_string()),
            enabled: Set(1),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&db)
        .await
        .unwrap();

        conversations::ActiveModel {
            id: Set("conv-backfill".to_string()),
            title: Set("Backfill Conversation".to_string()),
            model_id: Set("model-1".to_string()),
            provider_id: Set("provider-1".to_string()),
            system_prompt: Set(None),
            temperature: Set(None),
            max_tokens: Set(None),
            top_p: Set(None),
            frequency_penalty: Set(None),
            search_enabled: Set(0),
            search_provider_id: Set(None),
            thinking_budget: Set(None),
            thinking_level: Set(None),
            enabled_mcp_server_ids: Set("[]".to_string()),
            enabled_knowledge_base_ids: Set("[]".to_string()),
            enabled_memory_namespace_ids: Set("[]".to_string()),
            message_count: Set(0),
            is_pinned: Set(0),
            is_archived: Set(0),
            workspace_snapshot_json: Set(String::new()),
            workspace_id: Set(None),
            active_branch_id: Set(None),
            active_artifact_id: Set(None),
            research_mode: Set(0),
            context_compression: Set(0),
            category_id: Set(None),
            parent_conversation_id: Set(None),
            mode: Set("chat".to_string()),
            source: Set("chat".to_string()),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&db)
        .await
        .unwrap();

        agent_profiles::ActiveModel {
            id: Set("profile-backfill".to_string()),
            conversation_id: Set("conv-backfill".to_string()),
            workspace_id: Set(None),
            workspace_root: Set(None),
            permission_mode: Set("default".to_string()),
            default_runner_kind: Set("sdk".to_string()),
            default_provider_id: Set(None),
            default_model_id: Set(None),
            created_at: Set(now_text.clone()),
            updated_at: Set(now_text.clone()),
        }
        .insert(&db)
        .await
        .unwrap();

        agent_runs::ActiveModel {
            id: Set("run-backfill".to_string()),
            conversation_id: Set("conv-backfill".to_string()),
            workspace_id: Set(None),
            profile_id: Set("profile-backfill".to_string()),
            runner_kind: Set("sdk".to_string()),
            provider_id: Set(None),
            model_id: Set(None),
            status: Set("completed".to_string()),
            prompt_snapshot: Set(String::new()),
            sdk_context_json: Set(None),
            workspace_root: Set(None),
            started_at: Set(now_text.clone()),
            finished_at: Set(None),
            error_summary: Set(None),
            token_usage_json: Set(None),
            cost_usd: Set(0.0),
            resume_capability: Set("none".to_string()),
            interrupted_reason: Set(None),
            resume_token_json: Set(None),
        }
        .insert(&db)
        .await
        .unwrap();

        agent_sessions::ActiveModel {
            id: Set("session-backfill".to_string()),
            conversation_id: Set("conv-backfill".to_string()),
            workspace_id: Set(None),
            cwd: Set(None),
            permission_mode: Set("default".to_string()),
            runtime_status: Set("idle".to_string()),
            sdk_context_json: Set(None),
            sdk_context_backup_json: Set(None),
            total_tokens: Set(0),
            total_cost_usd: Set(0.0),
            created_at: Set(now_text.clone()),
            updated_at: Set(now_text.clone()),
        }
        .insert(&db)
        .await
        .unwrap();

        agent_tasks::ActiveModel {
            id: Set("task-backfill".to_string()),
            conversation_id: Set(Some("conv-backfill".to_string())),
            workspace_id: Set(None),
            source_message_id: Set(None),
            external_agent_id: Set("external-agent-1".to_string()),
            external_task_id: Set(None),
            kind: Set("generic".to_string()),
            status: Set("queued".to_string()),
            title: Set("Task".to_string()),
            request_payload_json: Set("{}".to_string()),
            result_payload_json: Set(None),
            error_message: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&db)
        .await
        .unwrap();

        stored_files::ActiveModel {
            id: Set("file-backfill".to_string()),
            hash: Set("hash".to_string()),
            original_name: Set("file.txt".to_string()),
            mime_type: Set("text/plain".to_string()),
            size_bytes: Set(4),
            storage_path: Set("files/file.txt".to_string()),
            conversation_id: Set(Some("conv-backfill".to_string())),
            workspace_id: Set(None),
            created_at: Set(now_text.clone()),
        }
        .insert(&db)
        .await
        .unwrap();

        ensure_workspace_identity_backfilled(&db).await.unwrap();

        let conversation = conversations::Entity::find_by_id("conv-backfill")
            .one(&db)
            .await
            .unwrap()
            .unwrap();
        let workspace_id = conversation.workspace_id.expect("workspace id backfilled");
        assert!(!workspace_id.is_empty());

        assert_eq!(
            agent_profiles::Entity::find_by_id("profile-backfill")
                .one(&db)
                .await
                .unwrap()
                .unwrap()
                .workspace_id
                .as_deref(),
            Some(workspace_id.as_str())
        );
        assert_eq!(
            agent_runs::Entity::find_by_id("run-backfill")
                .one(&db)
                .await
                .unwrap()
                .unwrap()
                .workspace_id
                .as_deref(),
            Some(workspace_id.as_str())
        );
        assert_eq!(
            agent_sessions::Entity::find_by_id("session-backfill")
                .one(&db)
                .await
                .unwrap()
                .unwrap()
                .workspace_id
                .as_deref(),
            Some(workspace_id.as_str())
        );
        assert_eq!(
            agent_tasks::Entity::find_by_id("task-backfill")
                .one(&db)
                .await
                .unwrap()
                .unwrap()
                .workspace_id
                .as_deref(),
            Some(workspace_id.as_str())
        );
        assert_eq!(
            stored_files::Entity::find_by_id("file-backfill")
                .one(&db)
                .await
                .unwrap()
                .unwrap()
                .workspace_id
                .as_deref(),
            Some(workspace_id.as_str())
        );
    }

    #[tokio::test]
    async fn manual_or_shared_workspaces_do_not_get_renamed_from_conversation_titles() {
        let db = create_test_pool().await.unwrap().conn;

        let conversation_a = crate::repo::conversation::create_conversation(
            &db,
            "Alpha Workspace",
            "model-1",
            "provider-1",
            None,
        )
        .await
        .unwrap();
        let conversation_b = crate::repo::conversation::create_conversation(
            &db,
            "Beta Workspace",
            "model-1",
            "provider-1",
            None,
        )
        .await
        .unwrap();

        let workspace_a = get_workspace_by_conversation_id(&db, &conversation_a.id)
            .await
            .unwrap()
            .unwrap();

        let renamed = rename_workspace(&db, &workspace_a.id, "Manual Workspace")
            .await
            .unwrap();
        assert_eq!(renamed.name, "Manual Workspace");
        assert_eq!(renamed.source, "manual");

        crate::repo::conversation::update_conversation(
            &db,
            &conversation_a.id,
            crate::types::UpdateConversationInput {
                title: Some("Alpha Renamed".to_string()),
                provider_id: None,
                model_id: None,
                is_pinned: None,
                is_archived: None,
                system_prompt: None,
                temperature: None,
                max_tokens: None,
                top_p: None,
                frequency_penalty: None,
                search_enabled: None,
                search_provider_id: None,
                thinking_budget: None,
                thinking_level: None,
                enabled_mcp_server_ids: None,
                enabled_knowledge_base_ids: None,
                enabled_memory_namespace_ids: None,
                context_compression: None,
                category_id: None,
                parent_conversation_id: None,
                mode: None,
                source: None,
            },
        )
        .await
        .unwrap();

        let after_manual_title_change = get_workspace(&db, &workspace_a.id).await.unwrap();
        assert_eq!(after_manual_title_change.name, "Manual Workspace");

        attach_conversation_to_workspace(&db, &conversation_b.id, &workspace_a.id)
            .await
            .unwrap();

        crate::repo::conversation::update_conversation(
            &db,
            &conversation_b.id,
            crate::types::UpdateConversationInput {
                title: Some("Beta Renamed".to_string()),
                provider_id: None,
                model_id: None,
                is_pinned: None,
                is_archived: None,
                system_prompt: None,
                temperature: None,
                max_tokens: None,
                top_p: None,
                frequency_penalty: None,
                search_enabled: None,
                search_provider_id: None,
                thinking_budget: None,
                thinking_level: None,
                enabled_mcp_server_ids: None,
                enabled_knowledge_base_ids: None,
                enabled_memory_namespace_ids: None,
                context_compression: None,
                category_id: None,
                parent_conversation_id: None,
                mode: None,
                source: None,
            },
        )
        .await
        .unwrap();

        let shared_workspace = get_workspace(&db, &workspace_a.id).await.unwrap();
        assert_eq!(shared_workspace.name, "Manual Workspace");
        assert_eq!(
            get_workspace_by_conversation_id(&db, &conversation_b.id)
                .await
                .unwrap()
                .unwrap()
                .id,
            workspace_a.id
        );
    }
}
