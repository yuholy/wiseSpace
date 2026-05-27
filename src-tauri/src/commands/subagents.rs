//! Built-in subagent system.
//!
//! Subagents are local, same-LLM task delegates that the primary agent
//! spawns for focused work (code review, research, …).  Each subagent has
//! its own system prompt but shares the conversation's LLM provider and
//! model configuration — no external connectors involved.

use base64::Engine;
use sea_orm::DatabaseConnection;
use serde_json::{json, Value};
use tauri::State;
use wisespace_core::error::Result as CoreResult;
use wisespace_core::file_store::FileStore;
use wisespace_core::types::*;
use wisespace_providers::{
    registry::ProviderRegistry, resolve_base_url_for_type, ProviderRequestContext,
};

use crate::AppState;

// ── System prompts ────────────────────────────────────────────────────

const BUILTIN_CODE_REVIEWER_PROMPT: &str = r#"You are the internal wiseSpace Code Reviewer subagent.

Return the answer in Chinese unless the task is clearly in another language.

Rules:
- Review findings come first.
- Focus on correctness, regressions, risks, security issues, and missing tests.
- If there are no concrete findings, say so explicitly.
- Keep the answer practical and concise.
- Use this exact structure:
  1. ## Findings
  2. ## Open Questions
  3. ## Suggested Next Steps
"#;

const BUILTIN_RESEARCHER_PROMPT: &str = r#"You are the internal wiseSpace Research subagent.

Return the answer in Chinese unless the task is clearly in another language.

Rules:
- Start with the conclusion.
- Separate evidence from assumptions.
- Be explicit about uncertainty and missing data.
- Keep the answer practical and concise.
- Use this exact structure:
  1. ## Conclusion
  2. ## Evidence
  3. ## Open Questions
  4. ## Suggested Next Steps
"#;

// ── Public input struct ──────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct AutoDelegatedSubtaskInput {
    pub conversation_id: String,
    pub parent_run_id: String,
    pub source_message_id: Option<String>,
    pub task_type: String,
    pub preset_key: Option<String>,
    pub delegation_reason: String,
    pub input_text: String,
    pub title: String,
}

// ── JSON helper ──────────────────────────────────────────────────────

fn parse_json_object(raw: Option<&str>, fallback: Value) -> Result<Value, String> {
    match raw {
        Some(value) if !value.trim().is_empty() => {
            serde_json::from_str(value).map_err(|e| format!("Invalid JSON: {e}"))
        }
        _ => Ok(fallback),
    }
}

// ── Provider helpers ─────────────────────────────────────────────────

fn provider_type_to_registry_key(pt: &ProviderType) -> &'static str {
    match pt {
        ProviderType::OpenAI => "openai",
        ProviderType::OpenAIResponses => "openai_responses",
        ProviderType::DeepSeek => "deepseek",
        ProviderType::XAI => "xai",
        ProviderType::GLM => "glm",
        ProviderType::SiliconFlow => "siliconflow",
        ProviderType::Anthropic => "anthropic",
        ProviderType::Gemini => "gemini",
        ProviderType::Jina => "jina",
        ProviderType::Cohere => "cohere",
        ProviderType::Voyage => "voyage",
        ProviderType::Custom => "custom",
    }
}

// ── Message formatting ───────────────────────────────────────────────

