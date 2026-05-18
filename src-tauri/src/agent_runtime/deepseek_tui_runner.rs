use super::cli_runner::{
    build_agent_content_with_thinking, build_cli_command, load_deepseek_session_context,
    resolve_deepseek_tui_command_path, serialize_deepseek_session_context, DeepSeekSessionContext,
};
use super::compat::{
    ensure_agent_assistant_message, AgentCancelTokenGuard, RunningAgentGuard, RUNNING_AGENTS,
};
use super::payloads::{
    AgentErrorPayload, AgentPermissionRequestPayload, AgentStatusPayload,
};
use super::result_renderer;
use super::{profile, runtime};
use crate::AppState;
use futures::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::{Mutex, RwLock};
use tokio::time::{sleep, Duration};
use wisespace_core::repo::{agent_run, agent_session, conversation, message};
use wisespace_core::types::{Attachment, AttachmentInput, MessageRole};

const DEEPSEEK_RUNTIME_HOST: &str = "127.0.0.1";
const DEEPSEEK_RUNTIME_PORT: u16 = 18778;
const DEEPSEEK_RUNTIME_TOKEN: &str = "wisespace-local-deepseek-runtime";

static DEEPSEEK_RUNTIME_CHILD: std::sync::LazyLock<Mutex<Option<Child>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

#[derive(Debug, Clone)]
pub struct StartDeepseekTuiRunInput {
    pub conversation_id: String,
    pub prompt: String,
    pub attachments: Vec<AttachmentInput>,
    pub model_id: Option<String>,
    pub cwd: Option<String>,
    pub permission_mode: Option<String>,
    pub resume_context_json: Option<String>,
}

fn build_attachment_execution_prompt(prompt: &str, attachments: &[Attachment]) -> String {
    if attachments.is_empty() {
        return prompt.to_string();
    }

    let attachment_lines = attachments
        .iter()
        .map(|attachment| {
            let absolute_path =
                wisespace_core::storage_paths::resolve_documents_path(&attachment.file_path);
            format!(
                "- {} ({})\n  absolute_path: {}",
                attachment.file_name,
                attachment.file_type,
                absolute_path.to_string_lossy()
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        "{prompt}\n\nAttached files uploaded with this message:\n{attachment_lines}\n\nIf you need the file contents, read them from the absolute_path values above."
    )
}

#[derive(Debug, Clone, Deserialize)]
struct RuntimeHealth {
    status: String,
    service: String,
}

#[derive(Debug, Clone, Deserialize)]
struct RuntimeThread {
    id: String,
    model: Option<String>,
    workspace: Option<String>,
    latest_turn_id: Option<String>,
    auto_approve: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
struct RuntimeTurn {
    id: String,
    status: String,
    usage: Option<RuntimeUsage>,
}

#[derive(Debug, Clone, Deserialize)]
struct RuntimeUsage {
    input_tokens: u64,
    output_tokens: u64,
}

#[derive(Debug, Clone, Deserialize)]
struct CreateTurnResponse {
    thread: RuntimeThread,
    turn: RuntimeTurn,
}

#[derive(Debug, Clone, Deserialize)]
struct ThreadDetailResponse {
    thread: RuntimeThread,
    turns: Vec<RuntimeTurnDetail>,
    items: Vec<RuntimeItem>,
    latest_seq: u64,
}

#[derive(Debug, Clone, Deserialize)]
struct RuntimeTurnDetail {
    id: String,
    status: String,
    usage: Option<RuntimeUsage>,
}

#[derive(Debug, Clone, Deserialize)]
struct RuntimeItem {
    id: String,
    turn_id: String,
    kind: String,
    status: String,
    detail: Option<String>,
    summary: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct RuntimeEventEnvelope {
    seq: u64,
    thread_id: String,
    turn_id: Option<String>,
    item_id: Option<String>,
    event: String,
    payload: Value,
}

#[derive(Debug, Clone, Serialize)]
struct CreateThreadRequest<'a> {
    workspace: &'a str,
    mode: &'static str,
    allow_shell: bool,
    auto_approve: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    model: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize)]
struct UpdateThreadRequest<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    auto_approve: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize)]
struct CreateTurnRequest<'a> {
    prompt: &'a str,
}

