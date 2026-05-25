use sea_orm::*;

use crate::entity::{agent_task_events, agent_tasks, external_agents};
use crate::error::{Result, WiseSpaceError};
use crate::types::{
    AgentTask, AgentTaskEvent, BuiltinSubagentAssignee, CreateExternalAgentInput, ExternalAgent,
    UpdateExternalAgentInput,
};
use crate::utils::{gen_id, now_ts};

const BUILTIN_SUBAGENT_KIND: &str = "builtin_subagent";

#[derive(Debug, Clone)]
struct DelegatedTaskPayload {
    task_type: String,
    preset_key: Option<String>,
    delegation_reason: Option<String>,
    input_text: Option<String>,
}

fn parse_delegated_task_payload(raw: &str) -> Option<DelegatedTaskPayload> {
    let value: serde_json::Value = serde_json::from_str(raw).ok()?;
    let task_type = value
        .get("taskType")
        .and_then(|item| item.as_str())
        .map(str::to_string)
        .or_else(|| {
            value.get("assigneeKey").and_then(|item| item.as_str()).map(|key| {
                match key {
                    "code-reviewer" => "review",
                    "researcher" => "research",
                    "file-scanner" => "scan_files",
                    _ => "general",
                }
                .to_string()
            })
        })
        .or_else(|| value.get("kind").and_then(|item| item.as_str()).map(str::to_string))
        .unwrap_or_else(|| "general".to_string());

    let preset_key = value
        .get("presetKey")
        .and_then(|item| item.as_str())
        .map(str::to_string)
        .or_else(|| {
            value.get("assigneeKey")
                .and_then(|item| item.as_str())
                .map(str::to_string)
        });

    Some(DelegatedTaskPayload {
        task_type,
        preset_key,
        delegation_reason: value
            .get("delegationReason")
            .and_then(|item| item.as_str())
            .map(str::to_string),
        input_text: value
            .get("inputText")
            .and_then(|item| item.as_str())
            .map(str::to_string),
    })
}

fn resolve_builtin_subagent_assignee(
    task_type: &str,
    preset_key: Option<&str>,
) -> Option<BuiltinSubagentAssignee> {
    if let Some(key) = preset_key.and_then(get_builtin_subagent_assignee) {
        return Some(key);
    }

    let fallback_key = match task_type {
        "review" => "code-reviewer",
        "research" => "researcher",
        "scan_files" => "file-scanner",
        _ => return None,
    };
    get_builtin_subagent_assignee(fallback_key)
}

fn builtin_subagent_catalog() -> Vec<BuiltinSubagentAssignee> {
    vec![
        BuiltinSubagentAssignee {
            key: "code-reviewer".to_string(),
            name: "Code Reviewer".to_string(),
            description: "Focuses on code quality, bug risk, and review findings.".to_string(),
            prompt_hint: "Review the proposed change and return findings first.".to_string(),
            default_task_kind: "review".to_string(),
        },
        BuiltinSubagentAssignee {
            key: "researcher".to_string(),
            name: "Researcher".to_string(),
            description: "Collects evidence, compares options, and summarizes tradeoffs.".to_string(),
            prompt_hint: "Research the topic and summarize evidence, tradeoffs, and unknowns.".to_string(),
            default_task_kind: "research".to_string(),
        },
        BuiltinSubagentAssignee {
            key: "file-scanner".to_string(),
            name: "File Scanner".to_string(),
            description: "Inspects workspace files and extracts the most relevant context.".to_string(),
            prompt_hint: "Inspect the relevant files and report the highest-signal context only.".to_string(),
            default_task_kind: "scan_files".to_string(),
        },
    ]
}

fn builtin_subagent_agent_id(assignee_key: &str) -> String {
    format!("builtin-subagent:{assignee_key}")
}

pub fn list_builtin_subagent_assignees() -> Vec<BuiltinSubagentAssignee> {
    builtin_subagent_catalog()
}

pub fn get_builtin_subagent_assignee(key: &str) -> Option<BuiltinSubagentAssignee> {
    builtin_subagent_catalog()
        .into_iter()
        .find(|item| item.key == key)
}

