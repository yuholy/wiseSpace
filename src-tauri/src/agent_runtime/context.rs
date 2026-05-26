use crate::agent_runtime::compat::{
    ensure_legacy_session_for_profile, provider_type_to_registry_key, resolve_agent_provider_id,
};
use crate::agent_runtime::planner::LocalAgentRunPlan;
use crate::agent_runtime::runner::AgentRunnerKind;
use crate::agent_runtime::runtime;
use crate::AppState;
use base64::Engine;
use std::path::Path;
use wisespace_core::repo::{agent_run, conversation, message, provider, settings};
use wisespace_core::types::{
    AgentProfile, AgentRun, AgentSession, AppSettings, Attachment, ChatContent, ChatMessage,
    ChatRequest, ContentPart, ImageUrl, MessageRole, Model, ModelCapability, ModelType,
    ProviderConfig,
};
use wisespace_providers::{
    registry::ProviderRegistry, resolve_base_url_for_type, ProviderRequestContext,
};

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

#[derive(Clone)]
struct MultimodalFallbackTarget {
    provider: ProviderConfig,
    model: Model,
    key_id: String,
    decrypted_key: String,
}

fn build_attachment_execution_prompt(prompt: &str, attachments: &[Attachment]) -> String {
    if attachments.is_empty() {
        return prompt.to_string();
    }

    let has_image_attachments = attachments
        .iter()
        .any(|attachment| attachment.file_type.starts_with("image/"));
    let has_embedded_image_analysis = prompt.contains("[Attached image analysis]");
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

    let visual_guidance = if has_image_attachments && has_embedded_image_analysis {
        "\n\nImportant: The uploaded image(s) have already been analyzed in the [Attached image analysis] block above. Treat that block as the authoritative visual description. Do not say you cannot inspect the image, and do not spend tools trying to OCR/open the image unless the user explicitly asks for raw-file verification."
    } else {
        ""
    };

    format!(
        "{prompt}{visual_guidance}\n\nAttached files uploaded with this message:\n{attachment_lines}\n\nIf you need the file contents, read them from the absolute_path values above."
    )
}

fn model_supports_vision(model: Option<&Model>) -> bool {
    model
        .map(|m| m.capabilities.contains(&ModelCapability::Vision))
        .unwrap_or(false)
}

pub fn model_id_probably_supports_vision(model_id: Option<&str>) -> bool {
    let Some(model_id) = model_id.map(str::to_lowercase) else {
        return false;
    };

    model_id.contains("vision")
        || model_id.contains("gpt-4o")
        || model_id.contains("gpt-4.1")
        || model_id.contains("claude-3")
        || model_id.contains("claude-sonnet-4")
        || model_id.contains("gemini")
        || model_id.contains("glm-4v")
        || model_id.contains("-vl")
        || model_id.contains("vl-")
        || model_id.contains("multimodal")
        || model_id.contains("omni")
}

fn model_supports_direct_image_understanding(model: Option<&Model>) -> bool {
    let Some(model) = model else {
        return false;
    };

    let id_supports_vision = model_id_probably_supports_vision(Some(&model.model_id));
    model_supports_vision(Some(model)) && id_supports_vision
}

fn model_probably_supports_vision(model: &Model) -> bool {
    model_supports_vision(Some(model)) || model_id_probably_supports_vision(Some(&model.model_id))
}

fn image_attachments_for_attachments<'a>(attachments: &'a [Attachment]) -> Vec<&'a Attachment> {
    attachments
        .iter()
        .filter(|attachment| attachment.file_type.starts_with("image/"))
        .collect()
}

fn build_multimodal_fallback_augmented_text(original: &str, analysis: &str) -> String {
    let header = "[Attached image analysis]";
    let guidance = "Use this analysis as the authoritative visual description for the uploaded image(s). Do not claim that you cannot inspect the image, and only inspect the raw file if the user explicitly asks for file-level verification.";
    if original.trim().is_empty() {
        format!("{header}\n{guidance}\n\n{analysis}")
    } else {
        format!("{original}\n\n{header}\n{guidance}\n\n{analysis}")
    }
}