#[derive(Debug, Clone)]
struct PendingRuntimeApproval {
    approval_id: String,
    tool_name: String,
    description: String,
}

fn runtime_base_url() -> String {
    format!("http://{}:{}", DEEPSEEK_RUNTIME_HOST, DEEPSEEK_RUNTIME_PORT)
}

fn runtime_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())
}

fn runtime_auth_header() -> String {
    format!("Bearer {}", DEEPSEEK_RUNTIME_TOKEN)
}

async fn runtime_health_check(client: &reqwest::Client) -> bool {
    let url = format!("{}/health", runtime_base_url());
    let Ok(response) = client.get(url).send().await else {
        return false;
    };
    if !response.status().is_success() {
        return false;
    }
    match response.json::<RuntimeHealth>().await {
        Ok(health) => health.status == "ok" && health.service == "deepseek-runtime-api",
        Err(_) => false,
    }
}

async fn ensure_runtime_server() -> Result<(), String> {
    let client = runtime_client()?;
    if runtime_health_check(&client).await {
        return Ok(());
    }

    let mut guard = DEEPSEEK_RUNTIME_CHILD.lock().await;
    if guard.is_none() {
        let resolved_path = resolve_deepseek_tui_command_path()
            .ok_or("DeepSeek-TUI runtime command not found".to_string())?;
        let mut command = build_cli_command(&resolved_path);
        command
            .arg("serve")
            .arg("--http")
            .arg("--host")
            .arg(DEEPSEEK_RUNTIME_HOST)
            .arg("--port")
            .arg(DEEPSEEK_RUNTIME_PORT.to_string())
            .arg("--auth-token")
            .arg(DEEPSEEK_RUNTIME_TOKEN)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|e| format!("Failed to start DeepSeek runtime server: {}", e))?;

        if let Some(stdout) = child.stdout.take() {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    tracing::info!("[deepseek-runtime] {}", line);
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    tracing::warn!("[deepseek-runtime] {}", line);
                }
            });
        }

        *guard = Some(child);
    }
    drop(guard);

    for _ in 0..20 {
        if runtime_health_check(&client).await {
            return Ok(());
        }
        sleep(Duration::from_millis(250)).await;
    }

    Err("DeepSeek runtime server did not become ready".to_string())
}

async fn create_runtime_thread(
    client: &reqwest::Client,
    workspace_root: &str,
    model_id: Option<&str>,
    auto_approve: bool,
) -> Result<RuntimeThread, String> {
    let url = format!("{}/v1/threads", runtime_base_url());
    client
        .post(url)
        .header(AUTHORIZATION, runtime_auth_header())
        .header(CONTENT_TYPE, "application/json")
        .json(&CreateThreadRequest {
            workspace: workspace_root,
            mode: "agent",
            allow_shell: true,
            auto_approve,
            model: model_id.filter(|value| !value.trim().is_empty()),
        })
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<RuntimeThread>()
        .await
        .map_err(|e| e.to_string())
}

async fn update_thread_auto_approve(
    client: &reqwest::Client,
    thread_id: &str,
    auto_approve: bool,
) -> Result<RuntimeThread, String> {
    let url = format!("{}/v1/threads/{}", runtime_base_url(), thread_id);
    client
        .patch(url)
        .header(AUTHORIZATION, runtime_auth_header())
        .header(CONTENT_TYPE, "application/json")
        .json(&UpdateThreadRequest {
            auto_approve: Some(auto_approve),
            title: None,
        })
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<RuntimeThread>()
        .await
        .map_err(|e| e.to_string())
}

async fn get_thread_detail(
    client: &reqwest::Client,
    thread_id: &str,
) -> Result<ThreadDetailResponse, String> {
    let url = format!("{}/v1/threads/{}", runtime_base_url(), thread_id);
    client
        .get(url)
        .header(AUTHORIZATION, runtime_auth_header())
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<ThreadDetailResponse>()
        .await
        .map_err(|e| e.to_string())
}

async fn create_turn(
    client: &reqwest::Client,
    thread_id: &str,
    prompt: &str,
) -> Result<CreateTurnResponse, String> {
    let url = format!("{}/v1/threads/{}/turns", runtime_base_url(), thread_id);
    client
        .post(url)
        .header(AUTHORIZATION, runtime_auth_header())
        .header(CONTENT_TYPE, "application/json")
        .json(&CreateTurnRequest { prompt })
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<CreateTurnResponse>()
        .await
        .map_err(|e| e.to_string())
}

