use serde_json::json;
use tauri::State;
use wisespace_core::types::*;
use wisespace_providers::{
    registry::ProviderRegistry, resolve_base_url_for_type, ProviderRequestContext,
};

use crate::external_agents::context::collect_context as collect_external_context;
use crate::external_agents::custom_http::parse_json_object;
use crate::external_agents::registry::{
    dispatch_task as dispatch_connector_task, fetch_task as fetch_connector_task,
    test_connection as test_connector_connection,
};
use crate::external_agents::result_ingest::ingest_assistant_message;
use crate::AppState;

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

fn build_builtin_review_prompt(
    conversation: &Conversation,
    task: &AgentTask,
    input_text: &str,
    context: &serde_json::Value,
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
        concat!(
            "Conversation title: {conversation_title}\n",
            "Task title: {task_title}\n",
            "Task type: {task_kind}\n\n",
            "Delegation request:\n{input_text}\n\n",
            "Extra context (JSON):\n{context_block}\n\n",
            "Recent conversation messages:\n{recent_messages_block}",
        ),
        conversation_title = conversation.title,
        task_title = task.title,
        task_kind = task.kind,
        input_text = input_text.trim(),
        context_block = context_block,
        recent_messages_block = recent_messages_block,
    )
}

fn build_builtin_research_prompt(
    conversation: &Conversation,
    task: &AgentTask,
    input_text: &str,
    context: &serde_json::Value,
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
        concat!(
            "Conversation title: {conversation_title}\n",
            "Task title: {task_title}\n",
            "Task type: {task_kind}\n\n",
            "Research request:\n{input_text}\n\n",
            "Extra context (JSON):\n{context_block}\n\n",
            "Recent conversation messages:\n{recent_messages_block}",
        ),
        conversation_title = conversation.title,
        task_title = task.title,
        task_kind = task.kind,
        input_text = input_text.trim(),
        context_block = context_block,
        recent_messages_block = recent_messages_block,
    )
}

fn parse_task_context_json(task: &AgentTask) -> Result<serde_json::Value, String> {
    let request_payload = parse_json_object(Some(&task.request_payload_json), json!({}))?;
    Ok(request_payload
        .get("contextJson")
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .map(|value| parse_json_object(Some(value), json!(value)))
        .transpose()?
        .unwrap_or_else(|| json!({})))
}

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
    .await
    .map_err(|e| e.to_string())?;
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
    context: &serde_json::Value,
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
    context: &serde_json::Value,
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

async fn dispatch_task_from_parts(
    state: &AppState,
    agent: &ExternalAgent,
    conversation_id: Option<&str>,
    parent_run_id: Option<&str>,
    parent_task_id: Option<&str>,
    source_message_id: Option<&str>,
    kind: &str,
    title: &str,
    input_text: &str,
    assignee_label: Option<&str>,
    context: serde_json::Value,
) -> Result<DispatchExternalAgentTaskResult, String> {
    let capabilities = parse_json_object(Some(&agent.capabilities_json), json!({}))?;
    let request_payload = json!({
        "kind": kind,
        "title": title,
        "inputText": input_text,
        "context": context,
        "capabilities": capabilities,
    });
    let request_payload_json =
        serde_json::to_string(&request_payload).map_err(|e| e.to_string())?;
    let effective_source_message_id = match (conversation_id, source_message_id) {
        (Some(conversation_id), None) => Some(
            wisespace_core::repo::message::create_message(
                &state.sea_db,
                conversation_id,
                MessageRole::User,
                input_text,
                &[],
                None,
                0,
            )
            .await
            .map_err(|e| e.to_string())?
            .id,
        ),
        (_, Some(existing)) => Some(existing.to_string()),
        _ => None,
    };
    let task = wisespace_core::repo::external_agent::create_agent_task(
        &state.sea_db,
        conversation_id,
        parent_run_id,
        parent_task_id,
        effective_source_message_id.as_deref(),
        &agent.id,
        "external_agent",
        assignee_label,
        kind,
        "dispatching",
        title,
        &request_payload_json,
    )
    .await
    .map_err(|e| e.to_string())?;
    let task_payload = json!({
        "id": task.id,
        "conversationId": conversation_id,
        "parentRunId": parent_run_id,
        "parentTaskId": parent_task_id,
        "sourceMessageId": effective_source_message_id.clone(),
        "kind": kind,
        "title": title,
        "assigneeLabel": assignee_label,
        "input": { "text": input_text },
        "context": request_payload["context"].clone(),
        "createdAt": task.created_at,
    });

    let _ = wisespace_core::repo::external_agent::create_agent_task_event(
        &state.sea_db,
        &task.id,
        "created",
        &request_payload_json,
    )
    .await;

    match dispatch_connector_task(agent, &task, task_payload).await {
        Ok(response) => {
            let result_payload_json =
                serde_json::to_string(&response.result_payload).map_err(|e| e.to_string())?;
            let updated_task = wisespace_core::repo::external_agent::update_agent_task_result(
                &state.sea_db,
                &task.id,
                &response.status,
                response.external_task_id,
                Some(result_payload_json.clone()),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
            let _ = wisespace_core::repo::external_agent::create_agent_task_event(
                &state.sea_db,
                &task.id,
                &response.status,
                &result_payload_json,
            )
            .await;

            let assistant_message = match (conversation_id, response.assistant_content.as_deref()) {
                (Some(conversation_id), Some(content)) if !content.trim().is_empty() => Some(
                    ingest_assistant_message(
                        &state.sea_db,
                        conversation_id,
                        effective_source_message_id.as_deref(),
                        content,
                        &response.result_payload,
                    )
                    .await
                    .map_err(|e| e.to_string())?,
                ),
                _ => None,
            };

            Ok(DispatchExternalAgentTaskResult {
                task: updated_task,
                assistant_message,
            })
        }
        Err(error) => {
            let updated_task = wisespace_core::repo::external_agent::update_agent_task_result(
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
                task: updated_task,
                assistant_message: None,
            })
        }
    }
}

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