async fn ensure_builtin_subagent_agent(
    db: &DatabaseConnection,
    assignee: &BuiltinSubagentAssignee,
) -> Result<ExternalAgent> {
    let id = builtin_subagent_agent_id(&assignee.key);
    if let Ok(existing) = get_external_agent(db, &id).await {
        return Ok(existing);
    }

    let now = now_ts();
    external_agents::ActiveModel {
        id: Set(id.clone()),
        name: Set(assignee.name.clone()),
        kind: Set(BUILTIN_SUBAGENT_KIND.to_string()),
        base_url: Set(None),
        auth_type: Set("none".to_string()),
        auth_config_json: Set(None),
        capabilities_json: Set(
            serde_json::json!({
                "builtin": true,
                "assigneeKey": assignee.key,
                "defaultTaskKind": assignee.default_task_kind,
                "promptHint": assignee.prompt_hint,
            })
            .to_string(),
        ),
        enabled: Set(1),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(db)
    .await?;
    get_external_agent(db, &id).await
}

fn external_agent_from_model(model: external_agents::Model) -> ExternalAgent {
    ExternalAgent {
        id: model.id,
        name: model.name,
        kind: model.kind,
        base_url: model.base_url,
        auth_type: model.auth_type,
        auth_config_json: model.auth_config_json,
        capabilities_json: model.capabilities_json,
        enabled: model.enabled != 0,
        created_at: model.created_at,
        updated_at: model.updated_at,
    }
}

fn agent_task_from_model(model: agent_tasks::Model) -> AgentTask {
    let delegated_payload = parse_delegated_task_payload(&model.request_payload_json);
    let kind = model.kind.clone();
    AgentTask {
        id: model.id,
        conversation_id: model.conversation_id,
        workspace_id: model.workspace_id,
        parent_run_id: model.parent_run_id,
        parent_task_id: model.parent_task_id,
        source_message_id: model.source_message_id,
        external_agent_id: model.external_agent_id,
        external_task_id: model.external_task_id,
        assignee_kind: model.assignee_kind,
        assignee_label: model.assignee_label,
        delegation_depth: model.delegation_depth,
        kind: kind.clone(),
        task_type: delegated_payload
            .as_ref()
            .map(|payload| payload.task_type.clone())
            .unwrap_or(kind),
        preset_key: delegated_payload
            .as_ref()
            .and_then(|payload| payload.preset_key.clone()),
        delegation_reason: delegated_payload
            .as_ref()
            .and_then(|payload| payload.delegation_reason.clone()),
        input_text: delegated_payload
            .as_ref()
            .and_then(|payload| payload.input_text.clone()),
        status: model.status,
        title: model.title,
        request_payload_json: model.request_payload_json,
        result_payload_json: model.result_payload_json,
        error_message: model.error_message,
        created_at: model.created_at,
        updated_at: model.updated_at,
    }
}

fn agent_task_event_from_model(model: agent_task_events::Model) -> AgentTaskEvent {
    AgentTaskEvent {
        id: model.id,
        task_id: model.task_id,
        event_type: model.event_type,
        payload_json: model.payload_json,
        created_at: model.created_at,
    }
}

pub async fn list_external_agents(db: &DatabaseConnection) -> Result<Vec<ExternalAgent>> {
    let rows = external_agents::Entity::find()
        .filter(external_agents::Column::Kind.ne(BUILTIN_SUBAGENT_KIND))
        .order_by_asc(external_agents::Column::Name)
        .all(db)
        .await?;
    Ok(rows.into_iter().map(external_agent_from_model).collect())
}

pub async fn get_external_agent(db: &DatabaseConnection, id: &str) -> Result<ExternalAgent> {
    let row = external_agents::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("ExternalAgent {}", id)))?;
    Ok(external_agent_from_model(row))
}

pub async fn create_external_agent(
    db: &DatabaseConnection,
    input: CreateExternalAgentInput,
) -> Result<ExternalAgent> {
    if input.name.trim().is_empty() {
        return Err(WiseSpaceError::Validation("Agent name is required".into()));
    }
    let id = gen_id();
    let now = now_ts();
    external_agents::ActiveModel {
        id: Set(id.clone()),
        name: Set(input.name.trim().to_string()),
        kind: Set(if input.kind.trim().is_empty() {
            "generic_http".to_string()
        } else {
            input.kind.trim().to_string()
        }),
        base_url: Set(input.base_url.filter(|value| !value.trim().is_empty())),
        auth_type: Set(input.auth_type.unwrap_or_else(|| "none".to_string())),
        auth_config_json: Set(input
            .auth_config_json
            .filter(|value| !value.trim().is_empty())),
        capabilities_json: Set(input
            .capabilities_json
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "{}".to_string())),
        enabled: Set(if input.enabled.unwrap_or(true) { 1 } else { 0 }),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(db)
    .await?;
    get_external_agent(db, &id).await
}

