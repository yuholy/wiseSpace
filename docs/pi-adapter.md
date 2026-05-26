# wiseSpace Pi Adapter

`wiseSpace` can keep its current Rust agent runtime as the primary in-app executor and use `pi` as an external coding agent through the existing HTTP connector flow.

This adapter exposes a small HTTP surface compatible with `wiseSpace` external agents:

- `GET /health`
- `POST /tasks`
- `GET /tasks/:id`

Internally it runs `pi --mode rpc` and converts the final assistant response back into the payload shape expected by `wiseSpace`.

## Why This Shape

- Keeps the built-in `wiseSpace` runtime unchanged
- Reuses the current external agent task model and result ingestion flow
- Lets `pi` stay optional instead of becoming a hard dependency of the desktop app

## Start The Adapter

Install `pi` separately and make sure the `pi` command is available in your shell.

Then run:

```bash
pnpm external-agent:pi-adapter
```

Optional environment variables:

```bash
WISESPACE_PI_ADAPTER_PORT=8789
WISESPACE_PI_ADAPTER_CWD=/path/to/default/workspace
WISESPACE_PI_BIN=pi
WISESPACE_PI_PROVIDER=anthropic
WISESPACE_PI_MODEL=claude-sonnet-4
WISESPACE_PI_THINKING_LEVEL=medium
WISESPACE_PI_SESSION_MODE=ephemeral
```

Notes:

- `WISESPACE_PI_SESSION_MODE=ephemeral` adds `--no-session` and is the default
- The adapter resolves task working directory from task context first, then falls back to `WISESPACE_PI_ADAPTER_CWD`, then the adapter process cwd
- This first version returns the final assistant text only; it does not yet stream tool traces back into `wiseSpace`

## wiseSpace Connector Setup

Create a new external agent in Settings:

- Name: `Pi Adapter`
- Type: `OpenClaw compatible` or `通用 HTTP`
- Base URL: `http://127.0.0.1:8789`
- Auth: `None`

Suggested capabilities JSON:

```json
{
  "taskKinds": ["general", "code", "review"],
  "resultIngest": ["assistant_message"],
  "runtime": {
    "engine": "pi",
    "transport": "rpc-subprocess"
  }
}
```

## Example Request Shape

The adapter accepts the same outer envelope style as the existing mock server and generic connector flow:

```json
{
  "task": {
    "protocol": "openclaw",
    "task": {
      "title": "Review the latest change",
      "input": {
        "text": "Check the current workspace and find regression risks."
      },
      "context": {
        "workspaceRoot": "E:/project/wiseSpace"
      }
    }
  }
}
```

## Current Limits

- No task cancellation endpoint yet
- No live event bridge from `pi` tool calls into `wiseSpace` task events
- Model/provider selection is process-level via environment variables in this version
- The adapter assumes `pi` RPC output remains JSONL-only on stdout

## Recommended Next Step

After this baseline is stable, the next upgrade should be replacing the subprocess driver with a Node adapter built on `@earendil-works/pi-coding-agent` `AgentSession`, so model selection, event streaming, and richer tool telemetry become easier to control.
