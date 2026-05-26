import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';

const host = process.env.WISESPACE_PI_ADAPTER_HOST || '127.0.0.1';
const port = Number(process.env.WISESPACE_PI_ADAPTER_PORT || 8789);
const requestTimeoutMs = Number(process.env.WISESPACE_PI_ADAPTER_TIMEOUT_MS || 10 * 60 * 1000);
const defaultCwd = process.env.WISESPACE_PI_ADAPTER_CWD || process.cwd();
const configuredPiBin = process.env.WISESPACE_PI_BIN || 'pi';
const piProvider = process.env.WISESPACE_PI_PROVIDER || 'wisespace';
const piModel = process.env.WISESPACE_PI_MODEL || 'deepseek-v4-flash';
const piThinkingLevel = process.env.WISESPACE_PI_THINKING_LEVEL || '';
const piSessionMode = process.env.WISESPACE_PI_SESSION_MODE || 'ephemeral';

const tasks = new Map();
let cachedPiVersion = null;
let cachedResolvedPiBin = null;

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

function splitJsonLines(buffered, chunk) {
  const lines = [];
  let pending = buffered + chunk.toString('utf8');
  let idx = pending.indexOf('\n');
  while (idx >= 0) {
    let line = pending.slice(0, idx);
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (line.trim()) lines.push(line);
    pending = pending.slice(idx + 1);
    idx = pending.indexOf('\n');
  }
  return { lines, pending };
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    if (value.type === 'text' && typeof value.text === 'string') return value.text;
    if (Array.isArray(value.content)) return toText(value.content);
    if (typeof value.text === 'string') return value.text;
  }
  return '';
}

function extractAssistantTextFromMessage(message) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.text === 'string') return message.text;
  if (Array.isArray(message.content)) {
    const text = message.content.map(toText).filter(Boolean).join('\n\n').trim();
    if (text) return text;
  }
  return '';
}

function normalizeContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function normalizeInput(taskEnvelope) {
  const innerTask = taskEnvelope?.task ?? {};
  const protocol = innerTask?.protocol || 'pi';
  const originalTask = innerTask?.task ?? innerTask;
  const context = normalizeContext(innerTask?.context ?? originalTask?.context ?? {});
  const inputText =
    innerTask?.prompt ||
    innerTask?.input?.text ||
    originalTask?.input?.text ||
    '';
  const title =
    innerTask?.title ||
    originalTask?.title ||
    'Pi task';

  return {
    protocol,
    title,
    inputText,
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
  return candidates.find((value) => typeof value === 'string' && value.trim()) || defaultCwd;
}

function getPermissionMode(context) {
  const candidates = [
    context.permissionMode,
    context?.wisespaceContext?.permissionMode,
    context?.metadata?.permissionMode,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim()) || 'default';
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

function createPendingTask(normalized) {
  const taskId = randomUUID();
  const cwd = getWorkspaceRoot(normalized.context);
  return {
    id: taskId,
    protocol: normalized.protocol,
    title: normalized.title,
    inputText: normalized.inputText,
    context: normalized.context,
    raw: normalized.raw,
    cwd,
    status: 'queued',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    externalTaskId: taskId,
    resultPayload: null,
    assistantContent: null,
    error: null,
    stderr: '',
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
  if (task.stderr) payload.stderr = task.stderr;
  return payload;
}

async function ensureWorkspaceDirectory(workspacePath) {
  await mkdir(workspacePath, { recursive: true });
  await access(workspacePath, fsConstants.R_OK | fsConstants.W_OK);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildPiBinCandidates() {
  const candidates = [];
  const explicit = configuredPiBin.trim();
  if (explicit) {
    const explicitNames =
      process.platform === 'win32' && !path.isAbsolute(explicit) && !/\.(cmd|exe)$/i.test(explicit)
        ? [`${explicit}.cmd`, `${explicit}.exe`, explicit]
        : [explicit];
    candidates.push(...explicitNames);
    if (!path.isAbsolute(explicit)) {
      const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
      for (const dir of pathDirs) {
        for (const name of explicitNames) {
          candidates.push(path.join(dir, name));
        }
      }
    }
  }

  if (process.platform === 'win32') {
    const names = ['pi.cmd', 'pi.exe', 'pi'];
    const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    for (const dir of pathDirs) {
      for (const name of names) {
        candidates.push(path.join(dir, name));
      }
    }

    const commonDirs = [
      'C:\\nvm4w\\nodejs',
      path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming', 'npm'),
    ].filter(Boolean);
    for (const dir of commonDirs) {
      for (const name of names) {
        candidates.push(path.join(dir, name));
      }
    }
  }

  return unique(candidates);
}

async function resolvePiBin() {
  if (cachedResolvedPiBin) return cachedResolvedPiBin;

  for (const candidate of buildPiBinCandidates()) {
    try {
      await access(candidate, fsConstants.X_OK | fsConstants.R_OK);
      cachedResolvedPiBin = candidate;
      return candidate;
    } catch {
      // try next candidate
    }
  }

  cachedResolvedPiBin = configuredPiBin;
  return cachedResolvedPiBin;
}

function quoteWindowsArg(value) {
  if (!value) return '""';
  if (!/[\s"]/u.test(value)) return value;
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function spawnPiProcess(args, options = {}) {
  if (process.platform === 'win32' && typeof options.piBin === 'string' && /\.cmd$/i.test(options.piBin)) {
    const command = `${quoteWindowsArg(options.piBin)} ${args.map(quoteWindowsArg).join(' ')}`.trim();
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
      ...options,
      windowsHide: true,
    });
  }

  return spawn(options.piBin, args, {
    ...options,
    windowsHide: true,
  });
}

function buildPiArgs(task) {
  const args = ['--mode', 'rpc'];
  if (piSessionMode === 'ephemeral') args.push('--no-session');
  if (piProvider) args.push('--provider', piProvider);
  if (piModel) args.push('--model', piModel);
  const tools = getToolAllowlistForPermissionMode(getPermissionMode(task.context || {}));
  if (tools.length > 0) {
    args.push('--tools', tools.join(','));
  }
  return args;
}

function writeRpcCommand(child, payload) {
  child.stdin.write(`${JSON.stringify(payload)}\n`);
}

function applyRpcEvent(task, event) {
  task.events.push({
    type: event?.type || 'unknown',
    at: Date.now(),
  });
  if (task.events.length > 100) task.events.shift();

  if (event?.type === 'message_update') {
    const delta = event?.assistantMessageEvent;
    if (delta?.type === 'text_delta' && typeof delta.delta === 'string') {
      task.assistantContent = (task.assistantContent || '') + delta.delta;
    }
  }

  if (event?.type === 'message_end' || event?.type === 'turn_end') {
    const text = extractAssistantTextFromMessage(event.message);
    if (text) task.assistantContent = text;
  }

  if (event?.type === 'agent_end' && Array.isArray(event.messages)) {
    for (let i = event.messages.length - 1; i >= 0; i -= 1) {
      const text = extractAssistantTextFromMessage(event.messages[i]);
      if (text) {
        task.assistantContent = text;
        break;
      }
    }
  }
}

async function runPiTask(task) {
  task.status = 'running';
  task.updatedAt = Date.now();

  try {
    await ensureWorkspaceDirectory(task.cwd);
  } catch (error) {
    task.status = 'failed';
    task.error = `Invalid working directory: ${task.cwd}`;
    task.stderr = error instanceof Error ? error.message : String(error);
    task.updatedAt = Date.now();
    return;
  }

  const piBin = await resolvePiBin();
  const child = spawnPiProcess(buildPiArgs(task), {
    piBin,
    cwd: task.cwd,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdoutPending = '';
  let stderr = '';
  let finished = false;
  let promptAccepted = false;

  const finalize = (status, errorMessage) => {
    if (finished) return;
    finished = true;
    task.status = status;
    task.error = errorMessage || null;
    task.stderr = stderr.trim();
    task.updatedAt = Date.now();
    task.resultPayload = {
      taskId: task.id,
      cwd: task.cwd,
      provider: piProvider || null,
      model: piModel || null,
      thinkingLevel: piThinkingLevel || null,
      permissionMode: getPermissionMode(task.context || {}),
      events: task.events,
    };
  };

  const timeout = setTimeout(() => {
    if (!finished) {
      stderr += '\nRequest timed out inside pi-adapter.';
      child.kill();
      finalize('failed', `Pi task timed out after ${requestTimeoutMs}ms`);
    }
  }, requestTimeoutMs);

  child.stdout.on('data', (chunk) => {
    const parsed = splitJsonLines(stdoutPending, chunk);
    stdoutPending = parsed.pending;
    for (const line of parsed.lines) {
      const message = safeJsonParse(line);
      if (!message || typeof message !== 'object') continue;

      if (message.type === 'response' && message.command === 'prompt') {
        if (message.success === true) {
          promptAccepted = true;
        } else {
          finalize('failed', 'Pi rejected the prompt request');
        }
        continue;
      }

      applyRpcEvent(task, message);
      if (message.type === 'agent_end') {
        finalize('completed', null);
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  if (piThinkingLevel) {
    writeRpcCommand(child, {
      type: 'set_thinking_level',
      level: piThinkingLevel,
    });
  }

  writeRpcCommand(child, {
    id: `prompt-${task.id}`,
    type: 'prompt',
    message: buildPrompt(task),
  });

  const exitCode = await new Promise((resolve) => {
    child.on('error', (error) => {
      stderr += error instanceof Error ? error.message : String(error);
      resolve(-1);
    });
    child.on('close', (code) => resolve(code ?? 0));
  });

  clearTimeout(timeout);

  if (!finished) {
    if (!promptAccepted) {
      finalize('failed', 'Pi did not acknowledge the prompt request');
    } else if (task.assistantContent) {
      finalize('completed', null);
    } else {
      finalize('failed', `Pi exited before producing a final answer (code ${exitCode})`);
    }
  }

  if (task.status === 'completed' && !task.assistantContent) {
    task.status = 'failed';
    task.error = 'Pi completed without returning assistant content';
  }
}

async function resolvePiVersion() {
  if (cachedPiVersion !== null) return cachedPiVersion;

  const piBin = await resolvePiBin();

  cachedPiVersion = await new Promise((resolve) => {
    const child = spawnPiProcess(['--version'], {
      piBin,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    child.stdout.on('data', (chunk) => {
      output += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString('utf8');
    });
    child.on('error', () => done(null));
    child.on('close', (code) => {
      done(code === 0 ? output.trim() || 'unknown' : null);
    });
  });

  return cachedPiVersion;
}

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

  if (req.method === 'GET' && url.pathname === '/health') {
    const version = await resolvePiVersion();
    sendJson(res, version ? 200 : 503, {
      ok: Boolean(version),
      service: 'wisespace-pi-adapter',
      host,
      port,
      piBin: await resolvePiBin(),
      piVersion: version,
      configuredProvider: piProvider || null,
      configuredModel: piModel || null,
      sessionMode: piSessionMode,
      taskCount: tasks.size,
    });
    return;
  }

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

  if (req.method === 'GET' && (url.pathname.startsWith('/tasks/') || url.pathname.startsWith('/results/'))) {
    const taskId = url.pathname.split('/').pop();
    const task = taskId ? tasks.get(taskId) : null;
    if (!task) {
      sendJson(res, 404, {
        status: 'failed',
        error: 'Task not found',
      });
      return;
    }
    sendJson(res, 200, taskSnapshot(task));
    return;
  }

  sendJson(res, 404, {
    status: 'failed',
    error: 'Route not found',
  });
});

server.listen(port, host, () => {
  console.log(`[wisespace-pi-adapter] listening on http://${host}:${port}`);
  console.log(`[wisespace-pi-adapter] configured pi binary: ${configuredPiBin}`);
  console.log('[wisespace-pi-adapter] health: GET /health');
  console.log('[wisespace-pi-adapter] dispatch: POST /tasks');
  console.log('[wisespace-pi-adapter] status: GET /tasks/:id');
});
