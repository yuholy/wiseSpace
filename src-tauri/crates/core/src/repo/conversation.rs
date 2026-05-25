use sea_orm::*;
use serde_json;
use std::collections::HashSet;

use crate::entity::{conversation_summaries, conversations, messages};
use crate::error::{Result, WiseSpaceError};
use crate::types::{
    ContextToggleState, Conversation, ConversationSearchResult, ConversationSummary,
    ConversationWorkspaceSnapshot, KnowledgeBinding, MemoryPolicy, SearchPolicy, ToolBinding,
    UpdateConversationInput, UpdateConversationWorkspaceSnapshotInput,
};
use crate::utils::{gen_id, now_ts};

fn conversation_from_entity(m: conversations::Model) -> Conversation {
    Conversation {
        id: m.id,
        workspace_id: m.workspace_id,
        title: m.title,
        model_id: m.model_id,
        provider_id: m.provider_id,
        system_prompt: m.system_prompt,
        temperature: m.temperature.map(|v| v as f32),
        max_tokens: m.max_tokens.map(|v| v as u32),
        top_p: m.top_p.map(|v| v as f32),
        frequency_penalty: m.frequency_penalty.map(|v| v as f32),
        search_enabled: m.search_enabled != 0,
        search_provider_id: m.search_provider_id,
        thinking_budget: m.thinking_budget,
        thinking_level: m.thinking_level,
        enabled_mcp_server_ids: parse_string_list(&m.enabled_mcp_server_ids),
        enabled_knowledge_base_ids: parse_string_list(&m.enabled_knowledge_base_ids),
        enabled_memory_namespace_ids: parse_string_list(&m.enabled_memory_namespace_ids),
        message_count: m.message_count as u32,
        is_pinned: m.is_pinned != 0,
        is_archived: m.is_archived != 0,
        context_compression: m.context_compression != 0,
        category_id: m.category_id,
        parent_conversation_id: m.parent_conversation_id,
        mode: m.mode,
        source: m.source,
        created_at: m.created_at,
        updated_at: m.updated_at,
    }
}

fn parse_string_list(raw: &str) -> Vec<String> {
    serde_json::from_str(raw)
        .expect("conversation preference JSON is invalid; database contents are corrupted")
}

fn stringify_string_list(values: &[String]) -> String {
    serde_json::to_string(values).expect("failed to serialize conversation preference JSON")
}

pub fn default_workspace_snapshot() -> ConversationWorkspaceSnapshot {
    ConversationWorkspaceSnapshot {
        search_policy: SearchPolicy {
            enabled: false,
            search_provider_id: None,
            query_mode: "manual".to_string(),
            result_limit: 10,
        },
        tool_binding: ToolBinding {
            server_ids: Vec::new(),
            default_tools: None,
            approval_mode: "ask".to_string(),
        },
        knowledge_binding: KnowledgeBinding {
            knowledge_base_ids: Vec::new(),
            auto_attach: false,
        },
        memory_policy: MemoryPolicy {
            enabled: false,
            namespace_id: None,
            write_back: false,
        },
        toggles: ContextToggleState {
            search_enabled: false,
            search_provider_id: None,
            enabled_knowledge_base_ids: Vec::new(),
            enabled_mcp_server_ids: Vec::new(),
            enabled_tool_names: None,
            memory_enabled: false,
            memory_namespace_id: None,
            memory_write_back: false,
            disabled_context_source_ids: None,
        },
        research_mode: false,
        pinned_artifact_ids: Vec::new(),
    }
}

fn parse_workspace_snapshot_json(raw: &str) -> ConversationWorkspaceSnapshot {
    if raw.trim().is_empty() {
        return default_workspace_snapshot();
    }

    serde_json::from_str(raw).unwrap_or_else(|_| default_workspace_snapshot())
}

