use serde::{Deserialize, Serialize};

use wisespace_core::types::AttachmentInput;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAgentRunRequest {
    pub conversation_id: String,
    pub prompt: String,
    #[serde(default)]
    pub attachments: Vec<AttachmentInput>,
    pub provider_id: String,
    pub model_id: String,
    pub cwd: Option<String>,
    pub permission_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAgentContextNeeds {
    pub conversation: bool,
    pub workspace: bool,
    pub knowledge: bool,
    pub memory: bool,
    pub files: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalAgentRunPlan {
    pub conversation_id: String,
    pub prompt: String,
    pub attachments: Vec<AttachmentInput>,
    pub provider_id: String,
    pub model_id: String,
    pub cwd: Option<String>,
    pub permission_mode: Option<String>,
    pub should_execute_agent: bool,
    pub requires_confirmation: bool,
    pub execution_intent: String,
    pub context_needs: LocalAgentContextNeeds,
}

pub fn build_local_agent_plan(
    request: LocalAgentRunRequest,
) -> Result<LocalAgentRunPlan, String> {
    let prompt = request.prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("Agent prompt is required".to_string());
    }

    Ok(LocalAgentRunPlan {
        conversation_id: request.conversation_id,
        prompt,
        attachments: request.attachments,
        provider_id: request.provider_id,
        model_id: request.model_id,
        cwd: request.cwd,
        permission_mode: request.permission_mode,
        should_execute_agent: true,
        requires_confirmation: false,
        execution_intent: "local_agent".to_string(),
        context_needs: LocalAgentContextNeeds {
            conversation: true,
            workspace: true,
            knowledge: true,
            memory: true,
            files: true,
        },
    })
}