pub async fn update_external_agent(
    db: &DatabaseConnection,
    id: &str,
    input: UpdateExternalAgentInput,
) -> Result<ExternalAgent> {
    let row = external_agents::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("ExternalAgent {}", id)))?;
    let mut am: external_agents::ActiveModel = row.into();

    if let Some(name) = input.name {
        if name.trim().is_empty() {
            return Err(WiseSpaceError::Validation("Agent name is required".into()));
        }
        am.name = Set(name.trim().to_string());
    }
    if let Some(kind) = input.kind {
        am.kind = Set(if kind.trim().is_empty() {
            "generic_http".to_string()
        } else {
            kind.trim().to_string()
        });
    }
    if let Some(base_url) = input.base_url {
        am.base_url = Set(base_url.filter(|value| !value.trim().is_empty()));
    }
    if let Some(auth_type) = input.auth_type {
        am.auth_type = Set(auth_type);
    }
    if let Some(auth_config_json) = input.auth_config_json {
        am.auth_config_json = Set(auth_config_json.filter(|value| !value.trim().is_empty()));
    }
    if let Some(capabilities_json) = input.capabilities_json {
        am.capabilities_json = Set(if capabilities_json.trim().is_empty() {
            "{}".to_string()
        } else {
            capabilities_json
        });
    }
    if let Some(enabled) = input.enabled {
        am.enabled = Set(if enabled { 1 } else { 0 });
    }
    am.updated_at = Set(now_ts());
    am.update(db).await?;
    get_external_agent(db, id).await
}

pub async fn delete_external_agent(db: &DatabaseConnection, id: &str) -> Result<()> {
    let result = external_agents::Entity::delete_by_id(id).exec(db).await?;
    if result.rows_affected == 0 {
        return Err(WiseSpaceError::NotFound(format!("ExternalAgent {}", id)));
    }
    Ok(())
}

pub async fn create_agent_task(
    db: &DatabaseConnection,
    conversation_id: Option<&str>,
    parent_run_id: Option<&str>,
    parent_task_id: Option<&str>,
    source_message_id: Option<&str>,
    external_agent_id: &str,
    assignee_kind: &str,
    assignee_label: Option<&str>,
    kind: &str,
    status: &str,
    title: &str,
    request_payload_json: &str,
) -> Result<AgentTask> {
    let workspace_id = match conversation_id {
        Some(value) => Some(
            crate::repo::workspace::ensure_canonical_workspace_for_conversation(db, value)
                .await?
                .id,
        ),
        None => None,
    };
    let id = gen_id();
    let now = now_ts();
    agent_tasks::ActiveModel {
        id: Set(id.clone()),
        conversation_id: Set(conversation_id.map(|value| value.to_string())),
        workspace_id: Set(workspace_id),
        parent_run_id: Set(parent_run_id.map(ToString::to_string)),
        parent_task_id: Set(parent_task_id.map(ToString::to_string)),
        source_message_id: Set(source_message_id.map(|value| value.to_string())),
        external_agent_id: Set(external_agent_id.to_string()),
        external_task_id: Set(None),
        assignee_kind: Set(assignee_kind.to_string()),
        assignee_label: Set(assignee_label.map(ToString::to_string)),
        delegation_depth: Set(if parent_run_id.is_some() || parent_task_id.is_some() {
            1
        } else {
            0
        }),
        kind: Set(kind.to_string()),
        status: Set(status.to_string()),
        title: Set(title.to_string()),
        request_payload_json: Set(request_payload_json.to_string()),
        result_payload_json: Set(None),
        error_message: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    }
    .insert(db)
    .await?;
    get_agent_task(db, &id).await
}

pub async fn get_agent_task(db: &DatabaseConnection, id: &str) -> Result<AgentTask> {
    let row = agent_tasks::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("AgentTask {}", id)))?;
    Ok(agent_task_from_model(row))
}