fn format_recent_messages_for_subagent(
    messages: &[Message],
    source_message_id: Option<&str>,
) -> String {
    let relevant = if let Some(source_message_id) = source_message_id {
        if let Some(source_index) = messages
            .iter()
            .position(|message| message.id == source_message_id)
        {
            messages
                .iter()
                .skip(source_index)
                .take(6)
                .cloned()
                .collect::<Vec<_>>()
        } else {
            messages.iter().rev().take(6).cloned().collect::<Vec<_>>()
        }
    } else {
        messages.iter().rev().take(6).cloned().collect::<Vec<_>>()
    };

    relevant
        .into_iter()
        .filter_map(|message| {
            let role = match message.role {
                MessageRole::System => "system",
                MessageRole::User => "user",
                MessageRole::Assistant => "assistant",
                MessageRole::Tool => "tool",
            };
            let content = message.content.trim();
            if content.is_empty() {
                return None;
            }
            let clipped = if content.chars().count() > 1200 {
                let mut shortened = content.chars().take(1200).collect::<String>();
                shortened.push_str("...");
                shortened
            } else {
                content.to_string()
            };
            Some(format!("- {role}: {clipped}"))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

// ── Prompt builders ──────────────────────────────────────────────────

fn build_builtin_review_prompt(
    conversation: &Conversation,
    task: &AgentTask,
    input_text: &str,
    context: &Value,
    recent_messages: &str,
) -> String {
    let context_block = if context.is_null() || context == &json!({}) {
        "none".to_string()
    } else {
        serde_json::to_string_pretty(context).unwrap_or_else(|_| context.to_string())
    };
    let recent_messages_block = if recent_messages.trim().is_empty() {
        "none".to_string()
    } else {
        recent_messages.to_string()
    };

    format!(
        "Conversation title: {}\nTask title: {}\nTask type: {}\n\nDelegation request:\n{}\n\nExtra context (JSON):\n{}\n\nRecent conversation messages:\n{}",
        conversation.title, task.title, task.kind, input_text, context_block, recent_messages_block,
    )
}

fn build_builtin_research_prompt(
    conversation: &Conversation,
    task: &AgentTask,
    input_text: &str,
    context: &Value,
    recent_messages: &str,
) -> String {
    let context_block = if context.is_null() || context == &json!({}) {
        "none".to_string()
    } else {
        serde_json::to_string_pretty(context).unwrap_or_else(|_| context.to_string())
    };
    let recent_messages_block = if recent_messages.trim().is_empty() {
        "none".to_string()
    } else {
        recent_messages.to_string()
    };

    format!(
        "Conversation title: {}\nTask title: {}\nTask type: {}\n\nResearch request:\n{}\n\nExtra context (JSON):\n{}\n\nRecent conversation messages:\n{}",
        conversation.title, task.title, task.kind, input_text, context_block, recent_messages_block,
    )
}

// ── Auto-delegation hints ────────────────────────────────────────────

fn should_auto_delegate_review(prompt: &str) -> bool {
    let normalized = prompt.to_lowercase();
    let hints = [
        "review",
        "code review",
        "review this",
        "审查",
        "复核",
        "评审",
        "检查一下",
        "帮我看看",
        "找问题",
        "风险",
        "回归",
    ];
    hints.iter().any(|hint| normalized.contains(hint))
}

fn should_auto_delegate_research(prompt: &str) -> bool {
    let normalized = prompt.to_lowercase();
    let hints = [
        "research",
        "investigate",
        "compare",
        "look up",
        "gather evidence",
        "调研",
        "查一下",
        "搜集",
        "对比",
        "分析资料",
    ];
    hints.iter().any(|hint| normalized.contains(hint))
}

// ── Context helper ──────────────────────────────────────────────────

fn parse_task_context_json(task: &AgentTask) -> Result<Value, String> {
    let request_payload = parse_json_object(Some(&task.request_payload_json), json!({}))?;
    Ok(request_payload
        .get("contextJson")
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .map(|value| parse_json_object(Some(value), json!(value)))
        .transpose()?
        .unwrap_or_else(|| json!({})))
}

// ── Artifact ingestion ──────────────────────────────────────────────

fn artifact_field<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    value
        .get(key)
        .or_else(|| value.get("result").and_then(|result| result.get(key)))
}

async fn save_inline_artifacts(
    db: &DatabaseConnection,
    conversation_id: &str,
    payload: &Value,
) -> Result<Vec<Attachment>, String> {
    let Some(artifacts) = artifact_field(payload, "artifacts").and_then(Value::as_array) else {
        return Ok(Vec::new());
    };

    let file_store = FileStore::new();
    let mut attachments = Vec::new();

    for artifact in artifacts {
        let Some(name) = artifact.get("name").and_then(Value::as_str) else {
            continue;
        };
        let mime_type = artifact
            .get("mimeType")
            .or_else(|| artifact.get("mime_type"))
            .and_then(Value::as_str)
            .unwrap_or("application/octet-stream");
        let data_base64 = artifact
            .get("dataBase64")
            .or_else(|| artifact.get("data_base64"))
            .or_else(|| artifact.get("data"))
            .and_then(Value::as_str);
        let Some(data_base64) = data_base64 else {
            continue;
        };

        let bytes = base64::engine::general_purpose::STANDARD
            .decode(data_base64)
        .or_else(|_| {
            base64::engine::general_purpose::STANDARD.decode(data_base64.trim())
        })
        .map_err(|e| format!("Invalid artifact base64: {e}"))?;
        let saved = file_store
            .save_file(&bytes, name, mime_type)
            .map_err(|e| e.to_string())?;
        let stored_file_id = wisespace_core::utils::gen_id();
        wisespace_core::repo::stored_file::create_stored_file(
            db,
            &stored_file_id,
            &saved.hash,
            name,
            mime_type,
            saved.size_bytes,
            &saved.storage_path,
            Some(conversation_id),
        )
        .await
        .map_err(|e| e.to_string())?;

        attachments.push(Attachment {
            id: stored_file_id,
            file_type: mime_type.to_string(),
            file_name: name.to_string(),
            file_path: saved.storage_path,
            file_size: saved.size_bytes as u64,
            data: None,
        });
    }

    Ok(attachments)
}

async fn ingest_assistant_message(
    db: &DatabaseConnection,
    conversation_id: &str,
    source_message_id: Option<&str>,
    content: &str,
    payload: &Value,
) -> Result<Message, String> {
    let attachments = save_inline_artifacts(db, conversation_id, payload).await?;
    wisespace_core::repo::message::create_message(
        db,
        conversation_id,
        MessageRole::Assistant,
        content,
        &attachments,
        source_message_id,
        0,
    )
    .await
    .map_err(|e| e.to_string())
}

// ── Core execution ──────────────────────────────────────────────────

async fn run_builtin_prompt_task(
    state: &AppState,
    task: &AgentTask,
    system_prompt: &str,
    user_prompt: String,
    mode: &str,
    task_type: &str,
    preset_key: &str,
    empty_content_message: &str,
    execution_error_prefix: &str,
) -> Result<DispatchExternalAgentTaskResult, String> {
    let conversation_id = task
        .conversation_id
        .as_deref()
        .ok_or_else(|| "Built-in subagent execution requires conversationId".to_string())?;
    let conversation =
        wisespace_core::repo::conversation::get_conversation(&state.sea_db, conversation_id)
            .await
            .map_err(|e| e.to_string())?;
    let settings = wisespace_core::repo::settings::get_settings(&state.sea_db)
        .await
        .map_err(|e| e.to_string())?;
    let provider =
        wisespace_core::repo::provider::get_provider(&state.sea_db, &conversation.provider_id)
            .await
            .map_err(|e| e.to_string())?;
    let key_row =
        wisespace_core::repo::provider::get_active_key(&state.sea_db, &conversation.provider_id)
            .await
            .map_err(|e| e.to_string())?;
    let decrypted_key =
        wisespace_core::crypto::decrypt_key(&key_row.key_encrypted, &state.master_key)
            .map_err(|e| e.to_string())?;
    let proxy = ProviderProxyConfig::resolve(&provider.proxy_config, &settings);
    let resolved_model = wisespace_core::repo::provider::get_model(
        &state.sea_db,
        &conversation.provider_id,
        &conversation.model_id,
    )
    .await
    .ok();
    let param_overrides = resolved_model
        .as_ref()
        .and_then(|model| model.param_overrides.clone());

    let mut chat_messages = Vec::new();
    if !param_overrides
        .as_ref()
        .and_then(|value| value.no_system_role)
        .unwrap_or(false)
    {
        chat_messages.push(ChatMessage {
            role: "system".to_string(),
            content: ChatContent::Text(system_prompt.to_string()),
            reasoning_content: None,
            tool_calls: None,
            tool_call_id: None,
        });
        chat_messages.push(ChatMessage {
            role: "user".to_string(),
            content: ChatContent::Text(user_prompt),
            reasoning_content: None,
            tool_calls: None,
            tool_call_id: None,
        });
    } else {
        chat_messages.push(ChatMessage {
            role: "user".to_string(),
            content: ChatContent::Text(format!("{}\n\n{}", system_prompt, user_prompt)),
            reasoning_content: None,
            tool_calls: None,
            tool_call_id: None,
        });
    }

    let request = ChatRequest {
        model: conversation.model_id.clone(),
        messages: chat_messages,
        stream: false,
        temperature: Some(0.2),
        top_p: Some(0.9),
        max_tokens: Some(1800),
        tools: None,
        thinking_budget: None,
        thinking_level: None,
        reasoning_profile: param_overrides
            .as_ref()
            .and_then(|value| value.reasoning_profile.clone()),
        use_max_completion_tokens: param_overrides
            .as_ref()
            .and_then(|value| value.use_max_completion_tokens),
        thinking_param_style: param_overrides
            .as_ref()
            .and_then(|value| value.thinking_param_style.clone()),
    };

    let ctx = ProviderRequestContext {
        api_key: decrypted_key,
        key_id: key_row.id.clone(),
        provider_id: provider.id.clone(),
        base_url: Some(resolve_base_url_for_type(
            &provider.api_host,
            &provider.provider_type,
        )),
        api_path: provider.api_path.clone(),
        proxy_config: proxy,
        custom_headers: provider
            .custom_headers
            .as_ref()
            .and_then(|raw| serde_json::from_str(raw).ok()),
    };

    let registry = ProviderRegistry::create_default();
    let adapter = registry
        .get(provider_type_to_registry_key(&provider.provider_type))
        .ok_or_else(|| "Provider adapter not found".to_string())?;
    let response = adapter
        .chat(&ctx, request)
        .await
        .map_err(|e| format!("{execution_error_prefix}: {e}"))?;
    let content = response.content.trim().to_string();
    if content.is_empty() {
        return Err(empty_content_message.to_string());
    }

    let result_payload = json!({
        "taskType": task_type,
        "presetKey": preset_key,
        "mode": mode,
        "content": content,
        "conversationId": conversation_id,
        "taskId": task.id,
    });
    let result_payload_json = serde_json::to_string(&result_payload).map_err(|e| e.to_string())?;
    let updated_task = wisespace_core::repo::external_agent::update_agent_task_result(
        &state.sea_db,
        &task.id,
        "completed",
        None,
        Some(result_payload_json.clone()),
        None,
    )
    .await
    .map_err(|e| e.to_string())?;
    let _ = wisespace_core::repo::external_agent::create_agent_task_event(
        &state.sea_db,
        &task.id,
        "completed",
        &result_payload_json,
    )
    .await;

    let assistant_message = ingest_assistant_message(
        &state.sea_db,
        conversation_id,
        task.source_message_id.as_deref(),
        &content,
        &result_payload,
    )
    .await?;
    let _ = wisespace_core::repo::external_agent::create_agent_task_event(
        &state.sea_db,
        &task.id,
        "ingested",
        &json!({ "messageId": assistant_message.id }).to_string(),
    )
    .await;

    Ok(DispatchExternalAgentTaskResult {
        task: updated_task,
        assistant_message: Some(assistant_message),
    })
}

async fn run_builtin_code_reviewer(
    state: &AppState,
    task: &AgentTask,
    input_text: &str,
    context: &Value,
) -> Result<DispatchExternalAgentTaskResult, String> {
    let conversation_id = task
        .conversation_id
        .as_deref()
        .ok_or_else(|| "Built-in subagent execution requires conversationId".to_string())?;
    let conversation =
        wisespace_core::repo::conversation::get_conversation(&state.sea_db, conversation_id)
            .await
            .map_err(|e| e.to_string())?;
    let recent_messages =
        wisespace_core::repo::message::list_messages(&state.sea_db, conversation_id)
            .await
            .map_err(|e| e.to_string())?;
    let recent_transcript =
        format_recent_messages_for_subagent(&recent_messages, task.source_message_id.as_deref());
    let user_prompt =
        build_builtin_review_prompt(&conversation, task, input_text, context, &recent_transcript);

    run_builtin_prompt_task(
        state,
        task,
        BUILTIN_CODE_REVIEWER_PROMPT,
        user_prompt,
        "builtin_review",
        "review",
        "code-reviewer",
        "Built-in code reviewer returned empty content",
        "Built-in code reviewer execution failed",
    )
    .await
}

async fn run_builtin_researcher(
    state: &AppState,
    task: &AgentTask,
    input_text: &str,
    context: &Value,
) -> Result<DispatchExternalAgentTaskResult, String> {
    let conversation_id = task
        .conversation_id
        .as_deref()
        .ok_or_else(|| "Built-in subagent execution requires conversationId".to_string())?;
    let conversation =
        wisespace_core::repo::conversation::get_conversation(&state.sea_db, conversation_id)
            .await
            .map_err(|e| e.to_string())?;
    let recent_messages =
        wisespace_core::repo::message::list_messages(&state.sea_db, conversation_id)
            .await
            .map_err(|e| e.to_string())?;
    let recent_transcript =
        format_recent_messages_for_subagent(&recent_messages, task.source_message_id.as_deref());
    let user_prompt =
        build_builtin_research_prompt(&conversation, task, input_text, context, &recent_transcript);

    run_builtin_prompt_task(
        state,
        task,
        BUILTIN_RESEARCHER_PROMPT,
        user_prompt,
        "builtin_research",
        "research",
        "researcher",
        "Built-in researcher returned empty content",
        "Built-in researcher execution failed",
    )
    .await
}

async fn run_delegated_subagent_task_inner(
    state: &AppState,
    task: AgentTask,
) -> Result<DispatchExternalAgentTaskResult, String> {
    if task.assignee_kind != "internal_subagent" {
        return Err("Only internal subagent tasks can be executed with this command".to_string());
    }

    let preset_key = task.preset_key.clone();
    let input_text = task
        .input_text
        .clone()
        .unwrap_or_else(|| task.title.clone());
    let context = parse_task_context_json(&task)?;

    let _ = wisespace_core::repo::external_agent::update_agent_task_result(
        &state.sea_db,
        &task.id,
        "running",
        None,
        None,
        None,
    )
    .await;
    let _ = wisespace_core::repo::external_agent::create_agent_task_event(
        &state.sea_db,
        &task.id,
        "execution_started",
        &json!({
            "taskType": task.task_type,
            "presetKey": preset_key,
        })
        .to_string(),
    )
    .await;

    let execution = match task.task_type.as_str() {
        "review" => run_builtin_code_reviewer(state, &task, &input_text, &context).await,
        "research" => run_builtin_researcher(state, &task, &input_text, &context).await,
        _ => Err(format!(
            "Built-in subagent taskType `{}` is not executable yet",
            task.task_type
        )),
    };

    match execution {
        Ok(result) => Ok(result),
        Err(error) => {
            let failed_task = wisespace_core::repo::external_agent::update_agent_task_result(
                &state.sea_db,
                &task.id,
                "failed",
                None,
                None,
                Some(error.clone()),
            )
            .await
            .map_err(|e| e.to_string())?;
            let _ = wisespace_core::repo::external_agent::create_agent_task_event(
                &state.sea_db,
                &task.id,
                "failed",
                &json!({ "error": error }).to_string(),
            )
            .await;
            Ok(DispatchExternalAgentTaskResult {
                task: failed_task,
                assistant_message: None,
            })
        }
    }
}

// ── Public API ──────────────────────────────────────────────────────

pub async fn maybe_auto_delegate_subtask(
    state: &AppState,
    input: AutoDelegatedSubtaskInput,
) -> Result<Option<DispatchExternalAgentTaskResult>, String> {
    let should_delegate = match input.task_type.as_str() {
        "review" => should_auto_delegate_review(&input.input_text),
        "research" => should_auto_delegate_research(&input.input_text),
        _ => false,
    };
    if !should_delegate {
        return Ok(None);
    }

    let existing_tasks = wisespace_core::repo::external_agent::list_agent_tasks(
        &state.sea_db,
        Some(input.conversation_id.as_str()),
        Some(&input.parent_run_id),
        None,
        None,
        Some(50),
    )
    .await
    .map_err(|e| e.to_string())?;
    if existing_tasks
        .iter()
        .any(|task| task.task_type == "review" && task.assignee_kind == "internal_subagent")
    {
        return Ok(None);
    }

    let task = wisespace_core::repo::external_agent::create_delegated_subagent_stub_task(
        &state.sea_db,
        Some(&input.conversation_id),
        &input.parent_run_id,
        None,
        input.source_message_id.as_deref(),
        &input.task_type,
        input.preset_key.as_deref(),
        Some(&input.delegation_reason),
        &input.title,
        &input.input_text,
        None,
    )
    .await
    .map_err(|e| e.to_string())?;

    let event_payload = json!({
        "parentRunId": input.parent_run_id,
        "taskType": input.task_type,
        "presetKey": input.preset_key,
        "delegationReason": input.delegation_reason,
        "title": input.title,
    })
    .to_string();
    let _ = wisespace_core::repo::external_agent::create_agent_task_event(
        &state.sea_db,
        &task.id,
        "delegation_planned",
        &event_payload,
    )
    .await;

    let result = run_delegated_subagent_task_inner(state, task).await?;
    Ok(Some(result))
}

// ── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub async fn list_builtin_subagent_assignees() -> Result<Vec<BuiltinSubagentAssignee>, String> {
    Ok(wisespace_core::repo::external_agent::list_builtin_subagent_assignees())
}

#[tauri::command]
pub async fn create_delegated_subagent_task(
    state: State<'_, AppState>,
    input: CreateDelegatedSubagentTaskInput,
) -> Result<AgentTask, String> {
    if input.parent_run_id.trim().is_empty() {
        return Err("parentRunId is required".to_string());
    }
    if input.task_type.trim().is_empty() {
        return Err("taskType is required".to_string());
    }
    if input.title.trim().is_empty() {
        return Err("title is required".to_string());
    }

    let task = wisespace_core::repo::external_agent::create_delegated_subagent_stub_task(
        &state.sea_db,
        input.conversation_id.as_deref(),
        &input.parent_run_id,
        input.parent_task_id.as_deref(),
        input.source_message_id.as_deref(),
        &input.task_type,
        input.preset_key.as_deref(),
        input.delegation_reason.as_deref(),
        &input.title,
        &input.input_text,
        input.context_json.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;

    let event_payload = json!({
        "parentRunId": input.parent_run_id,
        "parentTaskId": input.parent_task_id,
        "taskType": input.task_type,
        "presetKey": input.preset_key,
        "delegationReason": input.delegation_reason,
        "title": input.title,
    })
    .to_string();
    let _ = wisespace_core::repo::external_agent::create_agent_task_event(
        &state.sea_db,
        &task.id,
        "delegation_planned",
        &event_payload,
    )
    .await;

    Ok(task)
}

#[tauri::command]
pub async fn run_delegated_subagent_task(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<DispatchExternalAgentTaskResult, String> {
    let task = wisespace_core::repo::external_agent::get_agent_task(&state.sea_db, &task_id)
        .await
        .map_err(|e| e.to_string())?;
    run_delegated_subagent_task_inner(&state, task).await
}

#[tauri::command]
pub async fn list_agent_tasks(
    state: State<'_, AppState>,
    conversation_id: Option<String>,
    parent_run_id: Option<String>,
    parent_task_id: Option<String>,
    external_agent_id: Option<String>,
    limit: Option<u64>,
) -> Result<Vec<AgentTask>, String> {
    wisespace_core::repo::external_agent::list_agent_tasks(
        &state.sea_db,
        conversation_id.as_deref(),
        parent_run_id.as_deref(),
        parent_task_id.as_deref(),
        external_agent_id.as_deref(),
        limit,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_agent_task_events(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<Vec<AgentTaskEvent>, String> {
    wisespace_core::repo::external_agent::list_agent_task_events(&state.sea_db, &task_id)
        .await
        .map_err(|e| e.to_string())
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_recent_messages_for_subagent_prefers_source_window() {
        let messages = vec![
            Message {
                id: "m1".into(),
                conversation_id: "c1".into(),
                role: MessageRole::User,
                content: "first".into(),
                provider_id: None,
                model_id: None,
                token_count: None,
                prompt_tokens: None,
                completion_tokens: None,
                attachments: vec![],
                thinking: None,
                created_at: 1,
                parent_message_id: None,
                version_index: 0,
                is_active: true,
                tool_calls_json: None,
                tool_call_id: None,
                status: "".into(),
                tokens_per_second: None,
                first_token_latency_ms: None,
            },
            Message {
                id: "m2".into(),
                conversation_id: "c1".into(),
                role: MessageRole::Assistant,
                content: "second".into(),
                provider_id: None,
                model_id: None,
                token_count: None,
                prompt_tokens: None,
                completion_tokens: None,
                attachments: vec![],
                thinking: None,
                created_at: 2,
                parent_message_id: None,
                version_index: 0,
                is_active: true,
                tool_calls_json: None,
                tool_call_id: None,
                status: "".into(),
                tokens_per_second: None,
                first_token_latency_ms: None,
            },
            Message {
                id: "m3".into(),
                conversation_id: "c1".into(),
                role: MessageRole::User,
                content: "third".into(),
                provider_id: None,
                model_id: None,
                token_count: None,
                prompt_tokens: None,
                completion_tokens: None,
                attachments: vec![],
                thinking: None,
                created_at: 3,
                parent_message_id: None,
                version_index: 0,
                is_active: true,
                tool_calls_json: None,
                tool_call_id: None,
                status: "".into(),
                tokens_per_second: None,
                first_token_latency_ms: None,
            },
        ];

        let transcript = format_recent_messages_for_subagent(&messages, Some("m2"));
        assert!(transcript.contains("- assistant: second"));
        assert!(transcript.contains("- user: third"));
        assert!(!transcript.contains("- user: first"));
    }

    #[test]
    fn build_builtin_review_prompt_includes_context_and_messages() {
        let conversation = Conversation {
            id: "c1".into(),
            workspace_id: None,
            title: "Review workspace".into(),
            model_id: "m".into(),
            provider_id: "p".into(),
            system_prompt: None,
            temperature: None,
            max_tokens: None,
            top_p: None,
            frequency_penalty: None,
            search_enabled: false,
            search_provider_id: None,
            thinking_budget: None,
            thinking_level: None,
            enabled_mcp_server_ids: vec![],
            enabled_knowledge_base_ids: vec![],
            enabled_memory_namespace_ids: vec![],
            message_count: 0,
            is_pinned: false,
            is_archived: false,
            context_compression: false,
            category_id: None,
            parent_conversation_id: None,
            mode: "agent".into(),
            source: "local".into(),
            created_at: 0,
            updated_at: 0,
        };
        let task = AgentTask {
            id: "t1".into(),
            conversation_id: Some("c1".into()),
            workspace_id: None,
            parent_run_id: Some("run1".into()),
            parent_task_id: None,
            source_message_id: None,
            external_agent_id: "builtin-subagent:code-reviewer".into(),
            external_task_id: None,
            assignee_kind: "internal_subagent".into(),
            assignee_label: Some("Code Reviewer".into()),
            delegation_depth: 1,
            kind: "review".into(),
            task_type: "review".into(),
            preset_key: Some("code-reviewer".into()),
            delegation_reason: Some("主 Agent 识别为审查类任务".into()),
            input_text: Some("Please review the last change".into()),
            status: "planned".into(),
            title: "Review latest diff".into(),
            request_payload_json: "{}".into(),
            result_payload_json: None,
            error_message: None,
            created_at: 0,
            updated_at: 0,
        };

        let prompt = build_builtin_review_prompt(
            &conversation,
            &task,
            "Please review the last change",
            &json!({"changedFiles":["src/main.rs"]}),
            "- user: fix it",
        );
        assert!(prompt.contains("Conversation title: Review workspace"));
        assert!(prompt.contains("Please review the last change"));
        assert!(prompt.contains("changedFiles"));
        assert!(prompt.contains("- user: fix it"));
    }

    #[test]
    fn should_auto_delegate_review_matches_review_intents() {
        assert!(should_auto_delegate_review("请帮我审查这次改动"));
        assert!(should_auto_delegate_review("Can you review this patch?"));
        assert!(!should_auto_delegate_review("帮我实现一个登录页"));
    }
}
