# OpenClaw Remote Bridge

wiseSpace can connect to an OpenClaw gateway through the OpenClaw-compatible external-agent connector.

## Current Test Host

- Host: `192.168.10.25`
- OpenClaw gateway: `http://192.168.10.25:18789`
- wiseSpace compatibility bridge: `http://192.168.10.25:18792`
- wiseSpace dev OpenAI proxy: `http://192.168.10.200:18080/v1`
- Bridge service: `wisespace-openclaw-bridge.service`
- Bridge script on remote host: `/root/.wisespace-openclaw-bridge/bridge.mjs`

The bridge exposes wiseSpace's expected HTTP contract:

- `GET /health`
- `POST /tasks`
- `GET /tasks/:id`
- `GET /results/:id`

Internally, it calls:

```bash
/usr/bin/openclaw agent --agent main --message "<prompt>" --json
```

## wiseSpace Settings

Create an external agent:

- Kind: `openclaw`
- Base URL: `http://192.168.10.25:18792`
- Auth: `api_key`
- API key header: `X-API-Key`

Suggested capabilities JSON:

```json
{
  "openclawAgentId": "main",
  "taskKinds": ["general"],
  "resultIngest": ["assistant_message", "artifacts"]
}
```

Do not commit the bridge API key into the repository. Keep it only in wiseSpace settings or a local secret store.

## Current Model Route

The remote OpenClaw host is configured with a custom OpenAI-compatible provider:

- Provider id: `wisespace`
- Base URL: `http://192.168.10.200:18080/v1`
- API: `openai-completions`
- Default model: `wisespace/deepseek-v4-flash`
- Private-network access: enabled for this provider

The local dev proxy is started from this repository:

```bash
python scripts/wisespace-dev-openai-proxy.py --host 0.0.0.0 --port 18080
```

It reads wiseSpace's local `%USERPROFILE%\.wisespace\wisespace.db` and `master.key`, decrypts the selected provider key in memory, and forwards requests to the provider already configured in wiseSpace. It requires:

```http
Authorization: Bearer wisespace-local
```

This is a development bridge for integration testing. For production, prefer wiseSpace's built-in Gateway once it can be started as a LAN-reachable service with an explicit gateway key.

## Verification Notes

The bridge, gateway, and wiseSpace-backed model route were reachable during integration testing.

Observed remote state:

- OpenClaw gateway was restarted on `18789`.
- Bridge was installed and started on `18792`.
- wiseSpace-style task dispatch returned a valid `externalTaskId`.
- Result polling returned a terminal `completed` status from OpenClaw.
- OpenClaw execution metadata showed provider `wisespace` and model `deepseek-v4-flash`.

Earlier testing against the remote MiniMax provider failed because the remote host's configured MiniMax key was rejected by the provider:

```text
HTTP 401 authentication_error: invalid api key
```

That failure is bypassed by routing OpenClaw through wiseSpace's local provider configuration.