async fn resolve_multimodal_fallback_target(
    state: &AppState,
    settings: &AppSettings,
) -> Result<Option<MultimodalFallbackTarget>, String> {
    if !settings.multimodal_fallback_enabled {
        return Ok(None);
    }

    let select_target = |provider: ProviderConfig, model: Model| async move {
        let key_row = wisespace_core::repo::provider::get_active_key(&state.sea_db, &provider.id)
            .await
            .map_err(|e| e.to_string())?;
        let decrypted_key =
            wisespace_core::crypto::decrypt_key(&key_row.key_encrypted, &state.master_key)
                .map_err(|e| e.to_string())?;
        Ok::<MultimodalFallbackTarget, String>(MultimodalFallbackTarget {
            provider,
            model,
            key_id: key_row.id,
            decrypted_key,
        })
    };

    let mut preferred_failure: Option<String> = None;

    if let (Some(provider_id), Some(model_id)) = (
        settings.multimodal_fallback_provider_id.as_deref(),
        settings.multimodal_fallback_model_id.as_deref(),
    ) {
        let real_provider_id =
            crate::commands::conversations::resolve_command_provider_id(&state.sea_db, provider_id)
                .await?;
        let provider =
            wisespace_core::repo::provider::get_provider(&state.sea_db, &real_provider_id)
                .await
                .map_err(|e| e.to_string())?;
        let model = provider
            .models
            .iter()
            .find(|candidate| candidate.model_id == model_id)
            .cloned()
            .ok_or_else(|| {
                format!(
                    "Configured multimodal fallback model {} was not found under provider {}",
                    model_id, provider.name
                )
            })?;
        match select_target(provider.clone(), model.clone()).await {
            Ok(target) => return Ok(Some(target)),
            Err(err) => {
                tracing::warn!(
                    "[agent multimodal fallback] configured provider/model unavailable: provider={} model={} error={}",
                    provider.name,
                    model.model_id,
                    err
                );
                preferred_failure = Some(format!(
                    "Configured multimodal fallback model {} under provider {} is unavailable: {}",
                    model.model_id, provider.name, err
                ));
            }
        }
    }

    let providers = wisespace_core::repo::provider::list_providers_merged(&state.sea_db)
        .await
        .map_err(|e| e.to_string())?;

    for provider in providers.into_iter().filter(|provider| provider.enabled) {
        let Some(model) = provider
            .models
            .iter()
            .find(|model| {
                model.enabled
                    && model.model_type == ModelType::Chat
                    && model_probably_supports_vision(model)
            })
            .cloned()
        else {
            continue;
        };

        if let Ok(target) = select_target(provider, model).await {
            return Ok(Some(target));
        }
    }

    if let Some(message) = preferred_failure {
        return Err(format!(
            "{}. No alternative enabled vision model with an active key was found.",
            message
        ));
    }

    Ok(None)
}

fn read_attachment_data_url(
    file_store: &wisespace_core::file_store::FileStore,
    attachment: &Attachment,
) -> Result<Option<String>, String> {
    if attachment.file_path.is_empty() {
        return Ok(attachment
            .data
            .as_ref()
            .map(|data| format!("data:{};base64,{}", attachment.file_type, data)));
    }

    let data = file_store
        .read_file(&attachment.file_path)
        .map_err(|e| format!("Failed to read attachment {}: {}", attachment.file_name, e))?;
    Ok(Some(format!(
        "data:{};base64,{}",
        attachment.file_type,
        base64::engine::general_purpose::STANDARD.encode(data)
    )))
}

