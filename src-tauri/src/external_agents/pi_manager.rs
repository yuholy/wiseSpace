//! Lifecycle manager for the pi adapter Node.js sidecar process.
//!
//! The adapter is a Node.js HTTP server that wraps the pi SDK
//! (`@earendil-works/pi-coding-agent`).  This module:
//!
//! 1. Spawns the adapter process when the first pi_adapter task is
//!    dispatched.
//! 2. Health-checks the adapter before forwarding a task.
//! 3. Kills the adapter when wiseSpace shuts down.

use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::process::{Child, Command};
use tokio::time::timeout;

/// Default port the adapter listens on.
const ADAPTER_PORT: u16 = 8789;
/// Maximum time to wait for the adapter to become healthy.
const STARTUP_TIMEOUT_SECS: u64 = 15;
/// Interval between health-check polls during startup.
const HEALTH_POLL_INTERVAL_MS: u64 = 400;
/// HTTP health-check timeout.
const HEALTH_REQUEST_TIMEOUT_SECS: u64 = 2;

/// Manages the lifecycle of the pi adapter Node.js sidecar.
pub struct PiAdapterManager {
    child: Option<Child>,
    adapter_port: u16,
    script_path: String,
    project_root: PathBuf,
    killed: bool,
}

impl PiAdapterManager {
    /// Create a new manager.  The adapter has not been started yet.
    pub fn new(script_path: String, adapter_port: u16) -> Self {
        // The script lives under <project_root>/scripts/; resolve the project
        // root so the Node process inherits the correct working directory and
        // can resolve node_modules.
        let project_root = Path::new(&script_path)
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."));
        Self {
            child: None,
            adapter_port,
            script_path,
            project_root,
            killed: false,
        }
    }

    /// Convenience constructor using the default port.
    pub fn with_defaults(script_path: String) -> Self {
        Self::new(script_path, ADAPTER_PORT)
    }

    // ── public API ──────────────────────────────────────────────

    /// Return `true` when the adapter HTTP health endpoint responds.
    pub async fn is_alive(&self) -> bool {
        let url = format!("http://127.0.0.1:{}/health", self.adapter_port);
        let client = match reqwest::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(HEALTH_REQUEST_TIMEOUT_SECS))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("Pi adapter health client build failed: {}", e);
                return false;
            }
        };
        match client.get(&url).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(e) => {
                tracing::warn!("Pi adapter health check failed: {}", e);
                false
            }
        }
    }

    /// Ensure the adapter is running.  If already alive this is a no-op.
    /// If not running, spawn the Node.js process and wait for the health
    /// endpoint to respond.
    pub async fn ensure_running(&mut self) -> Result<(), String> {
        if self.killed {
            return Err("Pi adapter has been shut down".to_string());
        }

        // Quick check: is the adapter already alive?
        if self.is_alive().await {
            tracing::info!(
                "Pi adapter is healthy on port {} (child={})",
                self.adapter_port,
                self.child.is_some()
            );
            return Ok(());
        }

        // Clean up dead child handle if the process exited.
        if let Some(ref mut child) = self.child {
            match child.try_wait() {
                Ok(Some(status)) => {
                    tracing::info!("Pi adapter child exited with {}", status);
                    self.child = None;
                }
                Ok(None) => {
                    // Process still running but not healthy - wait and retry.
                    tracing::info!("Pi adapter child running but not healthy on port {}", self.adapter_port);
                }
                Err(e) => {
                    tracing::warn!("Pi adapter try_wait error: {}", e);
                    self.child = None;
                }
            }
        }

        // Spawn a fresh process if needed.
        if self.child.is_none() {
            self.spawn_adapter().await?;
        }

        // Poll until healthy or timeout.
        let deadline = Duration::from_secs(STARTUP_TIMEOUT_SECS);
        let start = std::time::Instant::now();
        loop {
            if self.is_alive().await {
                tracing::info!("Pi adapter is healthy on port {}", self.adapter_port);
                return Ok(());
            }
            if start.elapsed() >= deadline {
                return Err(format!(
                    "Pi adapter did not become healthy within {} s",
                    STARTUP_TIMEOUT_SECS
                ));
            }
            // If the child process died during startup, report why.
            if let Some(ref mut child) = self.child {
                if let Ok(Some(status)) = child.try_wait() {
                    return Err(format!(
                        "Pi adapter process exited with {} during startup",
                        status
                    ));
                }
            }
            tokio::time::sleep(Duration::from_millis(HEALTH_POLL_INTERVAL_MS)).await;
        }
    }

    /// Kill the adapter process (best-effort).
    pub async fn stop(&mut self) {
        self.killed = true;
        if let Some(mut child) = self.child.take() {
            tracing::info!(
                "Stopping pi adapter (pid={:?})",
                child.id()
            );
            let _ = child.kill().await;
            // Drain to avoid zombie processes.
            let _ = timeout(Duration::from_secs(3), child.wait()).await;
        }
    }

    // ── internal ────────────────────────────────────────────────

    async fn spawn_adapter(&mut self) -> Result<(), String> {
        let node = resolve_node_bin();

        tracing::info!(
            "Starting pi adapter: {} {} (port={})",
            node,
            self.script_path,
            self.adapter_port
        );

        let mut cmd = Command::new(&node);
        cmd.arg(&self.script_path)
            .current_dir(&self.project_root)
            .env("WISESPACE_PI_ADAPTER_PORT", self.adapter_port.to_string())
            .env("WISESPACE_PI_ADAPTER_HOST", "127.0.0.1")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn pi adapter process: {}", e))?;

        self.child = Some(child);
        Ok(())
    }
}

/// Best-effort resolution of a Node.js binary.
fn resolve_node_bin() -> String {
    // Simple approach: try common names, rely on PATH.
    // The Tauri runtime typically inherits the user's PATH.
    let names: &[&str] = if cfg!(target_os = "windows") {
        &["node.exe", "node"]
    } else {
        &["node"]
    };

    for name in names {
        if std::process::Command::new(name)
            .arg("--version")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            return name.to_string();
        }
    }

    // Last resort fallback.
    "node".to_string()
}

impl Drop for PiAdapterManager {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.start_kill();
        }
    }
}