fn normalize_thread_context(
    raw_context_json: Option<&str>,
    effective_cwd: &str,
) -> DeepSeekSessionContext {
    let mut context = load_deepseek_session_context(raw_context_json);
    let workspace_mismatch = context
        .workspace_root
        .as_deref()
        .is_some_and(|saved| saved != effective_cwd);
    if workspace_mismatch {
        context.runtime_thread_id = None;
        context.latest_turn_id = None;
        context.workspace_root = Some(effective_cwd.to_string());
    }
    context
}

fn serialize_runtime_context(
    base: &DeepSeekSessionContext,
    thread_id: &str,
    turn_id: Option<&str>,
    model_id: Option<&str>,
    workspace_root: &str,
) -> Option<String> {
    let mut next = base.clone();
    next.runtime_thread_id = Some(thread_id.to_string());
    next.latest_turn_id = turn_id.map(ToString::to_string);
    next.deepseek_model = model_id.map(ToString::to_string).or_else(|| next.deepseek_model.clone());
    next.workspace_root = Some(workspace_root.to_string());
    serialize_deepseek_session_context(&next)
}

fn extract_payload_item(payload: &Value) -> Option<RuntimeItem> {
    serde_json::from_value::<RuntimeItem>(payload.get("item")?.clone()).ok()
}

fn extract_payload_turn(payload: &Value) -> Option<RuntimeTurnDetail> {
    serde_json::from_value::<RuntimeTurnDetail>(payload.get("turn")?.clone()).ok()
}

fn parse_runtime_item_value(raw: Option<&str>) -> Option<Value> {
    raw.and_then(|value| serde_json::from_str::<Value>(value).ok())
}

fn summarize_runtime_item(item: &RuntimeItem) -> Value {
    let mut summary = serde_json::Map::new();
    summary.insert("kind".to_string(), Value::String(item.kind.clone()));
    summary.insert("status".to_string(), Value::String(item.status.clone()));
    if let Some(item_summary) = item.summary.as_ref().filter(|value| !value.trim().is_empty()) {
        summary.insert("summary".to_string(), Value::String(item_summary.clone()));
    }
    if let Some(item_detail) = item.detail.as_ref().filter(|value| !value.trim().is_empty()) {
        summary.insert("detail".to_string(), Value::String(item_detail.clone()));
    }
    Value::Object(summary)
}

fn extract_command_input(detail: &ThreadDetailResponse, turn_id: &str) -> Value {
    let Some(item) = detail
        .items
        .iter()
        .rev()
        .find(|item| {
            item.turn_id == turn_id
                && matches!(item.kind.as_str(), "command_execution" | "tool_call")
        })
    else {
        return serde_json::json!({});
    };

    if let Some(parsed) = parse_runtime_item_value(item.detail.as_deref()) {
        return parsed;
    }

    if let Some(parsed) = parse_runtime_item_value(item.summary.as_deref()) {
        return parsed;
    }

    summarize_runtime_item(item)
}

fn build_approval_continue_prompt(tool_name: &str, tool_input: &Value) -> String {
    let input_json = serde_json::to_string(tool_input).unwrap_or_else(|_| "{}".to_string());
    format!(
        "The previously requested tool call is approved. Continue the interrupted tool flow in the current thread, finish the original task, and you may use `{}` with this approved input if still needed: {}",
        tool_name, input_json
    )
}

async fn stream_turn_events(
    client: &reqwest::Client,
    thread_id: &str,
    turn_id: &str,
    since_seq: u64,
    cancel_token: open_agent_sdk::CancellationToken,
    mut on_event: impl FnMut(RuntimeEventEnvelope) -> Result<bool, String>,
) -> Result<(), String> {
    let url = format!(
        "{}/v1/threads/{}/events?since_seq={}",
        runtime_base_url(),
        thread_id,
        since_seq
    );
    let response = client
        .get(url)
        .header(AUTHORIZATION, runtime_auth_header())
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        if cancel_token.is_cancelled() {
            break;
        }
        let chunk = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(separator) = buffer.find("\n\n") {
            let raw_event = buffer[..separator].replace("\r", "");
            buffer = buffer[separator + 2..].to_string();

            let mut data_line: Option<&str> = None;
            for line in raw_event.lines() {
                if let Some(value) = line.strip_prefix("data: ") {
                    data_line = Some(value);
                }
            }

            let Some(data_line) = data_line else {
                continue;
            };
            let envelope = serde_json::from_str::<RuntimeEventEnvelope>(data_line)
                .map_err(|e| format!("Failed to parse DeepSeek SSE event: {}", e))?;
            if envelope.thread_id != thread_id {
                continue;
            }
            if envelope.turn_id.as_deref() != Some(turn_id) {
                continue;
            }
            if on_event(envelope)? {
                return Ok(());
            }
        }
    }

    Ok(())
}

