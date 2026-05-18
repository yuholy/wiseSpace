use crate::agent_runtime::compat::{ensure_legacy_session_for_profile, resolve_agent_provider_id};
use crate::agent_runtime::planner::LocalAgentRunPlan;
use crate::agent_runtime::runner::AgentRunnerKind;
use crate::agent_runtime::runtime;
use crate::AppState;
use std::path::Path;
use wisespace_core::repo::{conversation, message, provider, settings};
use wisespace_core::types::{
    AgentProfile, AgentRun, AgentSession, AppSettings, Attachment, MessageRole, ProviderConfig,
};
use wisespace_providers::{resolve_base_url_for_type, ProviderRequestContext};

pub struct LocalAgentExecutionContext {
    pub profile: AgentProfile,
    pub session: AgentSession,
    pub run: AgentRun,
    pub conversation: wisespace_core::types::Conversation,
    pub provider: ProviderConfig,
    pub real_provider_id: String,
    pub request_context: ProviderRequestContext,
    pub title_context: ProviderRequestContext,
    pub user_message_id: String,
    pub user_message_created_at: i64,
    pub effective_cwd: String,
    pub is_first_message: bool,
    pub global_settings: AppSettings,
    pub execution_prompt: String,
}

fn build_attachment_execution_prompt(prompt: &str, attachments: &[Attachment]) -> String {
    if attachments.is_empty() {
        return prompt.to_string();
    }

    let attachment_lines = attachments
        .iter()
        .map(|attachment| {
            let absolute_path = wisespace_core::storage_paths::resolve_documents_path(
                &attachment.file_path,
            );
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

pub async fn prepare_local_agent_execution_context(
    state: &AppState,
    plan: &LocalAgentRunPlan,
) -> Result<LocalAgentExecutionContext, String> {
    let profile = crate::agent_runtime::profile::update_profile_from_legacy_inputs(
        &state.sea_db,
        &plan.conversation_id,
        plan.cwd.as_deref(),
        plan.permission_mode.as_deref(),
    )
    .await?;
    let session = ensure_legacy_session_for_profile(&state.sea_db, &profile).await?;

    let effective_cwd = session
        .cwd
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or("Agent workspace is required before starting wiseSpace Local".to_string())?;
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

    runtime::ensure_no_active_run(&state.sea_db, &plan.conversation_id).await?;

    let real_provider_id = resolve_agent_provider_id(&state.sea_db, &plan.provider_id).await?;

    let run = match runtime::start_run(
        &state.sea_db,
        &plan.conversation_id,
        AgentRunnerKind::Sdk,
        &plan.prompt,
        Some(&plan.provider_id),
        Some(&plan.model_id),
        session.sdk_context_json.as_deref(),
    )
    .await
    {
        Ok((_, run)) => run,
        Err(err) => return Err(err),
    };

    let persisted_attachments = crate::commands::conversations::persist_attachments(
        state,
        &plan.conversation_id,
        &plan.attachments,
    )
    .await
    .map_err(|e| e.to_string())?;

    let user_message = message::create_message(
        &state.sea_db,
        &plan.conversation_id,
        MessageRole::User,
        &plan.prompt,
        &persisted_attachments,
        None,
        0,
    )
    .await
    .map_err(|e| e.to_string())?;

    let conv = conversation::get_conversation(&state.sea_db, &plan.conversation_id)
        .await
        .map_err(|e| e.to_string())?;
    let is_first_message = conv.message_count <= 1;

    conversation::increment_message_count(&state.sea_db, &plan.conversation_id)
        .await
        .map_err(|e| e.to_string())?;

    let prov = provider::get_provider(&state.sea_db, &real_provider_id)
        .await
        .map_err(|e| e.to_string())?;
    let key_row = provider::get_active_key(&state.sea_db, &real_provider_id)
        .await
        .map_err(|e| e.to_string())?;
    let decrypted_key =
        wisespace_core::crypto::decrypt_key(&key_row.key_encrypted, &state.master_key)
            .map_err(|e| e.to_string())?;

    let global_settings = settings::get_settings(&state.sea_db)
        .await
        .unwrap_or_default();
    let resolved_proxy = wisespace_core::types::ProviderProxyConfig::resolve(
        &prov.proxy_config,
        &global_settings,
    );
    let request_context = ProviderRequestContext {
        api_key: decrypted_key,
        key_id: key_row.id.clone(),
        provider_id: prov.id.clone(),
        base_url: Some(resolve_base_url_for_type(
            &prov.api_host,
            &prov.provider_type,
        )),
        api_path: prov.api_path.clone(),
        proxy_config: resolved_proxy,
        custom_headers: prov
            .custom_headers
            .as_ref()
            .and_then(|s| serde_json::from_str(s).ok()),
    };

    Ok(LocalAgentExecutionContext {
        profile,
        session,
        run,
        conversation: conv,
        provider: prov,
        real_provider_id,
        title_context: request_context.clone(),
        request_context,
        user_message_id: user_message.id,
        user_message_created_at: user_message.created_at,
        effective_cwd,
        is_first_message,
        global_settings,
        execution_prompt: build_attachment_execution_prompt(&plan.prompt, &persisted_attachments),
    })
}