#[tauri::command]
pub async fn list_external_agents(
    state: State<'_, AppState>,
) -> Result<Vec<ExternalAgent>, String> {
    wisespace_core::repo::external_agent::list_external_agents(&state.sea_db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_builtin_subagent_assignees() -> Result<Vec<BuiltinSubagentAssignee>, String> {
    Ok(wisespace_core::repo::external_agent::list_builtin_subagent_assignees())
}

#[tauri::command]
pub async fn create_external_agent(
    state: State<'_, AppState>,
    input: CreateExternalAgentInput,
) -> Result<ExternalAgent, String> {
    parse_json_object(input.capabilities_json.as_deref(), json!({}))?;
    if input
        .auth_config_json
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        parse_json_object(input.auth_config_json.as_deref(), json!({}))?;
    }
    wisespace_core::repo::external_agent::create_external_agent(&state.sea_db, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_external_agent(
    state: State<'_, AppState>,
    id: String,
    input: UpdateExternalAgentInput,
) -> Result<ExternalAgent, String> {
    if let Some(raw) = input.capabilities_json.as_deref() {
        parse_json_object(Some(raw), json!({}))?;
    }
    if let Some(Some(raw)) = input.auth_config_json.as_ref() {
        if !raw.trim().is_empty() {
            parse_json_object(Some(raw), json!({}))?;
        }
    }
    wisespace_core::repo::external_agent::update_external_agent(&state.sea_db, &id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_external_agent(state: State<'_, AppState>, id: String) -> Result<(), String> {
    wisespace_core::repo::external_agent::delete_external_agent(&state.sea_db, &id)
        .await
        .map_err(|e| e.to_string())
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

#[tauri::command]
pub async fn test_external_agent_connection(
    state: State<'_, AppState>,
    id: String,
) -> Result<ExternalAgentConnectionTestResult, String> {
    let agent = wisespace_core::repo::external_agent::get_external_agent(&state.sea_db, &id)
        .await
        .map_err(|e| e.to_string())?;

    // Auto-launch pi adapter for connection test.
    if agent.kind == "pi_adapter" {
        state
            .pi_adapter
            .lock()
            .await
            .ensure_running()
            .await
            .map_err(|e| format!("Failed to start pi adapter: {}", e))?;
    }

    test_connector_connection(&agent).await
}

#[tauri::command]
pub async fn dispatch_external_agent_task(
    state: State<'_, AppState>,
    input: DispatchExternalAgentTaskInput,
) -> Result<DispatchExternalAgentTaskResult, String> {
    if input.external_agent_id.trim().is_empty() {
        return Err("externalAgentId is required".to_string());
    }
    if input.title.trim().is_empty() {
        return Err("title is required".to_string());
    }

    let agent = wisespace_core::repo::external_agent::get_external_agent(
        &state.sea_db,
        &input.external_agent_id,
    )
    .await
    .map_err(|e| e.to_string())?;
    let parsed_context = parse_json_object(input.context_json.as_deref(), json!({}))?;
    let mut context = if parsed_context.is_object() {
        parsed_context
    } else {
        json!({ "inputContext": parsed_context })
    };
    let auto_context = collect_external_context(&state, &input.input_text).await;
    if !auto_context
        .as_object()
        .map(|value| value.is_empty())
        .unwrap_or(true)
    {
        context["wisespaceContext"] = auto_context;
    }

    // Auto-launch pi adapter sidecar if not already running.
    if agent.kind == "pi_adapter" {
        state
            .pi_adapter
            .lock()
            .await
            .ensure_running()
            .await
            .map_err(|e| format!("Failed to start pi adapter: {}", e))?;
    }

    dispatch_task_from_parts(
        &state,
        &agent,
        input.conversation_id.as_deref(),
        input.parent_run_id.as_deref(),
        input.parent_task_id.as_deref(),
        input.source_message_id.as_deref(),
        input.kind.as_deref().unwrap_or("general"),
        &input.title,
        &input.input_text,
        input.assignee_label.as_deref(),
        context,
    )
    .await
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
pub async fn retry_external_agent_task(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<DispatchExternalAgentTaskResult, String> {
    let task = wisespace_core::repo::external_agent::get_agent_task(&state.sea_db, &task_id)
        .await
        .map_err(|e| e.to_string())?;
    let agent = wisespace_core::repo::external_agent::get_external_agent(
        &state.sea_db,
        &task.external_agent_id,
    )
    .await
    .map_err(|e| e.to_string())?;
    let request_payload = parse_json_object(Some(&task.request_payload_json), json!({}))?;
    let kind = request_payload
        .get("kind")
        .and_then(|value| value.as_str())
        .unwrap_or(task.kind.as_str())
        .to_string();
    let title = request_payload
        .get("title")
        .and_then(|value| value.as_str())
        .unwrap_or(task.title.as_str())
        .to_string();
    let input_text = request_payload
        .get("inputText")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "request payload is missing inputText".to_string())?
        .to_string();
    let context = request_payload
        .get("context")
        .cloned()
        .unwrap_or_else(|| json!({}));

    let _ = wisespace_core::repo::external_agent::create_agent_task_event(
        &state.sea_db,
        &task.id,
        "retry_requested",
        &json!({
            "sourceTaskId": task.id,
            "status": task.status,
        })
        .to_string(),
    )
    .await;

    // Auto-launch pi adapter before retry.
    if agent.kind == "pi_adapter" {
        state
            .pi_adapter
            .lock()
            .await
            .ensure_running()
            .await
            .map_err(|e| format!("Failed to start pi adapter: {}", e))?;
    }

    let result = dispatch_task_from_parts(
        &state,
        &agent,
        task.conversation_id.as_deref(),
        task.parent_run_id.as_deref(),
        task.parent_task_id.as_deref(),
        task.source_message_id.as_deref(),
        &kind,
        &title,
        &input_text,
        task.assignee_label.as_deref(),
        context,
    )
    .await?;

    let _ = wisespace_core::repo::external_agent::create_agent_task_event(
        &state.sea_db,
        &task.id,
        "retried",
        &json!({
            "newTaskId": result.task.id,
            "newStatus": result.task.status,
        })
        .to_string(),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn sync_external_agent_task(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<DispatchExternalAgentTaskResult, String> {
    let task = wisespace_core::repo::external_agent::get_agent_task(&state.sea_db, &task_id)
        .await
        .map_err(|e| e.to_string())?;
    let agent = wisespace_core::repo::external_agent::get_external_agent(
        &state.sea_db,
        &task.external_agent_id,
    )
    .await
    .map_err(|e| e.to_string())?;
    let external_task_id = task
        .external_task_id
        .clone()
        .unwrap_or_else(|| task.id.clone());

    let _ = wisespace_core::repo::external_agent::create_agent_task_event(
        &state.sea_db,
        &task.id,
        "sync_requested",
        &json!({ "externalTaskId": external_task_id }).to_string(),
    )
    .await;

    // Auto-launch pi adapter before sync.
    if agent.kind == "pi_adapter" {
        state
            .pi_adapter
            .lock()
            .await
            .ensure_running()
            .await
            .map_err(|e| format!("Failed to start pi adapter: {}", e))?;
    }

    let response = fetch_connector_task(&agent, &external_task_id)
        .await
        .map_err(|e| e.to_string())?;
    let result_payload_json =
        serde_json::to_string(&response.result_payload).map_err(|e| e.to_string())?;
    let updated_task = wisespace_core::repo::external_agent::update_agent_task_result(
        &state.sea_db,
        &task.id,
        &response.status,
        response.external_task_id.clone(),
        Some(result_payload_json.clone()),
        None,
    )
    .await
    .map_err(|e| e.to_string())?;

    let _ = wisespace_core::repo::external_agent::create_agent_task_event(
        &state.sea_db,
        &task.id,
        &response.status,
        &result_payload_json,
    )
    .await;

    let task_events =
        wisespace_core::repo::external_agent::list_agent_task_events(&state.sea_db, &task.id)
            .await
            .map_err(|e| e.to_string())?;
    let already_ingested = task_events
        .iter()
        .any(|event| event.event_type == "ingested");

    let assistant_message = match (
        updated_task.conversation_id.as_deref(),
        updated_task.source_message_id.as_deref(),
        response.assistant_content.as_deref(),
        updated_task.status.as_str(),
        already_ingested,
    ) {
        (Some(conversation_id), source_message_id, Some(content), "completed", false)
            if !content.trim().is_empty() =>
        {
            let message = ingest_assistant_message(
                &state.sea_db,
                conversation_id,
                source_message_id,
                content,
                &response.result_payload,
            )
            .await
            .map_err(|e| e.to_string())?;
            let _ = wisespace_core::repo::external_agent::create_agent_task_event(
                &state.sea_db,
                &task.id,
                "ingested",
                &json!({ "messageId": message.id }).to_string(),
            )
            .await;
            Some(message)
        }
        _ => None,
    };

    Ok(DispatchExternalAgentTaskResult {
        task: updated_task,
        assistant_message,
    })
}

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