pub async fn update_agent_task_result(
    db: &DatabaseConnection,
    id: &str,
    status: &str,
    external_task_id: Option<String>,
    result_payload_json: Option<String>,
    error_message: Option<String>,
) -> Result<AgentTask> {
    let row = agent_tasks::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("AgentTask {}", id)))?;
    let mut am: agent_tasks::ActiveModel = row.into();
    am.status = Set(status.to_string());
    if external_task_id.is_some() {
        am.external_task_id = Set(external_task_id);
    }
    am.result_payload_json = Set(result_payload_json);
    am.error_message = Set(error_message);
    am.updated_at = Set(now_ts());
    am.update(db).await?;
    get_agent_task(db, id).await
}

pub async fn list_agent_tasks(
    db: &DatabaseConnection,
    conversation_id: Option<&str>,
    parent_run_id: Option<&str>,
    parent_task_id: Option<&str>,
    external_agent_id: Option<&str>,
    limit: Option<u64>,
) -> Result<Vec<AgentTask>> {
    let mut query = agent_tasks::Entity::find();
    if let Some(conversation_id) = conversation_id {
        query = query.filter(agent_tasks::Column::ConversationId.eq(conversation_id));
    }
    if let Some(parent_run_id) = parent_run_id {
        query = query.filter(agent_tasks::Column::ParentRunId.eq(parent_run_id));
    }
    if let Some(parent_task_id) = parent_task_id {
        query = query.filter(agent_tasks::Column::ParentTaskId.eq(parent_task_id));
    }
    if let Some(external_agent_id) = external_agent_id {
        query = query.filter(agent_tasks::Column::ExternalAgentId.eq(external_agent_id));
    }
    let rows = query
        .order_by_desc(agent_tasks::Column::CreatedAt)
        .limit(limit.unwrap_or(100))
        .all(db)
        .await?;
    Ok(rows.into_iter().map(agent_task_from_model).collect())
}

pub async fn list_delegated_tasks_for_run(
    db: &DatabaseConnection,
    run_id: &str,
) -> Result<Vec<AgentTask>> {
    list_agent_tasks(db, None, Some(run_id), None, None, Some(200)).await
}

