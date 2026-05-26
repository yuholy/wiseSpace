use std::path::{Path, PathBuf};

use crate::error::{Result, WiseSpaceError};

const PI_GATEWAY_API_KEY_PLACEHOLDER: &str = "WISESPACE_GATEWAY_API_KEY";
const CLAUDE_DEFAULT_MODEL: &str = "claude-sonnet-4-6-20251117";
const CLAUDE_DEFAULT_OPUS_MODEL: &str = "claude-opus-4-7-20260127";
const CLAUDE_DEFAULT_SONNET_MODEL: &str = "claude-sonnet-4-6-20251117";
const CLAUDE_DEFAULT_HAIKU_MODEL: &str = "claude-haiku-4-5-20251001";
const CLAUDE_DEFAULT_SUBAGENT_MODEL: &str = "claude-haiku-4-5-20251001";

// ─── Types ──────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CliTool {
    ClaudeCode,
    Codex,
    OpenCode,
    Pi,
    DeepSeekTui,
}

impl CliTool {
    pub fn from_str(s: &str) -> Result<Self> {
        match s {
            "claude_code" => Ok(Self::ClaudeCode),
            "codex" => Ok(Self::Codex),
            "opencode" => Ok(Self::OpenCode),
            "pi" => Ok(Self::Pi),
            "deepseek_tui" => Ok(Self::DeepSeekTui),
            _ => Err(WiseSpaceError::NotFound(format!("Unknown CLI tool: {}", s))),
        }
    }

    pub fn id(&self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude_code",
            Self::Codex => "codex",
            Self::OpenCode => "opencode",
            Self::Pi => "pi",
            Self::DeepSeekTui => "deepseek_tui",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::ClaudeCode => "Claude Code",
            Self::Codex => "Codex",
            Self::OpenCode => "OpenCode",
            Self::Pi => "Pi",
            Self::DeepSeekTui => "DeepSeek-TUI",
        }
    }

    pub fn command_name(&self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude",
            Self::Codex => "codex",
            Self::OpenCode => "opencode",
            Self::Pi => "pi",
            Self::DeepSeekTui => "deepseek",
        }
    }

    pub fn version_arg(&self) -> &'static str {
        match self {
            Self::ClaudeCode => "--version",
            Self::Codex => "--version",
            Self::OpenCode => "--version",
            Self::Pi => "--version",
            Self::DeepSeekTui => "--version",
        }
    }

    pub fn install_package_name(&self) -> Option<&'static str> {
        match self {
            Self::Pi => Some("@earendil-works/pi-coding-agent"),
            Self::DeepSeekTui => Some("deepseek-tui"),
            _ => None,
        }
    }

    pub fn all() -> &'static [CliTool] {
        &[
            Self::ClaudeCode,
            Self::Codex,
            Self::OpenCode,
            Self::Pi,
            Self::DeepSeekTui,
        ]
    }
}

// ─── Tool Detection ─────────────────────────────────────

/// Returns the detected version string if the tool is installed, or None.
pub fn check_installed_version(tool: CliTool) -> Option<String> {
    match tool {
        CliTool::DeepSeekTui => run_version_command("deepseek", tool.version_arg())
            .or_else(|| run_version_command("deepseek-tui", tool.version_arg())),
        CliTool::Pi => run_version_command("pi", tool.version_arg()),
        CliTool::ClaudeCode | CliTool::Codex | CliTool::OpenCode => {
            if matches!(tool, CliTool::OpenCode) && !check_command_exists_cross_platform(tool.command_name()) {
                None
            } else {
                run_version_command(tool.command_name(), tool.version_arg())
            }
        }
    }
}

pub fn check_installed(tool: CliTool) -> bool {
    check_installed_version(tool).is_some() || check_config_exists(tool)
}

/// Returns true if any known config file for the tool exists on disk.
pub fn check_config_exists(tool: CliTool) -> bool {
    config_paths(tool)
        .map(|paths| paths.iter().any(|p| p.exists()))
        .unwrap_or(false)
}

fn run_version_command(cmd: &str, arg: &str) -> Option<String> {
    std::process::Command::new(cmd)
        .arg(arg)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| {
            let out = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if out.is_empty() {
                None
            } else {
                Some(out)
            }
        })
}