pub async fn interrupt_turn_from_context(raw_context_json: Option<&str>) -> Result<(), String> {
    let context = load_deepseek_session_context(raw_context_json);
    let Some(thread_id) = context.runtime_thread_id.as_deref() else {
        return Ok(());
    };
    let Some(turn_id) = context.latest_turn_id.as_deref() else {
        return Ok(());
    };

    ensure_runtime_server().await?;
    let client = runtime_client()?;
    let url = format!(
        "{}/v1/threads/{}/turns/{}/interrupt",
        runtime_base_url(),
        thread_id,
        turn_id
    );
    let _ = client
        .post(url)
        .header(AUTHORIZATION, runtime_auth_header())
        .send()
        .await;
    Ok(())
}

pub async fn start_deepseek_tui_run(
    app: tauri::AppHandle,
    state: &AppState,
    input: StartDeepseekTuiRunInput,
) -> Result<(), String> {
    {
        let running = RUNNING_AGENTS.lock().unwrap();
        if running.contains_key(&input.conversation_id) {
            return Err("Agent is already running".to_string());
        }
    }

    let _profile = profile::update_profile_from_legacy_inputs(
        &state.sea_db,
        &input.conversation_id,
        input.cwd.as_deref(),
        input.permission_mode.as_deref(),
    )
    .await?;
    let session = profile::get_compat_session(&state.sea_db, &input.conversation_id)
        .await?
        .ok_or("Agent session not found".to_string())?;

    let effective_cwd = session
        .cwd
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or("Agent workspace is required before starting DeepSeek-TUI".to_string())?;
    let workspace_path = Path::new(&effective_cwd);
    if workspace_path.exists() && !workspace_path.is_dir() {
        return Err(format!(
            "Agent workspace exists but is not a directory: {}",
            effective_cwd
        ));
    }
    if !workspace_path.exists() {
        std::fs::create_dir_all(workspace_path).map_err(|e| {
            format!(
                "Failed to create agent workspace '{}': {}",
                effective_cwd, e
            )
        })?;
    }
    let canonical_workspace = workspace_path.canonicalize().map_err(|e| {
        format!(
            "Failed to access agent workspace '{}': {}",
            effective_cwd, e
        )
    })?;
    let effective_cwd = canonical_workspace.to_string_lossy().to_string();

    runtime::ensure_no_active_run(&state.sea_db, &input.conversation_id).await?;
    ensure_runtime_server().await?;
    let client = runtime_client()?;

    let existing_context_json = input
        .resume_context_json
        .clone()
        .or_else(|| session.sdk_context_json.clone());
    let context = normalize_thread_context(existing_context_json.as_deref(), &effective_cwd);
    let existing_thread_id = context.runtime_thread_id.clone();
    let should_auto_approve = matches!(input.permission_mode.as_deref(), Some("full_access"));

    let thread = if let Some(thread_id) = existing_thread_id {
        match get_thread_detail(&client, &thread_id).await {
            Ok(detail) => {
                if detail
                    .thread
                    .workspace
                    .as_deref()
                    .is_some_and(|workspace| workspace != effective_cwd)
                {
                    create_runtime_thread(
                        &client,
                        &effective_cwd,
                        input.model_id.as_deref(),
                        should_auto_approve,
                    )
                    .await?
                } else {
                    if detail.thread.auto_approve != Some(should_auto_approve) {
                        let _ =
                            update_thread_auto_approve(&client, &thread_id, should_auto_approve)
                                .await;
                    }
                    detail.thread
                }
            }
            Err(_) => {
                create_runtime_thread(
                    &client,
                    &effective_cwd,
                    input.model_id.as_deref(),
                    should_auto_approve,
                )
                .await?
            }
        }
    } else {
        create_runtime_thread(
            &client,
            &effective_cwd,
            input.model_id.as_deref(),
            should_auto_approve,
        )
        .await?
    };

    let baseline_seq = get_thread_detail(&client, &thread.id)
        .await
        .map(|detail| detail.latest_seq)
        .unwrap_or(0);

    let run_context_json = serialize_runtime_context(
        &context,
        &thread.id,
        thread.latest_turn_id.as_deref(),
        input.model_id.as_deref().or(thread.model.as_deref()),
        &effective_cwd,
    );
    let run = runtime::start_run(
        &state.sea_db,
        &input.conversation_id,
        super::runner::AgentRunnerKind::DeepseekTui,
        &input.prompt,
        None,
        input.model_id.as_deref().or(thread.model.as_deref()),
        run_context_json.as_deref(),
    )
    .await?
    .1;

    let persisted_attachments = crate::commands::conversations::persist_attachments(
        state,
        &input.conversation_id,
        &input.attachments,
    )
    .await
    .map_err(|e| e.to_string())?;

    let execution_prompt = build_attachment_execution_prompt(&input.prompt, &persisted_attachments);

    let user_message = message::create_message(
        &state.sea_db,
        &input.conversation_id,
        MessageRole::User,
        &input.prompt,
        &persisted_attachments,
        None,
        0,
    )
    .await
    .map_err(|e| e.to_string())?;
    conversation::increment_message_count(&state.sea_db, &input.conversation_id)
        .await
        .map_err(|e| e.to_string())?;

    let turn_response = create_turn(&client, &thread.id, &execution_prompt).await?;
    let resume_context_json = serialize_runtime_context(
        &context,
        &turn_response.thread.id,
        Some(&turn_response.turn.id),
        input
            .model_id
            .as_deref()
            .or(turn_response.thread.model.as_deref()),
        &effective_cwd,
    );
    agent_run::update_run_resume_state(
        &state.sea_db,
        &run.id,
        Some("resumable"),
        Some(None),
        Some(resume_context_json.as_deref()),
    )
    .await
    .map_err(|e| e.to_string())?;
    agent_session::set_sdk_context_by_conversation_id(
        &state.sea_db,
        &input.conversation_id,
        resume_context_json.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    let db = state.sea_db.clone();
    let conversation_id = input.conversation_id.clone();
    let cancel_tokens = state.agent_cancel_tokens.clone();
    let permission_senders = state.agent_permission_senders.clone();
    let assistant_id_for_task: Arc<RwLock<Option<String>>> = Arc::new(RwLock::new(None));
    let thread_id = turn_response.thread.id.clone();
    let effective_model = input
        .model_id
        .clone()
        .or(turn_response.thread.model.clone())
        .unwrap_or_else(|| "deepseek-v4-pro".to_string());
    tokio::spawn(async move {
        let _running_guard = RunningAgentGuard {
            conversation_id: conversation_id.clone(),
            run_id: run.id.clone(),
        };
        let cancel_token = open_agent_sdk::CancellationToken::new();
        cancel_tokens
            .lock()
            .await
            .insert(conversation_id.clone(), cancel_token.clone());
        let _cancel_guard = AgentCancelTokenGuard {
            conversation_id: conversation_id.clone(),
            tokens: cancel_tokens.clone(),
        };

        if let Ok(mut running) = RUNNING_AGENTS.lock() {
            running.insert(conversation_id.clone(), run.id.clone());
        }

        let mut assistant_message_id: Option<String> = None;
        let _ = ensure_agent_assistant_message(
            &db,
            &app_handle,
            &conversation_id,
            &user_message.id,
            user_message.created_at,
            "",
            &mut assistant_message_id,
            &assistant_id_for_task,
        )
        .await;
        let _ = agent_run::update_run_status(&db, &run.id, "running", None).await;
        let _ = app_handle.emit(
            "agent-status",
            AgentStatusPayload {
                conversation_id: conversation_id.clone(),
                message: "DeepSeek-TUI is working".to_string(),
            },
        );

        let mut accumulated_thinking = String::new();
        let mut accumulated_text = String::new();
        let mut final_usage: Option<RuntimeUsage> = None;
        let mut active_turn_id = turn_response.turn.id.clone();
        let mut active_baseline_seq = baseline_seq;
        let mut active_resume_context_json = resume_context_json.clone();

        loop {
            let mut pending_approval: Option<PendingRuntimeApproval> = None;
            let mut runtime_interrupted = false;
            let mut runtime_interrupt_message: Option<String> = None;

            let stream_result = stream_turn_events(
                &client,
                &thread_id,
                &active_turn_id,
                active_baseline_seq,
                cancel_token.clone(),
                |envelope| {
                    match envelope.event.as_str() {
                        "item.delta" => {
                            let kind = envelope
                                .payload
                                .get("kind")
                                .and_then(|value| value.as_str())
                                .unwrap_or_default();
                            let delta = envelope
                                .payload
                                .get("delta")
                                .and_then(|value| value.as_str())
                                .unwrap_or_default();
                            if delta.is_empty() {
                                return Ok(false);
                            }
                            if kind == "agent_reasoning" {
                                accumulated_thinking.push_str(delta);
                            } else if kind == "agent_message" {
                                accumulated_text.push_str(delta);
                            }
                        }
                        "item.completed" => {
                            if let Some(item) = extract_payload_item(&envelope.payload) {
                                if item.kind == "agent_reasoning" {
                                    if let Some(detail) = item.detail {
                                        accumulated_thinking = detail;
                                    }
                                } else if item.kind == "agent_message" {
                                    if let Some(detail) = item.detail {
                                        accumulated_text = detail;
                                    }
                                }
                            }
                        }
                        "approval.required" => {
                            pending_approval = Some(PendingRuntimeApproval {
                                approval_id: envelope
                                    .payload
                                    .get("approval_id")
                                    .or_else(|| envelope.payload.get("id"))
                                    .and_then(|value| value.as_str())
                                    .unwrap_or_default()
                                    .to_string(),
                                tool_name: envelope
                                    .payload
                                    .get("tool_name")
                                    .and_then(|value| value.as_str())
                                    .unwrap_or("tool")
                                    .to_string(),
                                description: envelope
                                    .payload
                                    .get("description")
                                    .and_then(|value| value.as_str())
                                    .unwrap_or("DeepSeek runtime requires approval for the next tool call.")
                                    .to_string(),
                            });
                            return Ok(true);
                        }
                        "turn.interrupt_requested" => {
                            runtime_interrupted = true;
                            runtime_interrupt_message =
                                Some("DeepSeek runtime interrupt requested".to_string());
                            return Ok(true);
                        }
                        "turn.completed" => {
                            if let Some(turn) = extract_payload_turn(&envelope.payload) {
                                final_usage = turn.usage;
                            }
                            return Ok(true);
                        }
                        "item.failed" => {
                            return Err(format!(
                                "DeepSeek runtime item {} for turn {} failed",
                                envelope.item_id.as_deref().unwrap_or("unknown"),
                                envelope.turn_id.as_deref().unwrap_or("unknown")
                            ));
                        }
                        "item.interrupted" => {
                            runtime_interrupted = true;
                            runtime_interrupt_message = Some(format!(
                                "DeepSeek runtime item {} was interrupted",
                                envelope.item_id.as_deref().unwrap_or("unknown")
                            ));
                            return Ok(true);
                        }
                        _ => {}
                    }
                    Ok(false)
                },
            )
            .await;

            if cancel_token.is_cancelled() {
                let _ = interrupt_turn_from_context(active_resume_context_json.as_deref()).await;
                return;
            }

            if let Some(pending) = pending_approval.take() {
                let assistant_message_id = assistant_message_id.clone().unwrap_or_default();
                let detail = get_thread_detail(&client, &thread_id).await.ok();
                let tool_input = detail
                    .as_ref()
                    .map(|value| extract_command_input(value, &active_turn_id))
                    .unwrap_or_else(|| serde_json::json!({}));
                let permission_payload = AgentPermissionRequestPayload {
                    conversation_id: conversation_id.clone(),
                    assistant_message_id: assistant_message_id.clone(),
                    tool_use_id: pending.approval_id.clone(),
                    tool_name: pending.tool_name.clone(),
                    input: tool_input.clone(),
                    risk_level: "execute".to_string(),
                };
                let _ = app_handle.emit("agent-permission-request", permission_payload.clone());
                let _ = agent_run::update_run_status(&db, &run.id, "waiting_approval", None).await;
                let _ = runtime::append_runtime_event(
                    &db,
                    &run.id,
                    "permission_request",
                    &serde_json::json!({
                        "toolUseId": pending.approval_id,
                        "toolName": pending.tool_name,
                        "input": tool_input,
                        "description": pending.description,
                    }),
                )
                .await;

                let (tx, rx) = tokio::sync::oneshot::channel::<String>();
                permission_senders
                    .lock()
                    .await
                    .insert(permission_payload.tool_use_id.clone(), tx);

                let decision = tokio::select! {
                    result = rx => result.unwrap_or_else(|_| "deny".to_string()),
                    _ = cancel_token.cancelled() => "deny".to_string(),
                };

                permission_senders
                    .lock()
                    .await
                    .remove(&permission_payload.tool_use_id);

                if decision == "deny" {
                    let _ = interrupt_turn_from_context(active_resume_context_json.as_deref()).await;
                    let error_message = "DeepSeek runtime tool approval was denied by the user".to_string();
                    let _ = agent_run::finish_run(
                        &db,
                        &run.id,
                        "failed",
                        active_resume_context_json.as_deref(),
                        None,
                        0.0,
                        Some(&error_message),
                    )
                    .await;
                        let _ = app_handle.emit(
                            "agent-error",
                            AgentErrorPayload {
                                conversation_id: conversation_id.clone(),
                                assistant_message_id: Some(assistant_message_id.clone()),
                                message: error_message,
                            },
                        );
                    return;
                }

                let _ = update_thread_auto_approve(&client, &thread_id, true).await;
                let next_baseline = get_thread_detail(&client, &thread_id)
                    .await
                    .map(|value| value.latest_seq)
                    .unwrap_or(active_baseline_seq);
                let continue_prompt =
                    build_approval_continue_prompt(&permission_payload.tool_name, &permission_payload.input);
                match create_turn(&client, &thread_id, &continue_prompt).await {
                    Ok(next_turn) => {
                        active_baseline_seq = next_baseline;
                        active_turn_id = next_turn.turn.id.clone();
                        active_resume_context_json = serialize_runtime_context(
                            &load_deepseek_session_context(active_resume_context_json.as_deref()),
                            &thread_id,
                            Some(&active_turn_id),
                            Some(&effective_model),
                            &effective_cwd,
                        );
                        let _ = agent_run::update_run_resume_state(
                            &db,
                            &run.id,
                            Some("resumable"),
                            Some(None),
                            Some(active_resume_context_json.as_deref()),
                        )
                        .await;
                        let _ = agent_session::set_sdk_context_by_conversation_id(
                            &db,
                            &conversation_id,
                            active_resume_context_json.as_deref(),
                        )
                        .await;
                        let _ = agent_run::update_run_status(&db, &run.id, "running", None).await;
                        let _ = app_handle.emit(
                            "agent-status",
                            AgentStatusPayload {
                                conversation_id: conversation_id.clone(),
                                message: "DeepSeek-TUI is continuing after approval".to_string(),
                            },
                        );
                        continue;
                    }
                    Err(err) => {
                        let _ = agent_run::finish_run(
                            &db,
                            &run.id,
                            "failed",
                            active_resume_context_json.as_deref(),
                            None,
                            0.0,
                            Some(&err),
                        )
                        .await;
                        let _ = app_handle.emit(
                            "agent-error",
                            AgentErrorPayload {
                                conversation_id: conversation_id.clone(),
                                assistant_message_id: Some(assistant_message_id.clone()),
                                message: err,
                            },
                        );
                        return;
                    }
                }
            }

            if runtime_interrupted {
                let interruption_message = runtime_interrupt_message
                    .unwrap_or_else(|| "DeepSeek runtime turn was interrupted".to_string());
                let _ = agent_run::update_run_resume_state(
                    &db,
                    &run.id,
                    Some("resumable"),
                    Some(Some("runtime_interrupt")),
                    Some(active_resume_context_json.as_deref()),
                )
                .await;
                let _ = agent_run::finish_run(
                    &db,
                    &run.id,
                    "interrupted",
                    active_resume_context_json.as_deref(),
                    None,
                    0.0,
                    Some(&interruption_message),
                )
                .await;
                let _ = app_handle.emit(
                    "agent-run-event",
                    serde_json::json!({
                        "conversationId": conversation_id,
                        "runId": run.id,
                        "status": "interrupted",
                        "resumeCapability": "resumable",
                        "interruptedReason": "runtime_interrupt",
                        "message": interruption_message,
                    }),
                );
                return;
            }

            match stream_result {
            Ok(()) => {
                let detail = match get_thread_detail(&client, &thread_id).await {
                    Ok(detail) => detail,
                    Err(err) => {
                        let _ = app_handle.emit(
                            "agent-error",
                            AgentErrorPayload {
                                conversation_id: conversation_id.clone(),
                                assistant_message_id: assistant_message_id.clone(),
                                message: format!("Failed to load DeepSeek thread result: {}", err),
                            },
                        );
                        let _ = agent_run::finish_run(
                            &db,
                            &run.id,
                            "failed",
                            active_resume_context_json.as_deref(),
                            None,
                            0.0,
                            Some(&format!("Failed to load DeepSeek thread result: {}", err)),
                        )
                        .await;
                        return;
                    }
                };
                let turn_detail = detail.turns.iter().find(|item| item.id == active_turn_id);
                let latest_reasoning = detail
                    .items
                    .iter()
                    .filter(|item| item.turn_id == active_turn_id && item.kind == "agent_reasoning")
                    .filter_map(|item| item.detail.clone().or(item.summary.clone()))
                    .next_back();
                let latest_message = detail
                    .items
                    .iter()
                    .filter(|item| item.turn_id == active_turn_id && item.kind == "agent_message")
                    .filter_map(|item| item.detail.clone().or(item.summary.clone()))
                    .next_back();

                if let Some(reasoning) = latest_reasoning {
                    accumulated_thinking = reasoning;
                }
                if let Some(text) = latest_message {
                    accumulated_text = text;
                }
                if final_usage.is_none() {
                    final_usage = turn_detail.and_then(|turn| turn.usage.clone());
                }

                let final_content = build_agent_content_with_thinking(
                    &accumulated_text,
                    (!accumulated_thinking.trim().is_empty()).then_some(accumulated_thinking.as_str()),
                );

                let persisted_assistant_message_id = ensure_agent_assistant_message(
                    &db,
                    &app_handle,
                    &conversation_id,
                    &user_message.id,
                    user_message.created_at,
                    &final_content,
                    &mut assistant_message_id,
                    &assistant_id_for_task,
                )
                .await;

                if let Some(message_id) = persisted_assistant_message_id.as_deref() {
                    let _ = message::update_message_content(&db, message_id, &final_content).await;
                }

                let final_context_json = serialize_runtime_context(
                    &load_deepseek_session_context(active_resume_context_json.as_deref()),
                    &thread_id,
                    Some(&active_turn_id),
                    Some(&effective_model),
                    &effective_cwd,
                );
                let _ = agent_run::update_run_resume_state(
                    &db,
                    &run.id,
                    Some("resumable"),
                    Some(None),
                    Some(final_context_json.as_deref()),
                )
                .await;
                let _ = agent_session::set_sdk_context_by_conversation_id(
                    &db,
                    &conversation_id,
                    final_context_json.as_deref(),
                )
                .await;

                let usage = final_usage.as_ref().map(|usage| open_agent_sdk::Usage {
                    input_tokens: usage.input_tokens,
                    output_tokens: usage.output_tokens,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                });
                let _ = result_renderer::finish_run_with_result(
                    &app_handle,
                    &db,
                    &run,
                    assistant_message_id.as_deref(),
                    &final_content,
                    &accumulated_thinking,
                    &effective_model,
                    usage.as_ref(),
                    1,
                    0.0,
                    final_context_json.as_deref(),
                )
                .await;
                return;
            }
            Err(err) => {
                let _ = agent_run::finish_run(
                    &db,
                    &run.id,
                    "failed",
                    active_resume_context_json.as_deref(),
                    None,
                    0.0,
                    Some(&err),
                )
                .await;
                let _ = app_handle.emit(
                    "agent-error",
                    AgentErrorPayload {
                        conversation_id: conversation_id.clone(),
                        assistant_message_id: assistant_message_id.clone(),
                        message: err,
                    },
                );
                return;
            }
        }
        }
    });

    Ok(())
}