fn project_workspace_snapshot(
    row: &conversations::Model,
    persisted: Option<ConversationWorkspaceSnapshot>,
) -> ConversationWorkspaceSnapshot {
    let mut snapshot = persisted.unwrap_or_else(default_workspace_snapshot);
    let knowledge_base_ids = parse_string_list(&row.enabled_knowledge_base_ids);
    let server_ids = parse_string_list(&row.enabled_mcp_server_ids);
    let memory_namespace_ids = parse_string_list(&row.enabled_memory_namespace_ids);
    let memory_namespace_id = memory_namespace_ids.first().cloned();
    let memory_enabled = memory_namespace_id.is_some() || snapshot.memory_policy.enabled;

    snapshot.search_policy.enabled = row.search_enabled != 0;
    snapshot.search_policy.search_provider_id = row.search_provider_id.clone();
    if snapshot.search_policy.query_mode.trim().is_empty() {
        snapshot.search_policy.query_mode = "manual".to_string();
    }
    if snapshot.search_policy.result_limit <= 0 {
        snapshot.search_policy.result_limit = 10;
    }

    snapshot.tool_binding.server_ids = server_ids.clone();
    if snapshot.tool_binding.approval_mode.trim().is_empty() {
        snapshot.tool_binding.approval_mode = "ask".to_string();
    }

    snapshot.knowledge_binding.knowledge_base_ids = knowledge_base_ids.clone();

    snapshot.memory_policy.enabled = memory_enabled;
    snapshot.memory_policy.namespace_id = memory_namespace_id.clone();

    snapshot.toggles.search_enabled = row.search_enabled != 0;
    snapshot.toggles.search_provider_id = row.search_provider_id.clone();
    snapshot.toggles.enabled_knowledge_base_ids = knowledge_base_ids;
    snapshot.toggles.enabled_mcp_server_ids = server_ids;
    snapshot.toggles.memory_enabled = memory_enabled;
    snapshot.toggles.memory_namespace_id = memory_namespace_id;
    snapshot.toggles.memory_write_back = snapshot.memory_policy.write_back;

    snapshot.research_mode = row.research_mode != 0;

    snapshot
}

fn apply_workspace_snapshot_input(
    current: ConversationWorkspaceSnapshot,
    input: UpdateConversationWorkspaceSnapshotInput,
) -> ConversationWorkspaceSnapshot {
    let mut next = current;

    if let Some(search_policy) = input.search_policy {
        next.search_policy = search_policy;
    }
    if let Some(tool_binding) = input.tool_binding {
        next.tool_binding = tool_binding;
    }
    if let Some(knowledge_binding) = input.knowledge_binding {
        next.knowledge_binding = knowledge_binding;
    }
    if let Some(memory_policy) = input.memory_policy {
        next.memory_policy = memory_policy;
    }
    if let Some(toggles) = input.toggles {
        next.toggles = toggles;
    }
    if let Some(research_mode) = input.research_mode {
        next.research_mode = research_mode;
    }
    if let Some(pinned_artifact_ids) = input.pinned_artifact_ids {
        next.pinned_artifact_ids = pinned_artifact_ids;
    }

    next
}

pub async fn list_conversations(db: &DatabaseConnection) -> Result<Vec<Conversation>> {
    super::workspace::ensure_workspace_identity_backfilled(db).await?;
    let rows = conversations::Entity::find()
        .filter(conversations::Column::IsArchived.eq(0))
        .order_by_desc(conversations::Column::IsPinned)
        .order_by_desc(conversations::Column::UpdatedAt)
        .all(db)
        .await?;

    Ok(rows.into_iter().map(conversation_from_entity).collect())
}

pub async fn list_archived_conversations(db: &DatabaseConnection) -> Result<Vec<Conversation>> {
    super::workspace::ensure_workspace_identity_backfilled(db).await?;
    let rows = conversations::Entity::find()
        .filter(conversations::Column::IsArchived.ne(0))
        .order_by_desc(conversations::Column::UpdatedAt)
        .all(db)
        .await?;

    Ok(rows.into_iter().map(conversation_from_entity).collect())
}

pub async fn get_conversation(db: &DatabaseConnection, id: &str) -> Result<Conversation> {
    let _ = super::workspace::ensure_workspace_identity_for_conversation(db, id).await?;
    let row = conversations::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", id)))?;

    Ok(conversation_from_entity(row))
}