#[cfg(target_os = "linux")]
fn check_command_exists(cmd: &str) -> bool {
    std::process::Command::new("which")
        .arg(cmd)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn check_command_exists_cross_platform(cmd: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("where")
            .arg(cmd)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("which")
            .arg(cmd)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
    #[cfg(target_os = "linux")]
    {
        check_command_exists(cmd)
    }
}

// ─── Config Paths ───────────────────────────────────────

fn home_dir() -> Result<PathBuf> {
    dirs_next().ok_or_else(|| WiseSpaceError::NotFound("Could not determine home directory".into()))
}

fn dirs_next() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| std::env::var("USERPROFILE").ok().map(PathBuf::from))
}

fn config_paths(tool: CliTool) -> Result<Vec<PathBuf>> {
    let home = home_dir()?;
    match tool {
        CliTool::ClaudeCode => Ok(vec![
            home.join(".claude").join("settings.json"),
            home.join(".claude").join("config.json"),
        ]),
        CliTool::Codex => Ok(vec![
            home.join(".codex").join("auth.json"),
            home.join(".codex").join("config.toml"),
        ]),
        CliTool::OpenCode => Ok(vec![home
            .join(".config")
            .join("opencode")
            .join("opencode.json")]),
        CliTool::Pi => Ok(vec![home.join(".pi").join("agent").join("models.json")]),
        CliTool::DeepSeekTui => Ok(vec![home.join(".deepseek").join("config.toml")]),
    }
}

// ─── Backup / Restore ───────────────────────────────────

fn backup_dir() -> Result<PathBuf> {
    let home = home_dir()?;
    Ok(home.join(".wisespace").join("backups"))
}

fn backup_path(tool: CliTool, filename: &str) -> Result<PathBuf> {
    Ok(backup_dir()?.join(tool.id()).join(filename))
}

fn backup_file(path: &Path, tool: CliTool) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("config");
    let dest = backup_path(tool, filename)?;
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| WiseSpaceError::Gateway(format!("Failed to create backup dir: {}", e)))?;
    }
    std::fs::copy(path, &dest).map_err(|e| {
        WiseSpaceError::Gateway(format!("Failed to backup {}: {}", path.display(), e))
    })?;
    Ok(())
}

fn restore_file(tool: CliTool, filename: &str, dest: &Path) -> Result<bool> {
    let src = backup_path(tool, filename)?;
    if !src.exists() {
        return Ok(false);
    }
    std::fs::copy(&src, dest)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to restore backup: {}", e)))?;
    Ok(true)
}

/// Atomic write: write to temp file then rename
fn atomic_write(path: &Path, content: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| WiseSpaceError::Gateway(format!("Failed to create dir: {}", e)))?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, content)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to write temp file: {}", e)))?;
    std::fs::rename(&tmp, path)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to rename temp file: {}", e)))?;
    Ok(())
}

// ─── Connection Status ──────────────────────────────────

/// Public validation entrypoint for tests and CLI.
/// Returns Ok(true) if the tool's configuration satisfies the connection contract.
/// Does NOT check whether the tool is installed (use check_installed separately).
pub fn validate_connection(tool: CliTool, gateway_url: &str) -> Result<bool> {
    is_connected(tool, gateway_url)
}

pub fn get_status(tool: CliTool, gateway_url: &str) -> &'static str {
    if !check_installed(tool) {
        return "not_installed";
    }
    match validate_connection(tool, gateway_url) {
        Ok(true) => "connected",
        _ => "not_connected",
    }
}

/// Single source of truth for "is this tool configured to use the gateway".
/// Used both by get_status and as the post-write self-check in connect().
fn is_connected(tool: CliTool, gateway_url: &str) -> Result<bool> {
    let paths = config_paths(tool)?;
    match tool {
        CliTool::ClaudeCode => check_claude_code_connected(&paths[0], &paths[1], gateway_url),
        CliTool::Codex => check_codex_connected(&paths[0], &paths[1], gateway_url),
        CliTool::OpenCode => check_opencode_connected(&paths[0], gateway_url),
        CliTool::Pi => check_pi_connected(&paths[0], gateway_url),
        CliTool::DeepSeekTui => check_deepseek_tui_connected(&paths[0], gateway_url),
    }
}

