use crate::AppState;
use serde_json::Value;
use tauri::State;
use wisespace_core::types::{
    ExtensionContributionSummary, ExtensionHealth, ExtensionPermissionProfile, ExtensionScope,
    ExtensionSourceInfo, ExtensionSummary, ExternalAgent, McpServer, SkillInfo,
};

fn map_skill_source_kind(source: &str) -> String {
    match source {
        "builtin" => "builtin",
        "project" => "project",
        "wisespace" | "claude" | "agents" => "marketplace",
        _ => "local",
    }
    .to_string()
}

fn summarize_skill(skill: SkillInfo) -> ExtensionSummary {
    ExtensionSummary {
        id: format!("skill::{}", skill.name),
        kind: "skill".to_string(),
        name: skill.name.clone(),
        description: Some(skill.description.clone()),
        version: skill.version.clone(),
        enabled: skill.enabled,
        source: ExtensionSourceInfo {
            kind: map_skill_source_kind(&skill.source),
            label: Some(skill.source.clone()),
            path: Some(skill.source_path.clone()),
            r#ref: None,
        },
        health: ExtensionHealth {
            status: "healthy".to_string(),
            summary: Some(if skill.enabled {
                "Skill is available for prompt-time invocation.".to_string()
            } else {
                "Skill is installed but currently disabled.".to_string()
            }),
            checked_at: None,
        },
        scope: ExtensionScope {
            availability: "workspace_attachable".to_string(),
            attached_workspace_ids: None,
            default_enabled: Some(skill.enabled),
        },
        permissions: ExtensionPermissionProfile {
            trust_level: "safe".to_string(),
            approval_mode: "inherit".to_string(),
            requires_filesystem_access: Some(false),
            requires_network_access: Some(false),
            requires_secrets: Some(false),
        },
        contributions: vec![ExtensionContributionSummary {
            id: format!("skill-contribution::{}", skill.name),
            type_: "prompt_skill".to_string(),
            name: skill.name.clone(),
            description: skill.when_to_use.clone().or_else(|| Some(skill.description.clone())),
            user_invocable: Some(skill.user_invocable),
            runtime_label: skill.group.clone(),
        }],
        tags: vec!["skills".to_string()],
        created_at: None,
        updated_at: None,
    }
}

fn summarize_mcp(server: McpServer, tool_count: usize) -> ExtensionSummary {
    let health_status = if !server.enabled {
        "warning"
    } else if server.transport == "stdio" && server.command.as_deref().unwrap_or("").trim().is_empty() {
        "error"
    } else if matches!(server.transport.as_str(), "http" | "sse")
        && server.endpoint.as_deref().unwrap_or("").trim().is_empty()
    {
        "error"
    } else {
        "healthy"
    };

    let summary = match health_status {
        "error" => Some("Server configuration is incomplete for the selected transport.".to_string()),
        "warning" => Some("Server is installed but currently disabled.".to_string()),
        _ => Some(format!("{tool_count} discovered tool(s) available.")),
    };

    ExtensionSummary {
        id: format!("mcp_server::{}", server.id),
        kind: "mcp_server".to_string(),
        name: server.name.clone(),
        description: Some(format!("{} transport MCP server", server.transport.to_uppercase())),
        version: None,
        enabled: server.enabled,
        source: ExtensionSourceInfo {
            kind: if server.source == "builtin" {
                "builtin".to_string()
            } else {
                "local".to_string()
            },
            label: Some(server.source.clone()),
            path: server.command.clone().or(server.endpoint.clone()),
            r#ref: None,
        },
        health: ExtensionHealth {
            status: health_status.to_string(),
            summary,
            checked_at: None,
        },
        scope: ExtensionScope {
            availability: "workspace_attachable".to_string(),
            attached_workspace_ids: None,
            default_enabled: Some(server.enabled),
        },
        permissions: ExtensionPermissionProfile {
            trust_level: if server.transport == "stdio" {
                "elevated".to_string()
            } else {
                "networked".to_string()
            },
            approval_mode: server.permission_policy.clone(),
            requires_filesystem_access: Some(server.transport == "stdio"),
            requires_network_access: Some(matches!(server.transport.as_str(), "http" | "sse")),
            requires_secrets: Some(
                server
                    .env_json
                    .as_deref()
                    .is_some_and(|v| !v.trim().is_empty())
                    || server
                        .headers_json
                        .as_deref()
                        .is_some_and(|v| !v.trim().is_empty()),
            ),
        },
        contributions: vec![ExtensionContributionSummary {
            id: format!("mcp-tool-provider::{}", server.id),
            type_: "tool_provider".to_string(),
            name: server.name.clone(),
            description: Some(format!("{tool_count} tool(s) exposed through MCP")),
            user_invocable: Some(true),
            runtime_label: Some(server.transport.clone()),
        }],
        tags: vec!["mcp".to_string(), server.transport.clone()],
        created_at: None,
        updated_at: None,
    }
}

fn extract_capability_names(agent: &ExternalAgent) -> Vec<String> {
    let parsed = serde_json::from_str::<Value>(&agent.capabilities_json).unwrap_or(Value::Null);
    match parsed.get("taskKinds") {
        Some(Value::Array(values)) => values
            .iter()
            .filter_map(|item| item.as_str().map(ToString::to_string))
            .collect(),
        _ => Vec::new(),
    }
}

