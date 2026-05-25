use crate::agent_runtime::compat::{ensure_legacy_session_for_profile, RUNNING_AGENTS};
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
use wisespace_core::repo::{agent_profile, agent_run, agent_session, conversation};
use wisespace_core::types::{
    AgentProfile, AgentRun, AgentRunEvent, AgentSession, AgentTask, AttachmentInput, Conversation,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProfileUpdateInput {
    pub conversation_id: String,
    pub workspace_root: Option<String>,
    pub permission_mode: Option<String>,
    pub default_runner_kind: Option<String>,
    pub default_provider_id: Option<String>,
    pub default_model_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStartRunInput {
    pub conversation_id: String,
    pub prompt: String,
    #[serde(default)]
    pub attachments: Vec<AttachmentInput>,
    pub runner_kind: Option<String>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub cwd: Option<String>,
    pub permission_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentControlRunInput {
    pub run_id: String,
    pub action: String,
    pub target_id: Option<String>,
    pub value: Option<String>,
    pub conversation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskCenterItem {
    pub run_id: String,
    pub conversation_id: String,
    pub conversation_title: String,
    pub conversation_source: String,
    pub status: String,
    pub resume_capability: String,
    pub interrupted_reason: Option<String>,
    pub prompt_preview: String,
    pub workspace_root: Option<String>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error_summary: Option<String>,
    pub last_event_type: Option<String>,
    pub last_event_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskCenterDetail {
    pub item: TaskCenterItem,
    pub conversation: Conversation,
    pub run: AgentRun,
    pub events: Vec<AgentRunEvent>,
    pub delegated_tasks: Vec<AgentTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskFromCenterInput {
    pub prompt: String,
    pub provider_id: String,
    pub model_id: String,
    pub title: Option<String>,
    pub workspace_root: Option<String>,
    pub permission_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskFromCenterResult {
    pub conversation: Conversation,
    pub run: Option<AgentRun>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentRunLifecyclePayload {
    conversation_id: String,
    run_id: String,
    status: Option<String>,
    resume_capability: Option<String>,
    interrupted_reason: Option<String>,
    message: Option<String>,
}

fn runner_kind_from_legacy(executor: &str) -> crate::agent_runtime::runner::AgentRunnerKind {
    crate::agent_runtime::runner::AgentRunnerKind::from_str(executor)
}

fn ensure_agent_workspace_dir(workspace_root: &str) -> Result<String, String> {
    let workspace_dir = std::path::PathBuf::from(workspace_root);
    std::fs::create_dir_all(&workspace_dir)
        .map_err(|e| format!("Failed to create workspace: {}", e))?;
    workspace_dir
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path encoding".to_string())
}

fn task_prompt_preview(prompt: &str) -> String {
    let value = prompt.trim();
    if value.chars().count() > 120 {
        format!("{}...", value.chars().take(120).collect::<String>())
    } else {
        value.to_string()
    }
}

async fn build_task_center_item(
    db: &sea_orm::DatabaseConnection,
    run: &AgentRun,
) -> Result<TaskCenterItem, String> {
    let conv = conversation::get_conversation(db, &run.conversation_id)
        .await
        .map_err(|e| e.to_string())?;
    let last_event = agent_run::list_run_events(db, &run.id)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .last();

    Ok(TaskCenterItem {
        run_id: run.id.clone(),
        conversation_id: run.conversation_id.clone(),
        conversation_title: conv.title,
        conversation_source: conv.source,
        status: run.status.clone(),
        resume_capability: run.resume_capability.clone(),
        interrupted_reason: run.interrupted_reason.clone(),
        prompt_preview: task_prompt_preview(&run.prompt_snapshot),
        workspace_root: run.workspace_root.clone(),
        provider_id: run.provider_id.clone(),
        model_id: run.model_id.clone(),
        started_at: run.started_at.clone(),
        finished_at: run.finished_at.clone(),
        error_summary: run.error_summary.clone(),
        last_event_type: last_event.as_ref().map(|event| event.event_type.clone()),
        last_event_at: last_event.map(|event| event.created_at),
    })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn agent_get_profile(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<AgentProfile, String> {
    crate::agent_runtime::profile::get_or_create_profile(&state.sea_db, &conversation_id).await
}

#[tauri::command]
pub async fn agent_update_profile(
    state: State<'_, AppState>,
    input: AgentProfileUpdateInput,
) -> Result<AgentProfile, String> {
    let profile = agent_profile::upsert_profile(
        &state.sea_db,
        &input.conversation_id,
        input.workspace_root.as_deref(),
        input.permission_mode.as_deref(),
        input.default_runner_kind.as_deref(),
        input.default_provider_id.as_deref(),
        input.default_model_id.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;

    let _ = ensure_legacy_session_for_profile(&state.sea_db, &profile).await;
    Ok(profile)
}

#[tauri::command]
pub async fn agent_start_run(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: AgentStartRunInput,
) -> Result<(), String> {
    match runner_kind_from_legacy(input.runner_kind.as_deref().unwrap_or("sdk")) {
        crate::agent_runtime::runner::AgentRunnerKind::Sdk => {
            let provider_id = input
                .provider_id
                .ok_or("providerId is required for sdk runner".to_string())?;
            let model_id = input
                .model_id
                .ok_or("modelId is required for sdk runner".to_string())?;

            crate::agent_runtime::sdk_runner::start_sdk_run(
                app,
                &state,
                crate::agent_runtime::sdk_runner::StartSdkRunInput {
                    conversation_id: input.conversation_id,
                    prompt: input.prompt,
                    attachments: input.attachments,
                    provider_id,
                    model_id,
                    cwd: input.cwd,
                    permission_mode: input.permission_mode,
                },
            )
            .await
        }
        crate::agent_runtime::runner::AgentRunnerKind::DeepseekTui => {
            crate::agent_runtime::deepseek_tui_runner::start_deepseek_tui_run(
                app,
                &state,
                crate::agent_runtime::deepseek_tui_runner::StartDeepseekTuiRunInput {
                    conversation_id: input.conversation_id,
                    prompt: input.prompt,
                    attachments: input.attachments,
                    model_id: input.model_id,
                    cwd: input.cwd,
                    permission_mode: input.permission_mode,
                    resume_context_json: None,
                },
            )
            .await
        }
    }
}

#[tauri::command]
pub async fn agent_get_run(
    state: State<'_, AppState>,
    run_id: String,
) -> Result<Option<AgentRun>, String> {
    agent_run::get_run(&state.sea_db, &run_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn agent_list_runs(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<AgentRun>, String> {
    agent_run::list_runs_for_conversation(&state.sea_db, &conversation_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn agent_list_run_events(
    state: State<'_, AppState>,
    run_id: String,
) -> Result<Vec<AgentRunEvent>, String> {
    agent_run::list_run_events(&state.sea_db, &run_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_agent_runs_global(
    state: State<'_, AppState>,
) -> Result<Vec<TaskCenterItem>, String> {
    let runs = agent_run::list_all_runs(&state.sea_db)
        .await
        .map_err(|e| e.to_string())?;
    let mut items = Vec::with_capacity(runs.len());
    for run in runs {
        match build_task_center_item(&state.sea_db, &run).await {
            Ok(item) => items.push(item),
            Err(err) => tracing::warn!("[agent] Failed to build task center item: {}", err),
        }
    }
    Ok(items)
}

#[tauri::command]
pub async fn get_agent_run_detail(
    state: State<'_, AppState>,
    run_id: String,
) -> Result<TaskCenterDetail, String> {
    let run = agent_run::get_run(&state.sea_db, &run_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Agent run not found".to_string())?;
    let conversation = conversation::get_conversation(&state.sea_db, &run.conversation_id)
        .await
        .map_err(|e| e.to_string())?;
    let events = agent_run::list_run_events(&state.sea_db, &run_id)
        .await
        .map_err(|e| e.to_string())?;
    let delegated_tasks =
        wisespace_core::repo::external_agent::list_delegated_tasks_for_run(&state.sea_db, &run_id)
            .await
            .map_err(|e| e.to_string())?;
    let item = build_task_center_item(&state.sea_db, &run).await?;

    Ok(TaskCenterDetail {
        item,
        conversation,
        run,
        events,
        delegated_tasks,
    })
}

#[tauri::command]
pub async fn delete_agent_run_task(
    state: State<'_, AppState>,
    run_id: String,
) -> Result<(), String> {
    let run = agent_run::get_run(&state.sea_db, &run_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Agent run not found".to_string())?;

    if matches!(
        run.status.as_str(),
        "queued" | "starting" | "running" | "waiting_approval" | "waiting_input" | "cancelling"
    ) {
        return Err("Running or waiting tasks must be cancelled before deletion".to_string());
    }

    agent_run::delete_run_events_by_run(&state.sea_db, &run_id)
        .await
        .map_err(|e| e.to_string())?;
    agent_run::delete_run_steps_by_run(&state.sea_db, &run_id)
        .await
        .map_err(|e| e.to_string())?;
    agent_run::delete_run(&state.sea_db, &run_id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn create_agent_task_from_center(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: CreateTaskFromCenterInput,
) -> Result<CreateTaskFromCenterResult, String> {
    let prompt = input.prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("Task prompt is required".to_string());
    }

    let title = input
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| task_prompt_preview(&prompt));
    let real_provider_id =
        crate::agent_runtime::compat::resolve_agent_provider_id(&state.sea_db, &input.provider_id)
            .await?;

    let conversation = conversation::create_conversation_with_source_and_mode(
        &state.sea_db,
        &title,
        &input.model_id,
        &real_provider_id,
        None,
        "task_center",
        "agent",
    )
    .await
    .map_err(|e| e.to_string())?;

    if let Err(err) = crate::agent_runtime::sdk_runner::start_sdk_run(
        app,
        &state,
        crate::agent_runtime::sdk_runner::StartSdkRunInput {
            conversation_id: conversation.id.clone(),
            prompt,
            attachments: Vec::new(),
            provider_id: real_provider_id,
            model_id: input.model_id,
            cwd: input.workspace_root,
            permission_mode: input.permission_mode,
        },
    )
    .await
    {
        let _ = conversation::delete_conversation(&state.sea_db, &conversation.id).await;
        return Err(err);
    }

    let run = agent_run::get_latest_run_for_conversation(&state.sea_db, &conversation.id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(CreateTaskFromCenterResult { conversation, run })
}

#[tauri::command]
pub async fn agent_control_run(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: AgentControlRunInput,
) -> Result<(), String> {
    let run = agent_run::get_run(&state.sea_db, &input.run_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Agent run not found".to_string())?;

    match input.action.as_str() {
        "cancel" => agent_cancel(app, state, run.conversation_id).await,
        "resume" => agent_resume_run(app, state, input.run_id).await,
        "approve" => {
            let tool_use_id = input
                .target_id
                .ok_or("targetId is required for approve".to_string())?;
            agent_approve(
                state,
                run.conversation_id,
                tool_use_id,
                input.value.unwrap_or_else(|| "allow_once".to_string()),
            )
            .await
        }
        "deny" => {
            let tool_use_id = input
                .target_id
                .ok_or("targetId is required for deny".to_string())?;
            agent_approve(state, run.conversation_id, tool_use_id, "deny".to_string()).await
        }
        "answer" => {
            let ask_id = input
                .target_id
                .ok_or("targetId is required for answer".to_string())?;
            let answer = input
                .value
                .ok_or("value is required for answer".to_string())?;
            agent_respond_ask(state, ask_id, answer).await
        }
        other => Err(format!("Unsupported agent control action: {}", other)),
    }
}

#[tauri::command]
pub async fn agent_resume_run(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    run_id: String,
) -> Result<(), String> {
    let run = agent_run::get_run(&state.sea_db, &run_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Agent run not found".to_string())?;

    if run.status != "interrupted" {
        return Err("Only interrupted runs can be resumed".to_string());
    }

    let resume_decision =
        crate::agent_runtime::runtime::prepare_resume(&state.sea_db, &run).await?;
    let _ = app.emit(
        "agent-run-event",
        AgentRunLifecyclePayload {
            conversation_id: run.conversation_id.clone(),
            run_id: run.id.clone(),
            status: Some(if resume_decision.accepted {
                "running".to_string()
            } else {
                "interrupted".to_string()
            }),
            resume_capability: Some(run.resume_capability.clone()),
            interrupted_reason: run.interrupted_reason.clone(),
            message: Some(resume_decision.message.clone()),
        },
    );
    if !resume_decision.accepted {
        return Err(resume_decision.message);
    }

    match run.runner_kind.as_str() {
        "sdk" => {
            let resume_context = run
                .resume_token_json
                .as_deref()
                .or(run.sdk_context_json.as_deref());
            agent_session::set_sdk_context_by_conversation_id(
                &state.sea_db,
                &run.conversation_id,
                resume_context,
            )
            .await
            .map_err(|e| e.to_string())?;
            let provider_id = run
                .provider_id
                .clone()
                .ok_or("Interrupted SDK run is missing provider_id".to_string())?;
            let model_id = run
                .model_id
                .clone()
                .ok_or("Interrupted SDK run is missing model_id".to_string())?;
            crate::agent_runtime::sdk_runner::start_sdk_run(
                app,
                &state,
                crate::agent_runtime::sdk_runner::StartSdkRunInput {
                    conversation_id: run.conversation_id,
                    prompt: run.prompt_snapshot,
                    attachments: Vec::new(),
                    provider_id,
                    model_id,
                    cwd: run.workspace_root.clone(),
                    permission_mode: None,
                },
            )
            .await
        }
        "deepseek_tui" => {
            let resume_context = run
                .resume_token_json
                .clone()
                .or(run.sdk_context_json.clone());
            agent_session::set_sdk_context_by_conversation_id(
                &state.sea_db,
                &run.conversation_id,
                resume_context.as_deref(),
            )
            .await
            .map_err(|e| e.to_string())?;
            crate::agent_runtime::deepseek_tui_runner::start_deepseek_tui_run(
                app,
                &state,
                crate::agent_runtime::deepseek_tui_runner::StartDeepseekTuiRunInput {
                    conversation_id: run.conversation_id,
                    prompt: run.prompt_snapshot,
                    attachments: Vec::new(),
                    model_id: run.model_id.clone(),
                    cwd: run.workspace_root.clone(),
                    permission_mode: None,
                    resume_context_json: resume_context,
                },
            )
            .await
        }
        _ => Err("This runner does not support resume".to_string()),
    }
}

#[tauri::command]
pub async fn agent_query_claude_code(
    _app: tauri::AppHandle,
    _state: State<'_, AppState>,
    _conversation_id: String,
    _prompt: String,
    _cwd: Option<String>,
    _permission_mode: Option<String>,
    _model: Option<String>,
) -> Result<(), String> {
    Err(
        "Claude Code local executor has been removed. Use wiseSpace Local (SDK) instead."
            .to_string(),
    )
}

#[tauri::command]
pub async fn agent_query_deepseek_tui(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    conversation_id: String,
    prompt: String,
    cwd: Option<String>,
    permission_mode: Option<String>,
    model: Option<String>,
) -> Result<(), String> {
    crate::agent_runtime::deepseek_tui_runner::start_deepseek_tui_run(
        app,
        &state,
        crate::agent_runtime::deepseek_tui_runner::StartDeepseekTuiRunInput {
            conversation_id,
            prompt,
            attachments: Vec::new(),
            model_id: model,
            cwd,
            permission_mode,
            resume_context_json: None,
        },
    )
    .await
}

#[tauri::command]
pub async fn agent_query(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    conversation_id: String,
    prompt: String,
    provider_id: String,
    model_id: String,
) -> Result<(), String> {
    crate::agent_runtime::sdk_runner::start_sdk_run(
        app,
        &state,
        crate::agent_runtime::sdk_runner::StartSdkRunInput {
            conversation_id,
            prompt,
            attachments: Vec::new(),
            provider_id,
            model_id,
            cwd: None,
            permission_mode: None,
        },
    )
    .await
}

#[tauri::command]
pub async fn agent_approve(
    state: State<'_, AppState>,
    conversation_id: String,
    tool_use_id: String,
    decision: String,
) -> Result<(), String> {
    if !["allow_once", "allow_always", "deny"].contains(&decision.as_str()) {
        return Err(format!("Invalid decision: {}", decision));
    }

    // Look up the stored oneshot sender for this tool_use_id
    let sender = state
        .agent_permission_senders
        .lock()
        .await
        .remove(&tool_use_id);

    match sender {
        Some(tx) => {
            tx.send(decision.clone())
                .map_err(|_| "Permission channel closed".to_string())?;
            crate::agent_runtime::runtime::resolve_permission_request(
                &state.sea_db,
                &conversation_id,
                &tool_use_id,
                &decision,
            )
            .await?;
            Ok(())
        }
        None => Err(format!(
            "No pending permission request for tool_use_id: {}",
            tool_use_id
        )),
    }
}

#[tauri::command]
pub async fn agent_respond_ask(
    state: State<'_, AppState>,
    ask_id: String,
    answer: String,
) -> Result<(), String> {
    let sender = state.agent_ask_senders.lock().await.remove(&ask_id);

    match sender {
        Some(tx) => {
            tx.send(answer.clone())
                .map_err(|_| "Ask user channel closed".to_string())?;
            crate::agent_runtime::runtime::resolve_ask_request(&state.sea_db, &ask_id, &answer)
                .await?;
            Ok(())
        }
        None => Err(format!("No pending ask request for ask_id: {}", ask_id)),
    }
}

#[tauri::command]
pub async fn agent_cancel(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<(), String> {
    let latest_run = agent_run::get_latest_run_for_conversation(&state.sea_db, &conversation_id)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(run) = latest_run.as_ref() {
        let _ = crate::agent_runtime::runtime::mark_run_cancelling(&state.sea_db, &run).await;
    }

    if let Some(token) = state
        .agent_cancel_tokens
        .lock()
        .await
        .remove(&conversation_id)
    {
        token.cancel();
    }

    // Remove from in-memory running set
    if let Ok(mut running) = RUNNING_AGENTS.lock() {
        running.remove(&conversation_id);
    }

    if let Some(run) = latest_run.as_ref() {
        if run.runner_kind == "deepseek_tui" {
            let interrupt_context = run
                .resume_token_json
                .as_deref()
                .or(run.sdk_context_json.as_deref());
            let _ =
                crate::agent_runtime::deepseek_tui_runner::interrupt_turn_from_context(interrupt_context)
                    .await;
        }
    }

    crate::agent_runtime::runtime::finish_run_cancelled(&app, &state.sea_db, &conversation_id)
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn agent_update_session(
    state: State<'_, AppState>,
    conversation_id: String,
    cwd: Option<String>,
    permission_mode: Option<String>,
) -> Result<AgentSession, String> {
    crate::agent_runtime::profile::update_profile_from_legacy_inputs(
        &state.sea_db,
        &conversation_id,
        cwd.as_deref(),
        permission_mode.as_deref(),
    )
    .await?;
    crate::agent_runtime::profile::get_compat_session(&state.sea_db, &conversation_id)
        .await?
        .ok_or("Agent session not found".to_string())
}

#[tauri::command]
pub async fn agent_get_session(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Option<AgentSession>, String> {
    crate::agent_runtime::profile::get_compat_session(&state.sea_db, &conversation_id).await
}

/// Create the conversation workspace directory under documents root and return its path.
#[tauri::command]
pub async fn agent_ensure_workspace(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<String, String> {
    let profile =
        crate::agent_runtime::profile::get_or_create_profile(&state.sea_db, &conversation_id)
            .await?;
    let workspace_root = profile
        .workspace_root
        .ok_or("Agent workspace path is missing".to_string())?;
    ensure_agent_workspace_dir(&workspace_root)
}

/// Backup and clear SDK context when a context-clear marker is inserted.
#[tauri::command]
pub async fn agent_backup_and_clear_sdk_context(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<(), String> {
    agent_session::backup_and_clear_sdk_context_by_conversation_id(&state.sea_db, &conversation_id)
        .await
        .map_err(|e| e.to_string())
}

/// Restore SDK context from backup when a context-clear marker is removed.
#[tauri::command]
pub async fn agent_restore_sdk_context_from_backup(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<(), String> {
    agent_session::restore_sdk_context_from_backup_by_conversation_id(
        &state.sea_db,
        &conversation_id,
    )
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::ensure_agent_workspace_dir;
    use wisespace_core::types::ProviderType;

    #[tokio::test]
    async fn agent_provider_resolution_materializes_builtin_provider() {
        let db = wisespace_core::db::create_test_pool().await.unwrap().conn;

        let real_id =
            crate::agent_runtime::compat::resolve_agent_provider_id(&db, "builtin_deepseek")
                .await
                .unwrap();

        assert_ne!(real_id, "builtin_deepseek");
        let provider = wisespace_core::repo::provider::get_provider(&db, &real_id)
            .await
            .unwrap();
        assert_eq!(provider.builtin_id.as_deref(), Some("deepseek"));
        assert_eq!(provider.provider_type, ProviderType::DeepSeek);
    }

    #[test]
    fn ensure_agent_workspace_dir_creates_target_directory() {
        let temp_root = std::env::temp_dir().join(format!(
            "wisespace_agent_workspace_test_{}",
            std::process::id()
        ));
        let workspace_dir = temp_root.join("workspace").join("conv-test");
        let _ = std::fs::remove_dir_all(&temp_root);

        let result = ensure_agent_workspace_dir(&workspace_dir.to_string_lossy()).unwrap();

        assert_eq!(result, workspace_dir.to_string_lossy().to_string());
        assert!(workspace_dir.exists());

        let _ = std::fs::remove_dir_all(&temp_root);
    }
}