/// ClaudeCode (~/.claude/settings.json + ~/.claude/config.json):
/// connected = settings.json env.ANTHROPIC_BASE_URL == gateway_url AND
///             env.ANTHROPIC_AUTH_TOKEN is non-empty AND
///             config.json has primaryApiKey == "any".
fn check_claude_code_connected(
    settings_path: &Path,
    config_path: &Path,
    gateway_url: &str,
) -> Result<bool> {
    if !settings_path.exists() || !config_path.exists() {
        return Ok(false);
    }

    // Check settings.json
    let settings = read_json_file(settings_path)?;
    let env = settings.get("env");
    let url_ok = env
        .and_then(|value| value.get("ANTHROPIC_BASE_URL"))
        .and_then(|v| v.as_str())
        == Some(gateway_url);
    let key_ok = env
        .and_then(|value| value.get("ANTHROPIC_AUTH_TOKEN"))
        .and_then(|v| v.as_str())
        .map(|k| !k.is_empty())
        .unwrap_or(false);

    // Check config.json
    let config = read_json_file(config_path)?;
    let primary_key_ok = config.get("primaryApiKey").and_then(|v| v.as_str()) == Some("any");

    Ok(url_ok && key_ok && primary_key_ok)
}

/// Codex (~/.codex/auth.json + ~/.codex/config.toml):
/// connected = auth.json has non-empty OPENAI_API_KEY AND config.toml has
/// model_provider="any" AND model_providers.any.base_url == gateway_url
/// AND model_providers.any.requires_openai_auth == true
/// AND model_providers.any.wire_api == "responses".
fn check_codex_connected(auth_path: &Path, config_path: &Path, gateway_url: &str) -> Result<bool> {
    if !auth_path.exists() || !config_path.exists() {
        return Ok(false);
    }
    let auth = read_json_file(auth_path)?;
    let token_ok = auth
        .get("OPENAI_API_KEY")
        .and_then(|v| v.as_str())
        .map(|t| !t.is_empty())
        .unwrap_or(false);
    if !token_ok {
        return Ok(false);
    }
    let content = std::fs::read_to_string(config_path)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to read config.toml: {}", e)))?;
    let doc = content
        .parse::<toml_edit::DocumentMut>()
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to parse TOML: {}", e)))?;
    let provider_ok = doc.get("model_provider").and_then(|v| v.as_str()) == Some("any");
    let base_url_ok = doc
        .get("model_providers")
        .and_then(|p| p.as_table())
        .and_then(|t| t.get("any"))
        .and_then(|a| a.as_table())
        .and_then(|t| t.get("base_url"))
        .and_then(|v| v.as_str())
        == Some(gateway_url);
    let requires_openai_auth_ok = doc
        .get("model_providers")
        .and_then(|p| p.as_table())
        .and_then(|t| t.get("any"))
        .and_then(|a| a.as_table())
        .and_then(|t| t.get("requires_openai_auth"))
        .and_then(|v| v.as_bool())
        == Some(true);
    let wire_api_ok = doc
        .get("model_providers")
        .and_then(|p| p.as_table())
        .and_then(|t| t.get("any"))
        .and_then(|a| a.as_table())
        .and_then(|t| t.get("wire_api"))
        .and_then(|v| v.as_str())
        == Some("responses");
    Ok(provider_ok && base_url_ok && requires_openai_auth_ok && wire_api_ok)
}

/// OpenCode (~/.config/opencode/opencode.json):
/// connected = provider.wisespace.baseURL == gateway_url AND provider.wisespace.apiKey is non-empty.
fn check_opencode_connected(path: &Path, gateway_url: &str) -> Result<bool> {
    if !path.exists() {
        return Ok(false);
    }
    let json = read_json_file(path)?;
    let wisespace = json.get("provider").and_then(|p| p.get("wisespace"));
    let url_ok = wisespace
        .and_then(|a| a.get("baseURL"))
        .and_then(|v| v.as_str())
        == Some(gateway_url);
    let key_ok = wisespace
        .and_then(|a| a.get("apiKey"))
        .and_then(|v| v.as_str())
        .map(|k| !k.is_empty())
        .unwrap_or(false);
    Ok(url_ok && key_ok)
}