pub async fn create_delegated_subagent_stub_task(
    db: &DatabaseConnection,
    conversation_id: Option<&str>,
    parent_run_id: &str,
    parent_task_id: Option<&str>,
    source_message_id: Option<&str>,
    task_type: &str,
    preset_key: Option<&str>,
    delegation_reason: Option<&str>,
    title: &str,
    input_text: &str,
    context_json: Option<&str>,
) -> Result<AgentTask> {
    let assignee = resolve_builtin_subagent_assignee(task_type, preset_key).ok_or_else(|| {
        WiseSpaceError::Validation(format!(
            "No builtin subagent preset is available for taskType `{}` and presetKey `{}`",
            task_type,
            preset_key.unwrap_or_default()
        ))
    })?;
    let agent = ensure_builtin_subagent_agent(db, &assignee).await?;
    let payload = serde_json::json!({
        "taskType": task_type,
        "presetKey": preset_key.or(Some(assignee.key.as_str())),
        "assigneeKey": assignee.key,
        "assigneeName": assignee.name,
        "description": assignee.description,
        "promptHint": assignee.prompt_hint,
        "delegationReason": delegation_reason,
        "inputText": input_text,
        "contextJson": context_json,
    })
    .to_string();

    create_agent_task(
        db,
        conversation_id,
        Some(parent_run_id),
        parent_task_id,
        source_message_id,
        &agent.id,
        "internal_subagent",
        Some(&assignee.name),
        task_type,
        "planned",
        title,
        &payload,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repo::conversation;

    #[tokio::test]
    async fn create_agent_task_persists_delegation_fields_and_filters_by_parent_run() {
        let db = crate::db::create_test_pool().await.unwrap().conn;
        let conversation = conversation::create_conversation_with_source_and_mode(
            &db,
            "Subagent root",
            "model-test",
            "provider-test",
            None,
            "task_center",
            "agent",
        )
        .await
        .unwrap();
        db.execute_unprepared(
            r#"
            INSERT INTO external_agents (
                id, name, kind, base_url, auth_type, auth_config_json, capabilities_json, enabled, created_at, updated_at
            ) VALUES (
                'ext-agent-1', 'Reviewer', 'generic_http', NULL, 'none', NULL, '{}', 1, 1, 1
            )
            "#,
        )
        .await
        .unwrap();

        let task = create_agent_task(
            &db,
            Some(&conversation.id),
            Some("run-parent"),
            Some("task-parent"),
            None,
            "ext-agent-1",
            "external_agent",
            Some("Code reviewer"),
            "review",
            "queued",
            "Review changed files",
            "{}",
        )
        .await
        .unwrap();

        assert_eq!(task.parent_run_id.as_deref(), Some("run-parent"));
        assert_eq!(task.parent_task_id.as_deref(), Some("task-parent"));
        assert_eq!(task.assignee_kind, "external_agent");
        assert_eq!(task.assignee_label.as_deref(), Some("Code reviewer"));
        assert_eq!(task.delegation_depth, 1);

        let delegated = list_delegated_tasks_for_run(&db, "run-parent").await.unwrap();
        assert_eq!(delegated.len(), 1);
        assert_eq!(delegated[0].id, task.id);
    }

    #[tokio::test]
    async fn create_delegated_subagent_stub_task_uses_builtin_internal_assignee() {
        let db = crate::db::create_test_pool().await.unwrap().conn;
        let conversation = conversation::create_conversation_with_source_and_mode(
            &db,
            "Subagent stub",
            "model-test",
            "provider-test",
            None,
            "task_center",
            "agent",
        )
        .await
        .unwrap();

        let task = create_delegated_subagent_stub_task(
            &db,
            Some(&conversation.id),
            "run-stub",
            None,
            None,
            "review",
            Some("code-reviewer"),
            Some("主 Agent 识别为审查类任务"),
            "Review auth changes",
            "Please review the auth flow diff.",
            Some("{\"paths\":[\"src/auth.ts\"]}"),
        )
        .await
        .unwrap();

        assert_eq!(task.assignee_kind, "internal_subagent");
        assert_eq!(task.assignee_label.as_deref(), Some("Code Reviewer"));
        assert_eq!(task.status, "planned");
        assert_eq!(task.kind, "review");
        assert_eq!(task.task_type, "review");
        assert_eq!(task.preset_key.as_deref(), Some("code-reviewer"));
        assert_eq!(
            task.delegation_reason.as_deref(),
            Some("主 Agent 识别为审查类任务")
        );
        assert!(task.external_agent_id.starts_with("builtin-subagent:"));
    }

    #[test]
    fn agent_task_from_model_maps_legacy_code_reviewer_payload_to_review() {
        let task = agent_task_from_model(agent_tasks::Model {
            id: "task_1".into(),
            conversation_id: Some("conv_1".into()),
            workspace_id: None,
            parent_run_id: Some("run_1".into()),
            parent_task_id: None,
            source_message_id: None,
            external_agent_id: "builtin-subagent:code-reviewer".into(),
            external_task_id: None,
            assignee_kind: "internal_subagent".into(),
            assignee_label: Some("Code Reviewer".into()),
            delegation_depth: 1,
            kind: "code_review".into(),
            status: "planned".into(),
            title: "Legacy review".into(),
            request_payload_json: serde_json::json!({
                "assigneeKey": "code-reviewer",
                "inputText": "Review the auth patch"
            })
            .to_string(),
            result_payload_json: None,
            error_message: None,
            created_at: 0,
            updated_at: 0,
        });

        assert_eq!(task.task_type, "review");
        assert_eq!(task.preset_key.as_deref(), Some("code-reviewer"));
        assert_eq!(task.input_text.as_deref(), Some("Review the auth patch"));
    }
}

pub async fn create_agent_task_event(
    db: &DatabaseConnection,
    task_id: &str,
    event_type: &str,
    payload_json: &str,
) -> Result<AgentTaskEvent> {
    let id = gen_id();
    agent_task_events::ActiveModel {
        id: Set(id.clone()),
        task_id: Set(task_id.to_string()),
        event_type: Set(event_type.to_string()),
        payload_json: Set(payload_json.to_string()),
        created_at: Set(now_ts()),
    }
    .insert(db)
    .await?;
    let row = agent_task_events::Entity::find_by_id(&id)
        .one(db)
        .await?
        .ok_or_else(|| WiseSpaceError::NotFound(format!("AgentTaskEvent {}", id)))?;
    Ok(agent_task_event_from_model(row))
}

pub async fn list_agent_task_events(
    db: &DatabaseConnection,
    task_id: &str,
) -> Result<Vec<AgentTaskEvent>> {
    let rows = agent_task_events::Entity::find()
        .filter(agent_task_events::Column::TaskId.eq(task_id))
        .order_by_asc(agent_task_events::Column::CreatedAt)
        .all(db)
        .await?;
    Ok(rows.into_iter().map(agent_task_event_from_model).collect())
}