pub async fn get_workspace_snapshot(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<ConversationWorkspaceSnapshot> {
    let row = conversations::Entity::find_by_id(conversation_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", conversation_id)))?;

    let persisted = parse_workspace_snapshot_json(&row.workspace_snapshot_json);
    let (server_ids, knowledge_base_ids, memory_namespace_ids) =
        super::workspace::resolve_effective_binding_ids(db, conversation_id).await?;

    let mut projected_row = row;
    projected_row.enabled_mcp_server_ids = stringify_string_list(&server_ids);
    projected_row.enabled_knowledge_base_ids = stringify_string_list(&knowledge_base_ids);
    projected_row.enabled_memory_namespace_ids = stringify_string_list(&memory_namespace_ids);

    Ok(project_workspace_snapshot(&projected_row, Some(persisted)))
}

pub async fn update_workspace_snapshot(
    db: &DatabaseConnection,
    conversation_id: &str,
    input: UpdateConversationWorkspaceSnapshotInput,
) -> Result<ConversationWorkspaceSnapshot> {
    let row = conversations::Entity::find_by_id(conversation_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", conversation_id)))?;

    let current = project_workspace_snapshot(
        &row,
        Some(parse_workspace_snapshot_json(&row.workspace_snapshot_json)),
    );
    let next = apply_workspace_snapshot_input(current, input);

    let mut am: conversations::ActiveModel = row.into();
    am.search_enabled = Set(if next.search_policy.enabled { 1 } else { 0 });
    am.search_provider_id = Set(next.search_policy.search_provider_id.clone());
    am.enabled_mcp_server_ids = Set(stringify_string_list(&next.tool_binding.server_ids));
    am.enabled_knowledge_base_ids =
        Set(stringify_string_list(&next.knowledge_binding.knowledge_base_ids));

    let memory_namespace_ids = if next.memory_policy.enabled {
        next.memory_policy
            .namespace_id
            .clone()
            .into_iter()
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    am.enabled_memory_namespace_ids = Set(stringify_string_list(&memory_namespace_ids));
    am.research_mode = Set(if next.research_mode { 1 } else { 0 });
    am.workspace_snapshot_json = Set(
        serde_json::to_string(&next)
            .expect("failed to serialize conversation workspace snapshot"),
    );
    am.updated_at = Set(now_ts());
    am.update(db).await?;
    super::workspace::sync_workspace_bindings_from_conversation(db, conversation_id).await?;

    get_workspace_snapshot(db, conversation_id).await
}

pub async fn create_conversation(
    db: &DatabaseConnection,
    title: &str,
    model_id: &str,
    provider_id: &str,
    system_prompt: Option<&str>,
) -> Result<Conversation> {
    create_conversation_with_source_and_mode(
        db,
        title,
        model_id,
        provider_id,
        system_prompt,
        "chat",
        "chat",
    )
    .await
}

pub async fn create_conversation_with_source(
    db: &DatabaseConnection,
    title: &str,
    model_id: &str,
    provider_id: &str,
    system_prompt: Option<&str>,
    source: &str,
) -> Result<Conversation> {
    create_conversation_with_source_and_mode(
        db,
        title,
        model_id,
        provider_id,
        system_prompt,
        source,
        "chat",
    )
    .await
}

pub async fn create_conversation_with_source_and_mode(
    db: &DatabaseConnection,
    title: &str,
    model_id: &str,
    provider_id: &str,
    system_prompt: Option<&str>,
    source: &str,
    mode: &str,
) -> Result<Conversation> {
    let id = gen_id();
    let now = now_ts();

    conversations::ActiveModel {
        id: Set(id.clone()),
        title: Set(title.to_string()),
        model_id: Set(model_id.to_string()),
        provider_id: Set(provider_id.to_string()),
        system_prompt: Set(system_prompt.map(|s| s.to_string())),
        message_count: Set(0),
        is_pinned: Set(0),
        created_at: Set(now),
        updated_at: Set(now),
        source: Set(source.to_string()),
        mode: Set(mode.to_string()),
        ..Default::default()
    }
    .insert(db)
    .await?;

    let _ = super::workspace::ensure_canonical_workspace_for_conversation(db, &id).await?;
    super::workspace::sync_workspace_bindings_from_conversation(db, &id).await?;

    get_conversation(db, &id).await
}

pub async fn update_conversation(
    db: &DatabaseConnection,
    id: &str,
    input: UpdateConversationInput,
) -> Result<Conversation> {
    let row = conversations::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", id)))?;

    let now = now_ts();
    let existing = conversation_from_entity(row.clone());
    let should_sync_workspace = input.title.is_some();
    let should_sync_bindings = input.enabled_mcp_server_ids.is_some()
        || input.enabled_knowledge_base_ids.is_some()
        || input.enabled_memory_namespace_ids.is_some();

    let title = input.title.unwrap_or(existing.title);
    let provider_id = input.provider_id.unwrap_or(existing.provider_id);
    let model_id = input.model_id.unwrap_or(existing.model_id);
    let is_pinned = input.is_pinned.unwrap_or(existing.is_pinned);
    let is_archived = input.is_archived.unwrap_or(existing.is_archived);

    let mut am: conversations::ActiveModel = row.into();
    am.title = Set(title);
    am.provider_id = Set(provider_id);
    am.model_id = Set(model_id);
    am.is_pinned = Set(if is_pinned { 1 } else { 0 });
    am.is_archived = Set(if is_archived { 1 } else { 0 });
    if let Some(ref sp) = input.system_prompt {
        am.system_prompt = Set(if sp.is_empty() {
            None
        } else {
            Some(sp.clone())
        });
    }
    if let Some(temperature) = input.temperature {
        am.temperature = Set(temperature);
    }
    if let Some(max_tokens) = input.max_tokens {
        am.max_tokens = Set(max_tokens);
    }
    if let Some(top_p) = input.top_p {
        am.top_p = Set(top_p);
    }
    if let Some(frequency_penalty) = input.frequency_penalty {
        am.frequency_penalty = Set(frequency_penalty);
    }
    if let Some(search_enabled) = input.search_enabled {
        am.search_enabled = Set(if search_enabled { 1 } else { 0 });
    }
    if let Some(search_provider_id) = input.search_provider_id {
        am.search_provider_id = Set(search_provider_id);
    }
    if let Some(thinking_budget) = input.thinking_budget {
        am.thinking_budget = Set(thinking_budget);
    }
    if let Some(thinking_level) = input.thinking_level {
        am.thinking_level = Set(thinking_level);
    }
    if let Some(enabled_mcp_server_ids) = input.enabled_mcp_server_ids {
        am.enabled_mcp_server_ids = Set(stringify_string_list(&enabled_mcp_server_ids));
    }
    if let Some(enabled_knowledge_base_ids) = input.enabled_knowledge_base_ids {
        am.enabled_knowledge_base_ids = Set(stringify_string_list(&enabled_knowledge_base_ids));
    }
    if let Some(enabled_memory_namespace_ids) = input.enabled_memory_namespace_ids {
        am.enabled_memory_namespace_ids = Set(stringify_string_list(&enabled_memory_namespace_ids));
    }
    if let Some(context_compression) = input.context_compression {
        am.context_compression = Set(if context_compression { 1 } else { 0 });
    }
    if let Some(category_id) = input.category_id {
        am.category_id = Set(category_id);
    }
    if let Some(parent_conversation_id) = input.parent_conversation_id {
        am.parent_conversation_id = Set(parent_conversation_id);
    }
    if let Some(mode) = input.mode {
        am.mode = Set(mode);
    }
    if let Some(source) = input.source {
        am.source = Set(source);
    }
    am.updated_at = Set(now);
    am.update(db).await?;

    if should_sync_bindings {
        super::workspace::sync_workspace_bindings_from_conversation(db, id).await?;
    }

    if should_sync_workspace {
        let _ = super::workspace::sync_workspace_metadata_from_conversation(db, id).await?;
    }

    get_conversation(db, id).await
}

pub async fn update_conversation_title(
    db: &DatabaseConnection,
    id: &str,
    title: &str,
) -> Result<()> {
    if let Some(row) = conversations::Entity::find_by_id(id).one(db).await? {
        let mut am: conversations::ActiveModel = row.into();
        am.title = Set(title.to_string());
        am.updated_at = Set(now_ts());
        am.update(db).await?;
    }
    Ok(())
}

pub async fn toggle_pin(db: &DatabaseConnection, id: &str) -> Result<Conversation> {
    let row = conversations::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", id)))?;

    let new_pinned = if row.is_pinned != 0 { 0 } else { 1 };
    let now = now_ts();

    let mut am: conversations::ActiveModel = row.into();
    am.is_pinned = Set(new_pinned);
    am.updated_at = Set(now);
    am.update(db).await?;

    get_conversation(db, id).await
}

pub async fn toggle_archive(db: &DatabaseConnection, id: &str) -> Result<Conversation> {
    let row = conversations::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", id)))?;

    let new_archived = if row.is_archived != 0 { 0 } else { 1 };
    let now = now_ts();

    let mut am: conversations::ActiveModel = row.into();
    am.is_archived = Set(new_archived);
    am.updated_at = Set(now);
    am.update(db).await?;

    get_conversation(db, id).await
}

pub async fn delete_conversation(db: &DatabaseConnection, id: &str) -> Result<()> {
    let result = conversations::Entity::delete_by_id(id).exec(db).await?;

    if result.rows_affected == 0 {
        return Err(WiseSpaceError::NotFound(format!("Conversation {}", id)));
    }
    Ok(())
}

/// Branch a conversation: copy settings + messages up to `until_message_id`.
/// If `as_child` is true, the new conversation is nested under the source (or its parent).
pub async fn branch_conversation(
    db: &DatabaseConnection,
    conversation_id: &str,
    until_message_id: &str,
    as_child: bool,
    custom_title: Option<&str>,
) -> Result<Conversation> {
    // 1. Load source conversation
    let source = conversations::Entity::find_by_id(conversation_id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("Conversation {}", conversation_id)))?;

    // 2. Load all active messages ordered by created_at
    let all_msgs = messages::Entity::find()
        .filter(messages::Column::ConversationId.eq(conversation_id))
        .filter(messages::Column::IsActive.eq(1))
        .order_by_asc(messages::Column::CreatedAt)
        .all(db)
        .await?;

    // 3. Find the target message index
    let target_idx = all_msgs
        .iter()
        .position(|m| m.id == until_message_id)
        .ok_or_else(|| {
            WiseSpaceError::NotFound(format!("Message {} in conversation", until_message_id))
        })?;

    // 4. Slice messages up to (and including) the target
    let candidate_msgs = &all_msgs[..=target_idx];

    // 5. Find last context-clear marker to determine effective start
    let start_idx = candidate_msgs
        .iter()
        .rposition(|m| {
            m.role == "system"
                && (m.content == "<!-- context-clear -->"
                    || m.content == "<!-- context-compressed -->")
        })
        .map(|idx| idx + 1) // skip the marker itself
        .unwrap_or(0);

    let effective_msgs = &candidate_msgs[start_idx..];

    // 6. Create new conversation with copied settings
    let new_id = gen_id();
    let now = now_ts();
    let branch_title = custom_title
        .map(|t| t.to_string())
        .unwrap_or_else(|| source.title.clone());

    // Determine parent_conversation_id
    let parent_id = if as_child {
        // If source already has a parent, new branch is a sibling (same parent)
        // Otherwise, source becomes the parent
        Some(
            source
                .parent_conversation_id
                .clone()
                .unwrap_or_else(|| source.id.clone()),
        )
    } else {
        None
    };

    conversations::ActiveModel {
        id: Set(new_id.clone()),
        title: Set(branch_title),
        model_id: Set(source.model_id.clone()),
        provider_id: Set(source.provider_id.clone()),
        system_prompt: Set(source.system_prompt.clone()),
        temperature: Set(source.temperature),
        max_tokens: Set(source.max_tokens),
        top_p: Set(source.top_p),
        frequency_penalty: Set(source.frequency_penalty),
        search_enabled: Set(source.search_enabled),
        search_provider_id: Set(source.search_provider_id.clone()),
        thinking_budget: Set(source.thinking_budget),
        thinking_level: Set(source.thinking_level.clone()),
        enabled_mcp_server_ids: Set(source.enabled_mcp_server_ids.clone()),
        enabled_knowledge_base_ids: Set(source.enabled_knowledge_base_ids.clone()),
        enabled_memory_namespace_ids: Set(source.enabled_memory_namespace_ids.clone()),
        message_count: Set(effective_msgs.len() as i32),
        is_pinned: Set(0),
        is_archived: Set(0),
        context_compression: Set(source.context_compression),
        category_id: Set(source.category_id.clone()),
        parent_conversation_id: Set(parent_id),
        research_mode: Set(source.research_mode),
        source: Set(source.source.clone()),
        mode: Set(source.mode.clone()),
        created_at: Set(now),
        updated_at: Set(now),
        workspace_id: Set(None),
        ..Default::default()
    }
    .insert(db)
    .await?;

    let _ = super::workspace::ensure_canonical_workspace_for_conversation(db, &new_id).await?;
    super::workspace::sync_workspace_bindings_from_conversation(db, &new_id).await?;

    // 7. Copy messages — assign new IDs and remap parent_message_id references
    let mut id_map = std::collections::HashMap::new();
    for msg in effective_msgs {
        let new_msg_id = gen_id();
        id_map.insert(msg.id.clone(), new_msg_id.clone());

        let new_parent = msg
            .parent_message_id
            .as_ref()
            .and_then(|pid| id_map.get(pid))
            .cloned();

        messages::ActiveModel {
            id: Set(new_msg_id),
            conversation_id: Set(new_id.clone()),
            role: Set(msg.role.clone()),
            content: Set(msg.content.clone()),
            provider_id: Set(msg.provider_id.clone()),
            model_id: Set(msg.model_id.clone()),
            token_count: Set(msg.token_count),
            prompt_tokens: Set(msg.prompt_tokens),
            completion_tokens: Set(msg.completion_tokens),
            attachments: Set(msg.attachments.clone()),
            thinking: Set(msg.thinking.clone()),
            created_at: Set(msg.created_at),
            parent_message_id: Set(new_parent),
            version_index: Set(msg.version_index),
            is_active: Set(1),
            tool_calls_json: Set(msg.tool_calls_json.clone()),
            tool_call_id: Set(msg.tool_call_id.clone()),
            status: Set(msg.status.clone()),
            tokens_per_second: Set(msg.tokens_per_second),
            first_token_latency_ms: Set(msg.first_token_latency_ms),
            ..Default::default()
        }
        .insert(db)
        .await?;
    }

    get_conversation(db, &new_id).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_conversation_row() -> conversations::Model {
        conversations::Model {
            id: "conv-1".to_string(),
            title: "Conversation".to_string(),
            model_id: "model-1".to_string(),
            provider_id: "provider-1".to_string(),
            system_prompt: None,
            temperature: None,
            max_tokens: None,
            top_p: None,
            frequency_penalty: None,
            search_enabled: 1,
            search_provider_id: Some("search-1".to_string()),
            thinking_budget: None,
            thinking_level: None,
            enabled_mcp_server_ids: serde_json::to_string(&vec!["mcp-1".to_string()]).unwrap(),
            enabled_knowledge_base_ids: serde_json::to_string(&vec!["kb-1".to_string()]).unwrap(),
            enabled_memory_namespace_ids: serde_json::to_string(&vec!["mem-1".to_string()])
                .unwrap(),
            message_count: 0,
            created_at: 0,
            updated_at: 0,
            is_pinned: 0,
            is_archived: 0,
            workspace_snapshot_json: String::new(),
            workspace_id: None,
            active_branch_id: None,
            active_artifact_id: None,
            research_mode: 1,
            context_compression: 0,
            category_id: None,
            parent_conversation_id: None,
            mode: "chat".to_string(),
            source: "chat".to_string(),
        }
    }

    #[test]
    fn project_workspace_snapshot_prefers_real_conversation_state() {
        let mut persisted = default_workspace_snapshot();
        persisted.search_policy.enabled = false;
        persisted.search_policy.query_mode = "auto".to_string();
        persisted.search_policy.result_limit = 25;
        persisted.tool_binding.approval_mode = "allow_safe".to_string();
        persisted.memory_policy.write_back = true;
        persisted.pinned_artifact_ids = vec!["artifact-1".to_string()];

        let snapshot = project_workspace_snapshot(&sample_conversation_row(), Some(persisted));

        assert!(snapshot.search_policy.enabled);
        assert_eq!(snapshot.search_policy.search_provider_id.as_deref(), Some("search-1"));
        assert_eq!(snapshot.search_policy.query_mode, "auto");
        assert_eq!(snapshot.search_policy.result_limit, 25);
        assert_eq!(snapshot.tool_binding.server_ids, vec!["mcp-1".to_string()]);
        assert_eq!(snapshot.knowledge_binding.knowledge_base_ids, vec!["kb-1".to_string()]);
        assert!(snapshot.memory_policy.enabled);
        assert_eq!(snapshot.memory_policy.namespace_id.as_deref(), Some("mem-1"));
        assert!(snapshot.memory_policy.write_back);
        assert!(snapshot.toggles.search_enabled);
        assert_eq!(snapshot.toggles.enabled_mcp_server_ids, vec!["mcp-1".to_string()]);
        assert_eq!(
            snapshot.toggles.enabled_knowledge_base_ids,
            vec!["kb-1".to_string()]
        );
        assert!(snapshot.toggles.memory_enabled);
        assert_eq!(snapshot.pinned_artifact_ids, vec!["artifact-1".to_string()]);
        assert!(snapshot.research_mode);
    }

    #[test]
    fn apply_workspace_snapshot_input_updates_only_requested_sections() {
        let current = default_workspace_snapshot();
        let next = apply_workspace_snapshot_input(
            current,
            UpdateConversationWorkspaceSnapshotInput {
                search_policy: Some(SearchPolicy {
                    enabled: true,
                    search_provider_id: Some("search-2".to_string()),
                    query_mode: "auto".to_string(),
                    result_limit: 20,
                }),
                pinned_artifact_ids: Some(vec!["artifact-2".to_string()]),
                ..Default::default()
            },
        );

        assert!(next.search_policy.enabled);
        assert_eq!(next.search_policy.search_provider_id.as_deref(), Some("search-2"));
        assert_eq!(next.search_policy.query_mode, "auto");
        assert_eq!(next.search_policy.result_limit, 20);
        assert_eq!(next.tool_binding.server_ids, Vec::<String>::new());
        assert_eq!(next.pinned_artifact_ids, vec!["artifact-2".to_string()]);
    }
}

pub async fn search_conversations(
    db: &DatabaseConnection,
    query: &str,
) -> Result<Vec<ConversationSearchResult>> {
    #[derive(Debug, FromQueryResult)]
    struct FtsRow {
        conversation_id: String,
        preview: String,
    }

    let fts_rows = FtsRow::find_by_statement(Statement::from_sql_and_values(
        DatabaseBackend::Sqlite,
        "SELECT m.conversation_id, snippet(messages_fts, 0, '', '', '...', 32) as preview \
         FROM messages_fts \
         JOIN messages m ON m.rowid = messages_fts.rowid \
         WHERE messages_fts MATCH ? \
         ORDER BY rank",
        [query.into()],
    ))
    .all(db)
    .await?;

    let mut seen_conversation_ids = HashSet::new();
    let mut results = Vec::with_capacity(fts_rows.len());
    for fts in fts_rows {
        if !seen_conversation_ids.insert(fts.conversation_id.clone()) {
            continue;
        }
        if let Ok(conv) = get_conversation(db, &fts.conversation_id).await {
            results.push(ConversationSearchResult {
                conversation: conv,
                matched_message_preview: Some(fts.preview),
            });
        }
    }
    Ok(results)
}

pub async fn increment_message_count(db: &DatabaseConnection, conversation_id: &str) -> Result<()> {
    db.execute(Statement::from_sql_and_values(
        DatabaseBackend::Sqlite,
        "UPDATE conversations SET message_count = message_count + 1, updated_at = ? WHERE id = ?",
        [now_ts().into(), conversation_id.into()],
    ))
    .await?;
    Ok(())
}

pub async fn decrement_message_count(db: &DatabaseConnection, conversation_id: &str) -> Result<()> {
    db.execute(Statement::from_sql_and_values(
        DatabaseBackend::Sqlite,
        "UPDATE conversations SET message_count = MAX(0, message_count - 1), updated_at = ? WHERE id = ?",
        [now_ts().into(), conversation_id.into()],
    ))
    .await?;
    Ok(())
}

// ── Conversation summaries ──────────────────────────────────────────────

fn summary_from_entity(m: conversation_summaries::Model) -> ConversationSummary {
    ConversationSummary {
        id: m.id,
        conversation_id: m.conversation_id,
        summary_text: m.summary_text,
        compressed_until_message_id: m.compressed_until_message_id,
        token_count: m.token_count.map(|v| v as u32),
        model_used: m.model_used,
        created_at: m.created_at,
        updated_at: m.updated_at,
    }
}

pub async fn get_summary(
    db: &DatabaseConnection,
    conversation_id: &str,
) -> Result<Option<ConversationSummary>> {
    let row = conversation_summaries::Entity::find()
        .filter(conversation_summaries::Column::ConversationId.eq(conversation_id))
        .order_by_desc(conversation_summaries::Column::UpdatedAt)
        .one(db)
        .await?;

    Ok(row.map(summary_from_entity))
}

pub async fn upsert_summary(
    db: &DatabaseConnection,
    conversation_id: &str,
    summary_text: &str,
    compressed_until_message_id: Option<&str>,
    token_count: Option<u32>,
    model_used: Option<&str>,
) -> Result<ConversationSummary> {
    let now = now_ts();

    let existing = conversation_summaries::Entity::find()
        .filter(conversation_summaries::Column::ConversationId.eq(conversation_id))
        .one(db)
        .await?;

    match existing {
        Some(row) => {
            let mut am: conversation_summaries::ActiveModel = row.into();
            am.summary_text = Set(summary_text.to_string());
            am.compressed_until_message_id =
                Set(compressed_until_message_id.map(|s| s.to_string()));
            am.token_count = Set(token_count.map(|v| v as i64));
            am.model_used = Set(model_used.map(|s| s.to_string()));
            am.updated_at = Set(now);
            am.update(db).await?;
        }
        None => {
            let id = gen_id();
            conversation_summaries::ActiveModel {
                id: Set(id),
                conversation_id: Set(conversation_id.to_string()),
                summary_text: Set(summary_text.to_string()),
                compressed_until_message_id: Set(
                    compressed_until_message_id.map(|s| s.to_string()),
                ),
                token_count: Set(token_count.map(|v| v as i64)),
                model_used: Set(model_used.map(|s| s.to_string())),
                created_at: Set(now),
                updated_at: Set(now),
            }
            .insert(db)
            .await?;
        }
    }

    get_summary(db, conversation_id).await?.ok_or_else(|| {
        WiseSpaceError::Database(sea_orm::DbErr::Custom(
            "Failed to read back upserted summary".into(),
        ))
    })
}

pub async fn delete_summary(db: &DatabaseConnection, conversation_id: &str) -> Result<()> {
    conversation_summaries::Entity::delete_many()
        .filter(conversation_summaries::Column::ConversationId.eq(conversation_id))
        .exec(db)
        .await?;
    Ok(())
}