/// Pi (~/.pi/agent/models.json):
/// connected = providers.wisespace.baseUrl == gateway_url AND providers.wisespace.apiKey is non-empty.
fn check_pi_connected(path: &Path, gateway_url: &str) -> Result<bool> {
    if !path.exists() {
        return Ok(false);
    }
    let json = read_json_file(path)?;
    let wisespace = json.get("providers").and_then(|value| value.get("wisespace"));
    let url_ok = wisespace
        .and_then(|value| value.get("baseUrl"))
        .and_then(|v| v.as_str())
        == Some(gateway_url);
    let key_ok = wisespace
        .and_then(|value| value.get("apiKey"))
        .and_then(|v| v.as_str())
        .map(|k| !k.is_empty() && k != PI_GATEWAY_API_KEY_PLACEHOLDER)
        .unwrap_or(false);
    Ok(url_ok && key_ok)
}

/// DeepSeek-TUI (~/.deepseek/config.toml):
/// connected = provider == "openai" AND providers.openai.base_url == gateway_url
///             AND providers.openai.api_key is non-empty.
fn check_deepseek_tui_connected(path: &Path, gateway_url: &str) -> Result<bool> {
    if !path.exists() {
        return Ok(false);
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to read config.toml: {}", e)))?;
    let doc = content
        .parse::<toml_edit::DocumentMut>()
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to parse TOML: {}", e)))?;
    let provider_ok = doc.get("provider").and_then(|v| v.as_str()) == Some("openai");
    let base_url_ok = doc
        .get("providers")
        .and_then(|value| value.as_table())
        .and_then(|table| table.get("openai"))
        .and_then(|item| item.as_table())
        .and_then(|table| table.get("base_url"))
        .and_then(|v| v.as_str())
        == Some(gateway_url);
    let api_key_ok = doc
        .get("providers")
        .and_then(|value| value.as_table())
        .and_then(|table| table.get("openai"))
        .and_then(|item| item.as_table())
        .and_then(|table| table.get("api_key"))
        .and_then(|v| v.as_str())
        .map(|value| !value.is_empty())
        .unwrap_or(false);
    Ok(provider_ok && base_url_ok && api_key_ok)
}

// ─── Connect ────────────────────────────────────────────

/// Roll back all config files for a tool to the most recent backup.
/// Files that had no backup (newly created) are removed.
/// Best-effort: errors are silently ignored so this never masks the original error.
fn rollback_to_backup(tool: CliTool) {
    if let Ok(paths) = config_paths(tool) {
        for p in &paths {
            let filename = p.file_name().and_then(|n| n.to_str()).unwrap_or("config");
            match restore_file(tool, filename, p) {
                Ok(true) => {}
                Ok(false) => {
                    // No backup existed — the file was newly created; remove it.
                    if p.exists() {
                        let _ = std::fs::remove_file(p);
                    }
                }
                Err(_) => {}
            }
        }
    }
}

pub fn connect(tool: CliTool, gateway_url: &str, api_key: &str) -> Result<()> {
    let paths = config_paths(tool)?;
    // Backup all existing config files before any writes.
    for p in &paths {
        backup_file(p, tool)?;
    }

    // Write the new config.
    let write_result = match tool {
        CliTool::ClaudeCode => connect_claude_code(&paths[0], &paths[1], gateway_url, api_key),
        CliTool::Codex => connect_codex(&paths[0], &paths[1], gateway_url, api_key),
        CliTool::OpenCode => connect_opencode(&paths[0], gateway_url, api_key),
        CliTool::Pi => connect_pi(&paths[0], gateway_url, api_key),
        CliTool::DeepSeekTui => connect_deepseek_tui(&paths[0], gateway_url, api_key),
    };
    if let Err(e) = write_result {
        rollback_to_backup(tool);
        return Err(WiseSpaceError::Gateway(format!(
            "Failed to write {} config (rolled back): {}",
            tool.display_name(),
            e
        )));
    }

    // Post-write self-check: verify the written config actually satisfies the
    // validation contract before declaring success.
    match is_connected(tool, gateway_url) {
        Ok(true) => Ok(()),
        Ok(false) => {
            rollback_to_backup(tool);
            Err(WiseSpaceError::Gateway(format!(
                "Post-write validation failed for {}: config does not appear connected after write (rolled back)",
                tool.display_name()
            )))
        }
        Err(e) => {
            rollback_to_backup(tool);
            Err(WiseSpaceError::Gateway(format!(
                "Post-write validation error for {} (rolled back): {}",
                tool.display_name(),
                e
            )))
        }
    }
}

fn connect_claude_code(
    settings_path: &Path,
    config_path: &Path,
    gateway_url: &str,
    api_key: &str,
) -> Result<()> {
    // Write settings.json
    let mut settings = read_json_or_empty(settings_path)?;
    let obj = settings.as_object_mut().ok_or_else(|| {
        WiseSpaceError::Gateway("Claude Code settings is not a JSON object".into())
    })?;
    obj.insert(
        "apiBaseUrl".into(),
        serde_json::Value::String(gateway_url.into()),
    );
    obj.insert("apiKey".into(), serde_json::Value::String(api_key.into()));
    if !obj.contains_key("env") {
        obj.insert("env".into(), serde_json::json!({}));
    }
    let env = obj
        .get_mut("env")
        .and_then(|value| value.as_object_mut())
        .ok_or_else(|| {
            WiseSpaceError::Gateway("Claude Code settings.env is not a JSON object".into())
        })?;
    env.insert(
        "ANTHROPIC_BASE_URL".into(),
        serde_json::Value::String(gateway_url.into()),
    );
    env.insert(
        "ANTHROPIC_AUTH_TOKEN".into(),
        serde_json::Value::String(api_key.into()),
    );
    env.insert(
        "ANTHROPIC_MODEL".into(),
        serde_json::Value::String(CLAUDE_DEFAULT_MODEL.into()),
    );
    env.insert(
        "ANTHROPIC_DEFAULT_OPUS_MODEL".into(),
        serde_json::Value::String(CLAUDE_DEFAULT_OPUS_MODEL.into()),
    );
    env.insert(
        "ANTHROPIC_DEFAULT_SONNET_MODEL".into(),
        serde_json::Value::String(CLAUDE_DEFAULT_SONNET_MODEL.into()),
    );
    env.insert(
        "ANTHROPIC_DEFAULT_HAIKU_MODEL".into(),
        serde_json::Value::String(CLAUDE_DEFAULT_HAIKU_MODEL.into()),
    );
    env.insert(
        "CLAUDE_CODE_SUBAGENT_MODEL".into(),
        serde_json::Value::String(CLAUDE_DEFAULT_SUBAGENT_MODEL.into()),
    );
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to serialize JSON: {}", e)))?;
    atomic_write(settings_path, &content)?;

    // Write config.json
    let mut config = read_json_or_empty(config_path)?;
    let config_obj = config
        .as_object_mut()
        .ok_or_else(|| WiseSpaceError::Gateway("Claude Code config is not a JSON object".into()))?;
    config_obj.insert(
        "primaryApiKey".into(),
        serde_json::Value::String("any".into()),
    );
    let config_content = serde_json::to_string_pretty(&config)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to serialize config JSON: {}", e)))?;
    atomic_write(config_path, &config_content)
}

fn connect_codex(
    auth_path: &Path,
    config_path: &Path,
    gateway_url: &str,
    api_key: &str,
) -> Result<()> {
    // Write auth.json
    let auth_json = serde_json::json!({
        "OPENAI_API_KEY": api_key
    });
    let auth_content = serde_json::to_string_pretty(&auth_json)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to serialize auth JSON: {}", e)))?;
    atomic_write(auth_path, &auth_content)?;

    // Edit config.toml preserving format
    let content = if config_path.exists() {
        std::fs::read_to_string(config_path)
            .map_err(|e| WiseSpaceError::Gateway(format!("Failed to read config.toml: {}", e)))?
    } else {
        String::new()
    };

    let mut doc = content
        .parse::<toml_edit::DocumentMut>()
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to parse TOML: {}", e)))?;

    doc["model_provider"] = toml_edit::value("any");

    // Ensure [model_providers.any] section exists
    if !doc.contains_key("model_providers") {
        doc["model_providers"] = toml_edit::Item::Table(toml_edit::Table::new());
    }
    let providers = doc["model_providers"]
        .as_table_mut()
        .ok_or_else(|| WiseSpaceError::Gateway("model_providers is not a table".into()))?;

    if !providers.contains_key("any") {
        providers["any"] = toml_edit::Item::Table(toml_edit::Table::new());
    }
    let any = providers["any"]
        .as_table_mut()
        .ok_or_else(|| WiseSpaceError::Gateway("model_providers.any is not a table".into()))?;

    any["name"] = toml_edit::value("wiseSpace Gateway");
    any["base_url"] = toml_edit::value(gateway_url);
    any["wire_api"] = toml_edit::value("responses");
    any["requires_openai_auth"] = toml_edit::value(true);

    atomic_write(config_path, &doc.to_string())
}

fn connect_opencode(config_path: &Path, gateway_url: &str, api_key: &str) -> Result<()> {
    let mut json = read_json_or_empty(config_path)?;
    let obj = json
        .as_object_mut()
        .ok_or_else(|| WiseSpaceError::Gateway("OpenCode config is not a JSON object".into()))?;

    if !obj.contains_key("$schema") {
        obj.insert(
            "$schema".into(),
            serde_json::Value::String("https://opencode.ai/config.json".into()),
        );
    }

    // Ensure provider object exists
    if !obj.contains_key("provider") {
        obj.insert("provider".into(), serde_json::json!({}));
    }

    let provider = obj
        .get_mut("provider")
        .unwrap()
        .as_object_mut()
        .ok_or_else(|| WiseSpaceError::Gateway("provider is not a JSON object".into()))?;

    provider.insert(
        "wisespace".into(),
        serde_json::json!({
            "apiKey": api_key,
            "baseURL": gateway_url,
            "models": {
                "default": {
                    "name": "Default Model"
                }
            }
        }),
    );

    let content = serde_json::to_string_pretty(&json)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to serialize JSON: {}", e)))?;
    atomic_write(config_path, &content)
}

fn connect_pi(config_path: &Path, gateway_url: &str, api_key: &str) -> Result<()> {
    let mut json = read_json_or_empty(config_path)?;
    let obj = json
        .as_object_mut()
        .ok_or_else(|| WiseSpaceError::Gateway("Pi models.json is not a JSON object".into()))?;

    if !obj.contains_key("providers") {
        obj.insert("providers".into(), serde_json::json!({}));
    }
    let providers = obj
        .get_mut("providers")
        .and_then(|value| value.as_object_mut())
        .ok_or_else(|| WiseSpaceError::Gateway("Pi providers is not a JSON object".into()))?;

    providers.insert(
        "wisespace".into(),
        serde_json::json!({
            "name": "wiseSpace Gateway",
            "baseUrl": gateway_url,
            "api": "openai-completions",
            "apiKey": api_key,
            "authHeader": true,
            "models": [
                {
                    "id": "gpt-5.4",
                    "name": "gpt-5.4",
                    "reasoning": true,
                    "input": ["text", "image"],
                    "contextWindow": 128000,
                    "maxTokens": 128000,
                    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
                },
                {
                    "id": "gpt-5.3-codex",
                    "name": "gpt-5.3-codex",
                    "reasoning": true,
                    "input": ["text", "image"],
                    "contextWindow": 128000,
                    "maxTokens": 128000,
                    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
                },
                {
                    "id": "deepseek-v4-pro",
                    "name": "deepseek-v4-pro",
                    "reasoning": true,
                    "input": ["text", "image"],
                    "contextWindow": 128000,
                    "maxTokens": 128000,
                    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
                },
                {
                    "id": "deepseek-v4-flash",
                    "name": "deepseek-v4-flash",
                    "reasoning": true,
                    "input": ["text", "image"],
                    "contextWindow": 128000,
                    "maxTokens": 128000,
                    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
                }
            ]
        }),
    );

    let content = serde_json::to_string_pretty(&json)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to serialize JSON: {}", e)))?;
    atomic_write(config_path, &content)
}

fn connect_deepseek_tui(config_path: &Path, gateway_url: &str, api_key: &str) -> Result<()> {
    let content = if config_path.exists() {
        std::fs::read_to_string(config_path)
            .map_err(|e| WiseSpaceError::Gateway(format!("Failed to read config.toml: {}", e)))?
    } else {
        String::new()
    };

    let mut doc = content
        .parse::<toml_edit::DocumentMut>()
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to parse TOML: {}", e)))?;

    doc["provider"] = toml_edit::value("openai");
    if doc.get("default_text_model").is_none() {
        doc["default_text_model"] = toml_edit::value("deepseek-v4-pro");
    }

    if !doc.contains_key("providers") {
        doc["providers"] = toml_edit::Item::Table(toml_edit::Table::new());
    }
    let providers = doc["providers"]
        .as_table_mut()
        .ok_or_else(|| WiseSpaceError::Gateway("providers is not a table".into()))?;

    if !providers.contains_key("openai") {
        providers["openai"] = toml_edit::Item::Table(toml_edit::Table::new());
    }
    let openai = providers["openai"]
        .as_table_mut()
        .ok_or_else(|| WiseSpaceError::Gateway("providers.openai is not a table".into()))?;

    openai["api_key"] = toml_edit::value(api_key);
    openai["base_url"] = toml_edit::value(gateway_url);

    atomic_write(config_path, &doc.to_string())
}

// ─── Disconnect ─────────────────────────────────────────

/// `gateway_url` is used to verify the tool is no longer connected after
/// field removal (only applies to the `restore_backup = false` path).
pub fn disconnect(tool: CliTool, restore_backup: bool, gateway_url: &str) -> Result<()> {
    if restore_backup {
        disconnect_restore(tool)
    } else {
        disconnect_remove_fields(tool, gateway_url)
    }
}

fn disconnect_restore(tool: CliTool) -> Result<()> {
    let paths = config_paths(tool)?;
    let mut any_restored = false;
    for p in &paths {
        let filename = p.file_name().and_then(|n| n.to_str()).unwrap_or("config");
        if restore_file(tool, filename, p)? {
            any_restored = true;
        }
    }
    if !any_restored {
        return Err(WiseSpaceError::Gateway(format!(
            "No backup found for {}. \
             To disconnect without restoring, use the standard disconnect path (restoreBackup: false).",
            tool.display_name()
        )));
    }
    Ok(())
}

fn disconnect_remove_fields(tool: CliTool, gateway_url: &str) -> Result<()> {
    let paths = config_paths(tool)?;

    // Backup all existing config files before any destructive changes so we
    // can roll back to the still-connected state if something goes wrong.
    for p in &paths {
        backup_file(p, tool)?;
    }

    let remove_result = match tool {
        CliTool::ClaudeCode => {
            let settings_result = remove_claude_settings_gateway_fields(&paths[0], gateway_url);
            let config_result = remove_claude_config_primary_api_key(&paths[1]);
            settings_result.and(config_result)
        }
        CliTool::Codex => {
            // Two-file operation: remove auth.json then clean config.toml.
            let auth_result = if paths[0].exists() {
                std::fs::remove_file(&paths[0]).map_err(|e| {
                    WiseSpaceError::Gateway(format!("Failed to remove auth.json: {}", e))
                })
            } else {
                Ok(())
            };
            auth_result.and_then(|_| remove_toml_wisespace_config(&paths[1]))
        }
        CliTool::OpenCode => remove_json_provider(&paths[0], "wisespace"),
        CliTool::Pi => remove_json_provider(&paths[0], "wisespace"),
        CliTool::DeepSeekTui => remove_toml_deepseek_openai_provider(&paths[0]),
    };

    if let Err(e) = remove_result {
        rollback_to_backup(tool);
        return Err(WiseSpaceError::Gateway(format!(
            "Failed to remove {} config fields (rolled back): {}",
            tool.display_name(),
            e
        )));
    }

    // Post-remove self-check: verify the tool no longer appears connected.
    match is_connected(tool, gateway_url) {
        Ok(false) => Ok(()),
        Ok(true) => {
            rollback_to_backup(tool);
            Err(WiseSpaceError::Gateway(format!(
                "Disconnect validation failed for {}: gateway config still present after field removal (rolled back)",
                tool.display_name()
            )))
        }
        Err(e) => {
            rollback_to_backup(tool);
            Err(WiseSpaceError::Gateway(format!(
                "Post-disconnect validation error for {} (rolled back): {}",
                tool.display_name(),
                e
            )))
        }
    }
}

fn remove_toml_wisespace_config(path: &Path) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to read TOML: {}", e)))?;
    let mut doc = content
        .parse::<toml_edit::DocumentMut>()
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to parse TOML: {}", e)))?;

    // Remove model_provider if it was "any"
    if doc.get("model_provider").and_then(|v| v.as_str()) == Some("any") {
        doc.remove("model_provider");
    }
    // Remove model_providers.any
    if let Some(providers) = doc
        .get_mut("model_providers")
        .and_then(|v| v.as_table_mut())
    {
        providers.remove("any");
        if providers.is_empty() {
            doc.remove("model_providers");
        }
    }

    atomic_write(path, &doc.to_string())
}

