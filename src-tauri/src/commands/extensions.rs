use crate::AppState;
use tauri::State;
use wisespace_core::types::{
    CreateMcpServerInput, ExtensionContributionSummary, ExtensionDetail, ExtensionDiagnostics,
    ExtensionHealth, ExtensionPermissionProfile, ExtensionRuntimeInfo, ExtensionScope,
    ExtensionSourceInfo, ExtensionSummary, McpServer, SkillInfo,
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
        runtime: Some(ExtensionRuntimeInfo {
            host_kind: "native_skill_loader".to_string(),
            isolation: "in_process".to_string(),
            supports_hot_reload: Some(false),
            supports_connection_test: Some(false),
            supports_enable_toggle: Some(true),
            health_managed_by_host: Some(false),
        }),
        contributions: vec![ExtensionContributionSummary {
            id: format!("skill-contribution::{}", skill.name),
            type_: "prompt_skill".to_string(),
            name: skill.name.clone(),
            description: skill
                .when_to_use
                .clone()
                .or_else(|| Some(skill.description.clone())),
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
    } else if server.transport == "stdio"
        && server.command.as_deref().unwrap_or("").trim().is_empty()
    {
        "error"
    } else if matches!(server.transport.as_str(), "http" | "sse")
        && server.endpoint.as_deref().unwrap_or("").trim().is_empty()
    {
        "error"
    } else {
        "healthy"
    };

    let summary = match health_status {
        "error" => {
            Some("Server configuration is incomplete for the selected transport.".to_string())
        }
        "warning" => Some("Server is installed but currently disabled.".to_string()),
        _ => Some(format!("{tool_count} discovered tool(s) available.")),
    };

    ExtensionSummary {
        id: format!("mcp_server::{}", server.id),
        kind: "mcp_server".to_string(),
        name: server.name.clone(),
        description: Some(format!(
            "{} transport MCP server",
            server.transport.to_uppercase()
        )),
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
        runtime: Some(ExtensionRuntimeInfo {
            host_kind: "mcp_host".to_string(),
            isolation: if server.transport == "stdio" {
                "subprocess".to_string()
            } else {
                "remote".to_string()
            },
            supports_hot_reload: Some(false),
            supports_connection_test: Some(true),
            supports_enable_toggle: Some(true),
            health_managed_by_host: Some(true),
        }),
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

fn parse_extension_id(id: &str) -> Result<(&str, &str), String> {
    id.split_once("::")
        .ok_or_else(|| format!("Invalid extension id: {id}"))
}

async fn load_skill_summary(state: &AppState, local_id: &str) -> Result<ExtensionSummary, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    let skills = open_agent_sdk::skills::load_all_global(&home);
    let disabled_skills = wisespace_core::repo::skill::get_disabled_skills(&state.sea_db)
        .await
        .map_err(|e| e.to_string())?;
    let skill = skills
        .into_iter()
        .find(|item| item.name == local_id)
        .ok_or_else(|| format!("Skill not found: {local_id}"))?;

    Ok(summarize_skill(SkillInfo {
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
    }))
}

async fn load_mcp_summary(state: &AppState, local_id: &str) -> Result<ExtensionSummary, String> {
    let server = wisespace_core::repo::mcp_server::get_mcp_server(&state.sea_db, local_id)
        .await
        .map_err(|e| e.to_string())?;
    let tool_count =
        wisespace_core::repo::mcp_server::list_tools_for_server(&state.sea_db, local_id)
            .await
            .map(|tools| tools.len())
            .unwrap_or(0);
    Ok(summarize_mcp(server, tool_count))
}

fn skill_detail(info: SkillInfo) -> ExtensionDetail {
    let summary = summarize_skill(info.clone());
    ExtensionDetail {
        summary,
        manifest: None,
        diagnostics: Some(ExtensionDiagnostics {
            can_test_connection: Some(false),
            can_check_updates: Some(false),
            last_error: None,
            compatibility_notes: Some(vec![
                "Skills currently run inside the native skill host.".to_string(),
                "Workspace attachment is supported, but runtime isolation is not yet separated into a dedicated plugin sandbox.".to_string(),
            ]),
        }),
        kind_detail: Some(serde_json::json!({
            "argumentHint": info.argument_hint,
            "whenToUse": info.when_to_use,
            "group": info.group,
            "sourcePath": info.source_path,
        })),
    }
}

fn mcp_detail(server: McpServer, tool_count: usize) -> ExtensionDetail {
    let last_error = if !server.enabled {
        None
    } else if server.transport == "stdio"
        && server.command.as_deref().unwrap_or("").trim().is_empty()
    {
        Some("Missing command for stdio transport.".to_string())
    } else if matches!(server.transport.as_str(), "http" | "sse")
        && server.endpoint.as_deref().unwrap_or("").trim().is_empty()
    {
        Some("Missing endpoint for remote transport.".to_string())
    } else {
        None
    };

    let summary = summarize_mcp(server.clone(), tool_count);
    ExtensionDetail {
        summary,
        manifest: Some(serde_json::json!({
            "transport": server.transport,
            "command": server.command,
            "endpoint": server.endpoint,
            "discoverTimeoutSecs": server.discover_timeout_secs,
            "executeTimeoutSecs": server.execute_timeout_secs,
            "permissionPolicy": server.permission_policy,
            "source": server.source,
        })),
        diagnostics: Some(ExtensionDiagnostics {
            can_test_connection: Some(true),
            can_check_updates: Some(false),
            last_error,
            compatibility_notes: Some(vec![
                "stdio MCP servers run in a subprocess host.".to_string(),
                "http / sse MCP servers are treated as remote plugin runtimes.".to_string(),
            ]),
        }),
        kind_detail: Some(serde_json::json!({
            "transport": server.transport,
            "toolCount": tool_count,
            "permissionPolicy": server.permission_policy,
        })),
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
        let tool_count =
            wisespace_core::repo::mcp_server::list_tools_for_server(&state.sea_db, &server.id)
                .await
                .map(|tools| tools.len())
                .unwrap_or(0);
        result.push(summarize_mcp(server, tool_count));
    }

    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(result)
}

#[tauri::command]
pub async fn get_extension_detail(
    state: State<'_, AppState>,
    id: String,
) -> Result<ExtensionDetail, String> {
    let (kind, local_id) = parse_extension_id(&id)?;

    match kind {
        "skill" => {
            let home =
                dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
            let skills = open_agent_sdk::skills::load_all_global(&home);
            let disabled_skills = wisespace_core::repo::skill::get_disabled_skills(&state.sea_db)
                .await
                .map_err(|e| e.to_string())?;
            let skill = skills
                .into_iter()
                .find(|item| item.name == local_id)
                .ok_or_else(|| format!("Skill not found: {local_id}"))?;

            Ok(skill_detail(SkillInfo {
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
            }))
        }
        "mcp_server" => {
            let server = wisespace_core::repo::mcp_server::get_mcp_server(&state.sea_db, local_id)
                .await
                .map_err(|e| e.to_string())?;
            let tool_count =
                wisespace_core::repo::mcp_server::list_tools_for_server(&state.sea_db, local_id)
                    .await
                    .map(|tools| tools.len())
                    .unwrap_or(0);
            Ok(mcp_detail(server, tool_count))
        }
        _ => Err(format!("Unsupported extension kind: {kind}")),
    }
}

#[tauri::command]
pub async fn set_extension_enabled(
    state: State<'_, AppState>,
    id: String,
    enabled: bool,
) -> Result<ExtensionSummary, String> {
    let (kind, local_id) = parse_extension_id(&id)?;

    match kind {
        "skill" => {
            wisespace_core::repo::skill::set_skill_enabled(&state.sea_db, local_id, enabled)
                .await
                .map_err(|e| e.to_string())?;
            load_skill_summary(&state, local_id).await
        }
        "mcp_server" => {
            let existing =
                wisespace_core::repo::mcp_server::get_mcp_server(&state.sea_db, local_id)
                    .await
                    .map_err(|e| e.to_string())?;
            wisespace_core::repo::mcp_server::update_mcp_server(
                &state.sea_db,
                local_id,
                CreateMcpServerInput {
                    name: existing.name.clone(),
                    transport: existing.transport.clone(),
                    command: existing.command.clone(),
                    args: existing
                        .args_json
                        .as_deref()
                        .and_then(|raw| serde_json::from_str::<Vec<String>>(raw).ok()),
                    endpoint: existing.endpoint.clone(),
                    env: existing
                        .env_json
                        .as_deref()
                        .and_then(|raw| serde_json::from_str(raw).ok()),
                    enabled: Some(enabled),
                    permission_policy: Some(existing.permission_policy.clone()),
                    source: Some(existing.source.clone()),
                    discover_timeout_secs: existing.discover_timeout_secs,
                    execute_timeout_secs: existing.execute_timeout_secs,
                    headers_json: existing.headers_json.clone(),
                    icon_type: existing.icon_type.clone(),
                    icon_value: existing.icon_value.clone(),
                },
            )
            .await
            .map_err(|e| e.to_string())?;
            load_mcp_summary(&state, local_id).await
        }
        _ => Err(format!("Unsupported extension kind: {kind}")),
    }
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
    fn mcp_detail_exposes_runtime_isolation_and_diagnostics() {
        let detail = mcp_detail(
            McpServer {
                id: "srv-1".to_string(),
                name: "Local Tools".to_string(),
                transport: "stdio".to_string(),
                command: Some("node".to_string()),
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
            3,
        );

        assert_eq!(
            detail
                .summary
                .runtime
                .as_ref()
                .map(|runtime| runtime.host_kind.as_str()),
            Some("mcp_host")
        );
        assert_eq!(
            detail
                .summary
                .runtime
                .as_ref()
                .map(|runtime| runtime.isolation.as_str()),
            Some("subprocess")
        );
        assert_eq!(
            detail
                .diagnostics
                .as_ref()
                .and_then(|d| d.can_test_connection),
            Some(true)
        );
        assert!(detail.kind_detail.is_some());
    }
}
