use sea_orm::DatabaseConnection;
use wisespace_core::types::Conversation;

pub const ROLE_PROMPT_START_PREFIX: &str = "<!-- wisespace-role:start";
pub const ROLE_PROMPT_END: &str = "<!-- wisespace-role:end -->";

fn join_prompt_parts(parts: &[Option<String>]) -> Option<String> {
    let joined = parts
        .iter()
        .filter_map(|part| part.as_ref())
        .map(|part| part.trim())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");

    if joined.trim().is_empty() {
        None
    } else {
        Some(joined)
    }
}

fn split_role_prompt_sections(raw: &str) -> Option<(String, String)> {
    let start_index = raw.find(ROLE_PROMPT_START_PREFIX)?;
    let header_relative_end = raw[start_index..].find("-->")?;
    let header_end_index = start_index + header_relative_end + 3;
    let end_relative_index = raw[header_end_index..].find(ROLE_PROMPT_END)?;
    let end_index = header_end_index + end_relative_index;

    let role_prompt = raw[header_end_index..end_index].trim().to_string();
    let before = raw[..start_index].trim().to_string();
    let after = raw[end_index + ROLE_PROMPT_END.len()..].trim().to_string();
    let extra_prompt = join_prompt_parts(&[
        (!before.is_empty()).then_some(before),
        (!after.is_empty()).then_some(after),
    ])
    .unwrap_or_default();

    Some((role_prompt, extra_prompt))
}

async fn resolve_base_system_prompt(
    db: &DatabaseConnection,
    conversation: &Conversation,
) -> Option<String> {
    if let Some(ref cat_id) = conversation.category_id {
        if let Ok(categories) =
            wisespace_core::repo::conversation_category::list_conversation_categories(db).await
        {
            if let Some(cat) = categories.iter().find(|c| &c.id == cat_id) {
                if let Some(ref prompt) = cat.system_prompt {
                    if !prompt.trim().is_empty() {
                        return Some(prompt.clone());
                    }
                }
            }
        }
    }

    let settings = wisespace_core::repo::settings::get_settings(db)
        .await
        .unwrap_or_default();
    settings
        .default_system_prompt
        .filter(|prompt| !prompt.trim().is_empty())
}

pub async fn resolve_effective_system_prompt(
    db: &DatabaseConnection,
    conversation: &Conversation,
) -> Option<String> {
    if let Some(raw_prompt) = conversation
        .system_prompt
        .as_ref()
        .map(|prompt| prompt.trim())
        .filter(|prompt| !prompt.is_empty())
    {
        if let Some((role_prompt, extra_prompt)) = split_role_prompt_sections(raw_prompt) {
            return join_prompt_parts(&[
                resolve_base_system_prompt(db, conversation).await,
                (!role_prompt.trim().is_empty()).then_some(role_prompt),
                (!extra_prompt.trim().is_empty()).then_some(extra_prompt),
            ]);
        }

        return Some(raw_prompt.to_string());
    }

    resolve_base_system_prompt(db, conversation).await
}