fn remove_json_provider(path: &Path, provider_name: &str) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to read: {}", e)))?;
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to parse JSON: {}", e)))?;
    if let Some(obj) = json.as_object_mut() {
        if let Some(provider) = obj.get_mut("provider").and_then(|p| p.as_object_mut()) {
            provider.remove(provider_name);
        }
        if let Some(providers) = obj.get_mut("providers").and_then(|p| p.as_object_mut()) {
            providers.remove(provider_name);
        }
    }
    let output = serde_json::to_string_pretty(&json)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to serialize JSON: {}", e)))?;
    atomic_write(path, &output)
}

fn remove_claude_config_primary_api_key(path: &Path) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to read config.json: {}", e)))?;
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to parse JSON: {}", e)))?;

    if let Some(obj) = json.as_object_mut() {
        // Only remove primaryApiKey if it's "any"
        if obj.get("primaryApiKey").and_then(|v| v.as_str()) == Some("any") {
            obj.remove("primaryApiKey");
        }
    }

    let output = serde_json::to_string_pretty(&json)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to serialize JSON: {}", e)))?;
    atomic_write(path, &output)
}

fn remove_claude_settings_gateway_fields(path: &Path, gateway_url: &str) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to read settings.json: {}", e)))?;
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to parse JSON: {}", e)))?;

    if let Some(obj) = json.as_object_mut() {
        let remove_legacy_top_level =
            obj.get("apiBaseUrl").and_then(|v| v.as_str()) == Some(gateway_url);
        if remove_legacy_top_level {
            obj.remove("apiBaseUrl");
            obj.remove("apiKey");
        }

        let remove_anthropic_env = obj
            .get("env")
            .and_then(|value| value.as_object())
            .and_then(|env| env.get("ANTHROPIC_BASE_URL"))
            .and_then(|v| v.as_str())
            == Some(gateway_url);
        if remove_anthropic_env {
            if let Some(env) = obj.get_mut("env").and_then(|value| value.as_object_mut()) {
                env.remove("ANTHROPIC_BASE_URL");
                env.remove("ANTHROPIC_AUTH_TOKEN");
            }
        }
    }

    let output = serde_json::to_string_pretty(&json)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to serialize JSON: {}", e)))?;
    atomic_write(path, &output)
}

