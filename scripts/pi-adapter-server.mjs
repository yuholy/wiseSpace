import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

// ── pi SDK (deep adapter) ──────────────────────────────────────────
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from '@earendil-works/pi-coding-agent';

// ── Configuration ───────────────────────────────────────────────────
const host = process.env.WISESPACE_PI_ADAPTER_HOST || '127.0.0.1';
const port = Number(process.env.WISESPACE_PI_ADAPTER_PORT || 8789);
const requestTimeoutMs = Number(process.env.WISESPACE_PI_ADAPTER_TIMEOUT_MS || 10 * 60 * 1000);
const defaultCwd = process.env.WISESPACE_PI_ADAPTER_CWD || process.cwd();
const configuredProvider = process.env.WISESPACE_PI_PROVIDER || null;
const configuredModel = process.env.WISESPACE_PI_MODEL || null;
const configuredThinkingLevel = process.env.WISESPACE_PI_THINKING_LEVEL || null;

// ── Shared pi runtime (created once, reused with .destroy()) ────────
let authStorage = null;
let modelRegistry = null;

function ensureRuntime() {
  if (!authStorage) {
    authStorage = AuthStorage.create();
    modelRegistry = ModelRegistry.create(authStorage);
  }
  return { authStorage, modelRegistry };
}

// ── Task store ──────────────────────────────────────────────────────
const tasks = new Map();

// ── Helpers ─────────────────────────────────────────────────────────
function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  });
  res.end(body);
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(message),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(message);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function normalizeContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function normalizeInput(taskEnvelope) {
  const innerTask = taskEnvelope?.task ?? {};
  const originalTask = innerTask?.task ?? innerTask;
  const context = normalizeContext(innerTask?.context ?? originalTask?.context ?? {});
  return {
    title: innerTask?.title || originalTask?.title || 'Pi task',
    inputText: innerTask?.prompt || innerTask?.input?.text || originalTask?.input?.text || '',
    context,
    raw: taskEnvelope,
  };
}

function getWorkspaceRoot(context) {
  const candidates = [
    context.cwd,
    context.workspaceRoot,
    context.projectRoot,
    context?.wisespaceContext?.cwd,
    context?.wisespaceContext?.workspaceRoot,
    context?.wisespaceContext?.projectRoot,
    context?.metadata?.cwd,
    context?.metadata?.workspaceRoot,
  ];
  return candidates.find((v) => typeof v === 'string' && v.trim()) || defaultCwd;
}

function getPermissionMode(context) {
  const candidates = [
    context.permissionMode,
    context?.wisespaceContext?.permissionMode,
    context?.metadata?.permissionMode,
  ];
  return candidates.find((v) => typeof v === 'string' && v.trim()) || 'default';
}

function getToolAllowlistForPermissionMode(permissionMode) {
  switch (permissionMode) {
    case 'full_access':
      return ['read', 'grep', 'find', 'ls', 'edit', 'write', 'bash'];
    case 'accept_edits':
      return ['read', 'grep', 'find', 'ls', 'edit', 'write'];
    default:
      return ['read', 'grep', 'find', 'ls'];
  }
}

function buildPrompt(task) {
  const contextJson = JSON.stringify(task.context || {}, null, 2);
  const permissionMode = getPermissionMode(task.context || {});
  return [
    'You are executing as an external coding agent for wiseSpace.',
    'Return the final answer in Chinese unless the task clearly requires another language.',
    'Be concise, practical, and focus on completing the requested work.',
    `Current permission mode: ${permissionMode}. Respect it strictly.`,
    '',
    `Task title: ${task.title}`,
    '',
    'User request:',
    task.inputText || '(empty)',
    '',
    'Context JSON:',
    contextJson,
  ].join('\n');
}

function extractFinalText(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role === 'assistant') {
      const text = extractTextFromContent(msg.content);
      if (text) return text;
    }
  }
  return '';
}

function extractTextFromContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === 'text')
      .map((block) => block.text || '')
      .join('\n')
      .trim();
  }
  return '';
}

function createPendingTask(normalized) {
  const taskId = randomUUID();
  const cwd = getWorkspaceRoot(normalized.context);
  return {
    id: taskId,
    title: normalized.title,
    inputText: normalized.inputText,
    context: normalized.context,
    cwd,
    status: 'queued',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    externalTaskId: taskId,
    resultPayload: null,
    assistantContent: null,
    error: null,
    events: [],
  };
}

function taskSnapshot(task) {
  const payload = {
    externalTaskId: task.externalTaskId,
    status: task.status,
    summary:
      task.status === 'completed'
        ? `Pi task completed: ${task.title}`
        : task.status === 'failed'
          ? `Pi task failed: ${task.title}`
          : `Pi task is ${task.status}`,
  };
  if (task.assistantContent) payload.content = task.assistantContent;
  if (task.resultPayload) payload.result = task.resultPayload;
  if (task.error) payload.error = task.error;
  return payload;
}

async function ensureWorkspaceDirectory(workspacePath) {
  await mkdir(workspacePath, { recursive: true });
  await access(workspacePath, fsConstants.R_OK | fsConstants.W_OK);
}

// ── Model resolution ────────────────────────────────────────────────
async function resolveModel() {
  const { modelRegistry: registry } = ensureRuntime();

  if (configuredProvider && configuredModel) {
    try {
      const model = await registry.find(configuredProvider, configuredModel);
      if (model) return model;
    } catch {
      // Fall through to available models
    }
  }

  // Use first available model from pi's auth/settings
  try {
    const available = await registry.getAvailable();
    if (available.length > 0) {
      return available[0];
    }
  } catch {
    // No auth configured
  }

  return null;
}