pub async fn maybe_augment_prompt_with_multimodal_fallback(
    state: &AppState,
    settings: &AppSettings,
    prompt: &str,
    attachments: &[Attachment],
    current_model_supports_vision: bool,
) -> Result<String, String> {
    if current_model_supports_vision {
        return Ok(prompt.to_string());
    }

    let image_attachments = image_attachments_for_attachments(attachments);
    if image_attachments.is_empty() {
        return Ok(prompt.to_string());
    }

    let Some(target) = resolve_multimodal_fallback_target(state, settings).await? else {
        return Err(
            "Current model does not support image understanding, and no multimodal fallback model is configured or available."
                .to_string(),
        );
    };

    let mut parts = vec![ContentPart {
        r#type: "text".to_string(),
        text: Some(format!(
            "User request: {}\n\nAnalyze the attached image(s) for a downstream text-only agent. Return concise Markdown with sections: Summary, OCR, Key details, and Notes. If there are multiple images, separate them clearly.",
            if prompt.trim().is_empty() {
                "Please inspect the attached image(s)."
            } else {
                prompt.trim()
            }
        )),
        image_url: None,
    }];

    let file_store = wisespace_core::file_store::FileStore::new();
    for attachment in image_attachments {
        if let Some(data_url) = read_attachment_data_url(&file_store, attachment)? {
            parts.push(ContentPart {
                r#type: "image_url".to_string(),
                text: None,
                image_url: Some(ImageUrl { url: data_url }),
            });
        }
    }

    let request = ChatRequest {
        model: target.model.model_id.clone(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: ChatContent::Text(
                    "You are a vision analysis helper inside wiseSpace. Do not answer the user's request directly. Describe the attached image(s) so that a text-only agent can continue the task accurately."
                        .to_string(),
                ),
                reasoning_content: None,
                tool_calls: None,
                tool_call_id: None,
            },
            ChatMessage {
                role: "user".to_string(),
                content: ChatContent::Multipart(parts),
                reasoning_content: None,
                tool_calls: None,
                tool_call_id: None,
            },
        ],
        stream: false,
        temperature: Some(0.1),
        top_p: None,
        max_tokens: Some(1200),
        tools: None,
        thinking_budget: None,
        thinking_level: None,
        reasoning_profile: target
            .model
            .param_overrides
            .as_ref()
            .and_then(|overrides| overrides.reasoning_profile.clone()),
        use_max_completion_tokens: target
            .model
            .param_overrides
            .as_ref()
            .and_then(|overrides| overrides.use_max_completion_tokens),
        thinking_param_style: target
            .model
            .param_overrides
            .as_ref()
            .and_then(|overrides| overrides.thinking_param_style.clone()),
    };

    let ctx = ProviderRequestContext {
        api_key: target.decrypted_key.clone(),
        key_id: target.key_id.clone(),
        provider_id: target.provider.id.clone(),
        base_url: Some(resolve_base_url_for_type(
            &target.provider.api_host,
            &target.provider.provider_type,
        )),
        api_path: target.provider.api_path.clone(),
        proxy_config: wisespace_core::types::ProviderProxyConfig::resolve(
            &target.provider.proxy_config,
            settings,
        ),
        custom_headers: target
            .provider
            .custom_headers
            .as_ref()
            .and_then(|value| serde_json::from_str(value).ok()),
    };

    let registry = ProviderRegistry::create_default();
    let adapter = registry
        .get(provider_type_to_registry_key(
            &target.provider.provider_type,
        ))
        .ok_or_else(|| "Provider adapter not found for multimodal fallback model".to_string())?;

    let response = adapter
        .chat(&ctx, request)
        .await
        .map_err(|e| format!("Multimodal fallback request failed: {}", e))?;

    let analysis = response.content.trim().to_string();
    if analysis.is_empty() {
        return Err("Multimodal fallback model returned an empty image analysis.".to_string());
    }

    Ok(build_multimodal_fallback_augmented_text(prompt, &analysis))
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

    let prepared = async {
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
        let current_model = provider::get_model(&state.sea_db, &real_provider_id, &plan.model_id)
            .await
            .ok();
        let agent_prompt = maybe_augment_prompt_with_multimodal_fallback(
            state,
            &global_settings,
            &plan.prompt,
            &persisted_attachments,
            model_supports_direct_image_understanding(current_model.as_ref()),
        )
        .await?;
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

        Ok::<LocalAgentExecutionContext, String>(LocalAgentExecutionContext {
            profile,
            session,
            run: run.clone(),
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
            execution_prompt: build_attachment_execution_prompt(
                &agent_prompt,
                &persisted_attachments,
            ),
        })
    }
    .await;

    if let Err(error) = &prepared {
        let summary = format!("Agent setup failed before execution: {}", error);
        let _ =
            agent_run::update_run_status(&state.sea_db, &run.id, "failed", Some(&summary)).await;
    }

    prepared
}

#[cfg(test)]
mod tests {
    use super::{
        build_attachment_execution_prompt, build_multimodal_fallback_augmented_text,
        model_id_probably_supports_vision,
    };
    use wisespace_core::types::Attachment;

    #[test]
    fn vision_model_id_heuristic_matches_common_patterns() {
        assert!(model_id_probably_supports_vision(Some("qwen-vl-max")));
        assert!(model_id_probably_supports_vision(Some("gpt-4o-vision")));
        assert!(model_id_probably_supports_vision(Some("gpt-4o-mini")));
        assert!(model_id_probably_supports_vision(Some("gemini-2.0-flash")));
        assert!(model_id_probably_supports_vision(Some(
            "my-multimodal-model"
        )));
        assert!(!model_id_probably_supports_vision(Some(
            "deepseek-v4-flash"
        )));
        assert!(!model_id_probably_supports_vision(Some("deepseek-v3")));
        assert!(!model_id_probably_supports_vision(None));
    }

    #[test]
    fn fallback_analysis_appends_under_expected_header() {
        let augmented =
            build_multimodal_fallback_augmented_text("请帮我看图", "## Summary\n- 一张图表");
        assert!(augmented.contains("请帮我看图"));
        assert!(augmented.contains("[Attached image analysis]"));
        assert!(augmented.contains("authoritative visual description"));
        assert!(augmented.contains("## Summary"));
    }

    #[test]
    fn attachment_prompt_prefers_existing_image_analysis_over_tool_inspection() {
        let attachment = Attachment {
            id: "att-1".to_string(),
            file_name: "image.png".to_string(),
            file_type: "image/png".to_string(),
            file_size: 128,
            file_path: "images/example.png".to_string(),
            data: None,
        };
        let prompt = build_attachment_execution_prompt(
            "图片里是什么？\n\n[Attached image analysis]\nUse this analysis as the authoritative visual description.",
            &[attachment],
        );
        assert!(prompt.contains("Important: The uploaded image(s) have already been analyzed"));
        assert!(prompt.contains("do not spend tools trying to OCR/open the image"));
    }
}