fn remove_toml_deepseek_openai_provider(path: &Path) -> Result<()> {
    if !path.exists() {
        return Ok(());
    }
    let content = std::fs::read_to_string(path)
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to read TOML: {}", e)))?;
    let mut doc = content
        .parse::<toml_edit::DocumentMut>()
        .map_err(|e| WiseSpaceError::Gateway(format!("Failed to parse TOML: {}", e)))?;

    if doc.get("provider").and_then(|v| v.as_str()) == Some("openai") {
        doc.remove("provider");
    }
    if let Some(providers) = doc.get_mut("providers").and_then(|v| v.as_table_mut()) {
        providers.remove("openai");
        if providers.is_empty() {
            doc.remove("providers");
        }
    }

    atomic_write(path, &doc.to_string())
}

// ─── Helpers ────────────────────────────────────────────

fn read_json_or_empty(path: &Path) -> Result<serde_json::Value> {
    if path.exists() {
        let content = std::fs::read_to_string(path).map_err(|e| {
            WiseSpaceError::Gateway(format!("Failed to read {}: {}", path.display(), e))
        })?;
        serde_json::from_str(&content)
            .map_err(|e| WiseSpaceError::Gateway(format!("Failed to parse JSON: {}", e)))
    } else {
        Ok(serde_json::json!({}))
    }
}

fn read_json_file(path: &Path) -> Result<serde_json::Value> {
    let content = std::fs::read_to_string(path).map_err(|e| {
        WiseSpaceError::Gateway(format!("Failed to read {}: {}", path.display(), e))
    })?;
    serde_json::from_str(&content).map_err(|e| {
        WiseSpaceError::Gateway(format!("Failed to parse JSON in {}: {}", path.display(), e))
    })
}

/// Get the primary config path for display purposes
pub fn get_config_path(tool: CliTool) -> Result<String> {
    let paths = config_paths(tool)?;
    Ok(paths
        .first()
        .map(|p| p.display().to_string())
        .unwrap_or_default())
}

/// Check if a backup exists for the tool
pub fn has_backup(tool: CliTool) -> bool {
    if let Ok(dir) = backup_dir() {
        dir.join(tool.id()).exists()
    } else {
        false
    }
}