// ── Core: run a task via pi SDK ──────────────────────────────────────
async function runPiTask(task) {
  task.status = 'running';
  task.updatedAt = Date.now();

  // 1. Validate working directory
  try {
    await ensureWorkspaceDirectory(task.cwd);
  } catch (error) {
    task.status = 'failed';
    task.error = `Invalid working directory: ${task.cwd} (${error.message})`;
    task.updatedAt = Date.now();
    return;
  }

  // 2. Resolve model
  const model = await resolveModel();
  if (!model) {
    task.status = 'failed';
    task.error = 'No model available. Configure pi auth via `pi /login` or set API keys in environment.';
    task.updatedAt = Date.now();
    return;
  }

  // 3. Determine tools from permission mode
  const permissionMode = getPermissionMode(task.context || {});
  const tools = getToolAllowlistForPermissionMode(permissionMode);

  // 4. Create session for this task (fresh session, task-specific cwd)
  ensureRuntime();
  let session;
  try {
    const result = await createAgentSession({
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
      cwd: task.cwd,
      model,
      tools,
      ...(configuredThinkingLevel ? { thinkingLevel: configuredThinkingLevel } : {}),
    });
    session = result.session;
  } catch (error) {
    task.status = 'failed';
    task.error = `Failed to create pi session: ${error.message}`;
    task.updatedAt = Date.now();
    return;
  }

  // 5. Subscribe to events
  let finished = false;

  const finalize = (status, errorMessage) => {
    if (finished) return;
    finished = true;
    task.status = status;
    task.error = errorMessage || null;
    task.updatedAt = Date.now();
    task.resultPayload = {
      taskId: task.id,
      cwd: task.cwd,
      provider: configuredProvider || model?.provider || null,
      model: model?.id || null,
      thinkingLevel: configuredThinkingLevel || null,
      permissionMode,
      events: task.events,
    };
  };

  const unsubscribe = session.subscribe((event) => {
    switch (event.type) {
      case 'agent_start':
        task.events.push({ type: 'agent_start', at: Date.now() });
        break;

      case 'message_update': {
        const delta = event.assistantMessageEvent;
        if (delta?.type === 'text_delta' && typeof delta.delta === 'string') {
          task.assistantContent = (task.assistantContent || '') + delta.delta;
        }
        if (delta?.type === 'thinking_delta') {
          task.events.push({ type: 'thinking', at: Date.now() });
        }
        break;
      }

      case 'tool_execution_start':
        task.events.push({
          type: 'tool_start',
          name: event.toolName,
          at: Date.now(),
        });
        break;

      case 'tool_execution_end':
        task.events.push({
          type: 'tool_end',
          name: event.toolName,
          isError: event.isError,
          at: Date.now(),
        });
        break;

      case 'agent_end': {
        // SDK delivers final messages array in agent_end
        const finalText = extractFinalText(event.messages);
        if (finalText) {
          task.assistantContent = finalText;
        }
        finalize('completed', null);
        break;
      }
    }
  });

  // 6. Set timeout
  const timeout = setTimeout(() => {
    if (!finished) {
      session.abort().catch(() => {});
      finalize('failed', `Pi task timed out after ${requestTimeoutMs}ms`);
    }
  }, requestTimeoutMs);

  // 7. Execute prompt
  try {
    const promptText = buildPrompt(task);
    await session.prompt(promptText);
  } catch (error) {
    if (!finished) {
      finalize('failed', error?.message || String(error));
    }
  } finally {
    clearTimeout(timeout);
    unsubscribe();
    try { session.dispose(); } catch { /* ignore */ }
  }

  // 8. Post-mortem check
  if (task.status === 'completed' && !task.assistantContent) {
    task.status = 'failed';
    task.error = 'Pi completed without returning assistant content';
  }
}

// ── Health check ─────────────────────────────────────────────────────
function getHealthPayload() {
  return {
    ok: true,
    service: 'wisespace-pi-adapter',
    engine: 'sdk',
    host,
    port,
    configuredProvider: configuredProvider || null,
    configuredModel: configuredModel || null,
    thinkingLevel: configuredThinkingLevel || null,
    taskCount: tasks.size,
  };
}

// ── HTTP Server ──────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  if (!req.url) {
    sendText(res, 400, 'Missing URL');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);

  // GET /health
  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, getHealthPayload());
    return;
  }

  // POST /tasks
  if (req.method === 'POST' && url.pathname === '/tasks') {
    try {
      const body = await readJson(req);
      const normalized = normalizeInput(body);
      const task = createPendingTask(normalized);
      tasks.set(task.id, task);
      void runPiTask(task);

      sendJson(res, 202, {
        externalTaskId: task.id,
        status: task.status,
        summary: `Pi task accepted for ${task.title}`,
        cwd: task.cwd,
      });
    } catch (error) {
      sendJson(res, 400, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  // GET /tasks/:id
  if (req.method === 'GET' && (url.pathname.startsWith('/tasks/') || url.pathname.startsWith('/results/'))) {
    const taskId = url.pathname.split('/').pop();
    const task = taskId ? tasks.get(taskId) : null;
    if (!task) {
      sendJson(res, 404, { status: 'failed', error: 'Task not found' });
      return;
    }
    sendJson(res, 200, taskSnapshot(task));
    return;
  }

  sendJson(res, 404, { status: 'failed', error: 'Route not found' });
});

server.listen(port, host, () => {
  console.log(`[wisespace-pi-adapter] SDK engine listening on http://${host}:${port}`);
  console.log(`[wisespace-pi-adapter] health: GET /health`);
  console.log(`[wisespace-pi-adapter] dispatch: POST /tasks`);
  console.log(`[wisespace-pi-adapter] status: GET /tasks/:id`);
});
