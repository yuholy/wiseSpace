use crate::agent_runtime::payloads::{AgentDonePayload, AgentUsagePayload};
use tauri::Emitter;
use wisespace_core::repo::{agent_run, conversation, message};
use wisespace_core::types::MessageRole;

pub fn build_final_agent_content(
    accumulated_text: &str,
    in_thinking_block: bool,
    result_text: &str,
) -> String {
    let mut final_content = accumulated_text.to_string();
    if in_thinking_block {
        final_content.push_str("\n</think>\n\n");
    }
    if !result_text.is_empty() && !accumulated_text.contains(result_text) {
        final_content.push_str(result_text);
    }
    final_content
}

pub async fn persist_final_agent_message(
    db: &sea_orm::DatabaseConnection,
    conversation_id: &str,
    user_message_id: &str,
    assistant_message_id: &mut Option<String>,
    final_content: &str,
) -> Result<(), String> {
    if final_content.is_empty() {
        return Ok(());
    }

    if let Some(mid) = assistant_message_id.as_ref() {
        message::update_message_content(db, mid, final_content)
            .await
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    let assist_msg = message::create_message(
        db,
        conversation_id,
        MessageRole::Assistant,
        final_content,
        &[],
        Some(user_message_id),
        0,
    )
    .await
    .map_err(|e| e.to_string())?;
    *assistant_message_id = Some(assist_msg.id.clone());
    conversation::increment_message_count(db, conversation_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn persist_usage(
    db: &sea_orm::DatabaseConnection,
    assistant_message_id: Option<&str>,
    usage: Option<&open_agent_sdk::Usage>,
) -> Result<(), String> {
    if let (Some(mid), Some(usage)) = (assistant_message_id, usage) {
        message::update_message_usage(
            db,
            mid,
            Some(usage.input_tokens as i64),
            Some(usage.output_tokens as i64),
        )
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub async fn finish_run_with_result(
    app: &tauri::AppHandle,
    db: &sea_orm::DatabaseConnection,
    run: &wisespace_core::types::AgentRun,
    assistant_message_id: Option<&str>,
    final_content: &str,
    accumulated_thinking: &str,
    model_id: &str,
    final_usage: Option<&open_agent_sdk::Usage>,
    num_turns: u32,
    cost_usd: f64,
    sdk_context_json: Option<&str>,
) -> Result<(), String> {
    let usage_payload = final_usage.map(|u| AgentUsagePayload {
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
    });
    let token_usage_json = final_usage.map(|u| {
        serde_json::json!({
            "input_tokens": u.input_tokens,
            "output_tokens": u.output_tokens,
            "total_tokens": u.input_tokens + u.output_tokens,
        })
        .to_string()
    });

    app.emit(
        "agent-done",
        AgentDonePayload {
            conversation_id: run.conversation_id.clone(),
            assistant_message_id: assistant_message_id.unwrap_or_default().to_string(),
            text: final_content.to_string(),
            thinking: Some(accumulated_thinking.to_string()).filter(|value| !value.trim().is_empty()),
            model: Some(model_id.to_string()),
            session_id: None,
            usage: usage_payload.clone(),
            num_turns: Some(num_turns),
            cost_usd: Some(cost_usd),
        },
    )
    .map_err(|e| e.to_string())?;

    agent_run::finish_run(
        db,
        &run.id,
        "completed",
        sdk_context_json,
        token_usage_json.as_deref(),
        cost_usd,
        None,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
