use serde::Serialize;
use wisespace_core::types::AgentRun;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentRunnerKind {
    Sdk,
    DeepseekTui,
}

impl AgentRunnerKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Sdk => "sdk",
            Self::DeepseekTui => "deepseek_tui",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "deepseek_tui" | "deepseek-tui" => Self::DeepseekTui,
            _ => Self::Sdk,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunnerResumeDecision {
    pub accepted: bool,
    pub event_type: &'static str,
    pub message: String,
}

pub fn derive_resume_capability(run: &AgentRun) -> &'static str {
    match run.runner_kind.as_str() {
        "sdk" | "deepseek_tui" => {
            let has_context = run
                .resume_token_json
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
                || run
                    .sdk_context_json
                    .as_deref()
                    .is_some_and(|value| !value.trim().is_empty());
            if has_context {
                "resumable"
            } else {
                "replay_only"
            }
        }
        _ => "none",
    }
}

#[allow(dead_code)]
pub trait AgentRunner {
    fn kind(&self) -> AgentRunnerKind;

    fn prepare(&self, _run: &AgentRun) -> Result<(), String> {
        Ok(())
    }

    fn start(&self, _run: &AgentRun) -> Result<(), String> {
        Ok(())
    }

    fn stream_next(&self, _run: &AgentRun) -> Result<(), String> {
        Ok(())
    }

    fn request_approval(&self, _run: &AgentRun) -> Result<(), String> {
        Ok(())
    }

    fn request_user_input(&self, _run: &AgentRun) -> Result<(), String> {
        Ok(())
    }

    fn cancel(&self, _run: &AgentRun) -> Result<(), String> {
        Ok(())
    }

    fn resume(&self, run: &AgentRun) -> RunnerResumeDecision;

    fn finalize(&self, _run: &AgentRun) -> Result<(), String> {
        Ok(())
    }
}

#[derive(Debug, Clone, Copy)]
pub struct SdkRunner;

#[derive(Debug, Clone, Copy)]
pub struct LegacyRunner;

#[derive(Debug, Clone, Copy)]
pub struct DeepseekTuiRunner;

impl AgentRunner for SdkRunner {
    fn kind(&self) -> AgentRunnerKind {
        AgentRunnerKind::Sdk
    }

    fn resume(&self, run: &AgentRun) -> RunnerResumeDecision {
        let resume_capability = derive_resume_capability(run);
        RunnerResumeDecision {
            accepted: resume_capability == "resumable",
            event_type: if resume_capability == "resumable" {
                "run_resumed"
            } else {
                "run_resume_rejected"
            },
            message: match resume_capability {
                "resumable" => "SDK run accepted for resume".to_string(),
                "replay_only" => {
                    "Interrupted SDK run can only be replayed because no resumable context was saved"
                        .to_string()
                }
                _ => "This run cannot be resumed".to_string(),
            },
        }
    }
}

impl AgentRunner for LegacyRunner {
    fn kind(&self) -> AgentRunnerKind {
        AgentRunnerKind::Sdk
    }

    fn resume(&self, _run: &AgentRun) -> RunnerResumeDecision {
        RunnerResumeDecision {
            accepted: false,
            event_type: "run_resume_rejected",
            message:
                "Legacy local agent runs can no longer be resumed. Start a new SDK run instead."
                    .to_string(),
        }
    }
}

impl AgentRunner for DeepseekTuiRunner {
    fn kind(&self) -> AgentRunnerKind {
        AgentRunnerKind::DeepseekTui
    }

    fn resume(&self, run: &AgentRun) -> RunnerResumeDecision {
        let resume_capability = derive_resume_capability(run);
        RunnerResumeDecision {
            accepted: resume_capability == "resumable",
            event_type: if resume_capability == "resumable" {
                "run_resumed"
            } else {
                "run_resume_rejected"
            },
            message: match resume_capability {
                "resumable" => "DeepSeek-TUI run accepted for resume".to_string(),
                "replay_only" => {
                    "DeepSeek-TUI run can only be replayed because no resumable session context was saved"
                        .to_string()
                }
                _ => "This run cannot be resumed".to_string(),
            },
        }
    }
}

pub fn runner_for_kind(kind: AgentRunnerKind) -> Box<dyn AgentRunner + Send + Sync> {
    match kind {
        AgentRunnerKind::Sdk => Box::new(SdkRunner),
        AgentRunnerKind::DeepseekTui => Box::new(DeepseekTuiRunner),
    }
}

pub fn runner_for_run(run: &AgentRun) -> Box<dyn AgentRunner + Send + Sync> {
    match run.runner_kind.as_str() {
        "sdk" => Box::new(SdkRunner),
        "deepseek_tui" => Box::new(DeepseekTuiRunner),
        _ => Box::new(LegacyRunner),
    }
}