fn summarize_external_agent(agent: ExternalAgent) -> ExtensionSummary {
    let capability_names = extract_capability_names(&agent);
    let health_status = if !agent.enabled {
        "warning"
    } else if agent.base_url.as_deref().unwrap_or("").trim().is_empty() {
        "error"
    } else {
        "healthy"
    };

    let summary = match health_status {
        "error" => Some("Remote connector is missing a base URL.".to_string()),
        "warning" => Some("Connector is installed but currently disabled.".to_string()),
        _ => Some(format!(
            "{} declared task kind(s).",
            capability_names.len().max(1)
        )),
    };

    ExtensionSummary {
        id: format!("external_agent::{}", agent.id),
        kind: "external_agent".to_string(),
        name: agent.name.clone(),
        description: Some(format!("{} external execution connector", agent.kind)),
        version: None,
        enabled: agent.enabled,
        source: ExtensionSourceInfo {
            kind: "remote_connector".to_string(),
            label: Some(agent.kind.clone()),
            path: agent.base_url.clone(),
            r#ref: None,
        },
        health: ExtensionHealth {
            status: health_status.to_string(),
            summary,
            checked_at: None,
        },
        scope: ExtensionScope {
            availability: "workspace_attachable".to_string(),
            attached_workspace_ids: None,
            default_enabled: Some(agent.enabled),
        },
        permissions: ExtensionPermissionProfile {
            trust_level: "networked".to_string(),
            approval_mode: "inherit".to_string(),
            requires_filesystem_access: Some(false),
            requires_network_access: Some(true),
            requires_secrets: Some(
                agent
                    .auth_config_json
                    .as_deref()
                    .is_some_and(|v| !v.trim().is_empty()),
            ),
        },
        contributions: vec![ExtensionContributionSummary {
            id: format!("external-agent-task-executor::{}", agent.id),
            type_: "task_executor".to_string(),
            name: agent.name.clone(),
            description: Some(if capability_names.is_empty() {
                "Remote task executor".to_string()
            } else {
                format!("Supports: {}", capability_names.join(", "))
            }),
            user_invocable: Some(true),
            runtime_label: Some(agent.kind.clone()),
        }],
        tags: {
            let mut tags = vec!["external-agent".to_string(), agent.kind.clone()];
            tags.extend(capability_names);
            tags
        },
        created_at: Some(agent.created_at.to_string()),
        updated_at: Some(agent.updated_at.to_string()),
    }
}

#[tauri::command]
pub async fn list_extensions(state: State<'_, AppState>) -> Result<Vec<ExtensionSummary>, String> {
    let mut result = Vec::new();

    let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    let skills = open_agent_sdk::skills::load_all_global(&home);
    let disabled_skills = wisespace_core::repo::skill::get_disabled_skills(&state.sea_db)
        .await
        .map_err(|e| e.to_string())?;
    for skill in skills {
        let info = SkillInfo {
            name: skill.name.clone(),
            description: skill.metadata.description.clone().unwrap_or_default(),
            author: skill
                .metadata
                .metadata
                .as_ref()
                .and_then(|m| m.get("author"))
                .and_then(|v| v.as_str())
                .map(String::from),
            version: skill
                .metadata
                .metadata
                .as_ref()
                .and_then(|m| m.get("version"))
                .and_then(|v| v.as_str())
                .map(String::from),
            source: skill.source.as_str().to_string(),
            source_path: skill.path.to_string_lossy().to_string(),
            enabled: !disabled_skills.contains(&skill.name),
            has_update: false,
            user_invocable: skill.metadata.user_invocable,
            argument_hint: skill.metadata.argument_hint.clone(),
            when_to_use: skill.metadata.when_to_use.clone(),
            group: skill.group.clone(),
        };
        result.push(summarize_skill(info));
    }

    let servers = wisespace_core::repo::mcp_server::list_mcp_servers(&state.sea_db)
        .await
        .map_err(|e| e.to_string())?;
    for server in servers {
        let tool_count = wisespace_core::repo::mcp_server::list_tools_for_server(&state.sea_db, &server.id)
            .await
            .map(|tools| tools.len())
            .unwrap_or(0);
        result.push(summarize_mcp(server, tool_count));
    }

    let agents = wisespace_core::repo::external_agent::list_external_agents(&state.sea_db)
        .await
        .map_err(|e| e.to_string())?;
    for agent in agents {
        result.push(summarize_external_agent(agent));
    }

    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summarize_mcp_marks_missing_http_endpoint_as_error() {
        let summary = summarize_mcp(
            McpServer {
                id: "srv-1".to_string(),
                name: "Remote Tools".to_string(),
                transport: "http".to_string(),
                command: None,
                args_json: None,
                endpoint: None,
                env_json: None,
                enabled: true,
                permission_policy: "ask".to_string(),
                source: "custom".to_string(),
                discover_timeout_secs: None,
                execute_timeout_secs: None,
                headers_json: None,
                icon_type: None,
                icon_value: None,
            },
            0,
        );

        assert_eq!(summary.kind, "mcp_server");
        assert_eq!(summary.health.status, "error");
        assert_eq!(summary.permissions.trust_level, "networked");
    }

    #[test]
    fn summarize_external_agent_exposes_task_executor_contribution() {
        let summary = summarize_external_agent(ExternalAgent {
            id: "agent-1".to_string(),
            name: "Code Runner".to_string(),
            kind: "custom_http".to_string(),
            base_url: Some("http://localhost:9000".to_string()),
            auth_type: "none".to_string(),
            auth_config_json: None,
            capabilities_json: r#"{"taskKinds":["general","code"]}"#.to_string(),
            enabled: true,
            created_at: 1,
            updated_at: 2,
        });

        assert_eq!(summary.kind, "external_agent");
        assert_eq!(summary.health.status, "healthy");
        assert_eq!(summary.contributions[0].type_, "task_executor");
        assert!(summary.tags.iter().any(|tag| tag == "code"));
    }
}
