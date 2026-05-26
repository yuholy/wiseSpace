import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const homeDir = os.homedir();
const wisespaceDir = path.join(homeDir, '.wisespace');
const piAgentDir = path.join(homeDir, '.pi', 'agent');
const dbPath = path.join(wisespaceDir, 'wisespace.db');
const masterKeyPath = path.join(wisespaceDir, 'master.key');
const modelsJsonPath = path.join(piAgentDir, 'models.json');
const preferredModelIds = [
  'gpt-5.3-codex',
  'gpt-5.4',
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'gpt-5.4-mini',
  'qwen/qwen3-coder:free',
];

function fail(message) {
  console.error(`[pi:wisespace] ${message}`);
  process.exit(1);
}

function parseBoolean(raw, fallback = false) {
  if (raw == null) return fallback;
  return String(raw).toLowerCase() === 'true';
}

function decryptGatewayKey(encryptedKey, masterKey) {
  const combined = Buffer.from(encryptedKey, 'base64');
  const nonce = combined.subarray(0, 12);
  const cipherAndTag = combined.subarray(12);
  const ciphertext = cipherAndTag.subarray(0, cipherAndTag.length - 16);
  const tag = cipherAndTag.subarray(cipherAndTag.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function loadGatewaySettings(db) {
  const rows = db
    .prepare(
      `SELECT key, value
       FROM settings
       WHERE key IN ('gateway_listen_address', 'gateway_port', 'gateway_ssl_enabled', 'gateway_ssl_port', 'gateway_force_ssl')`,
    )
    .all();
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const listenAddress = settings.gateway_listen_address || '127.0.0.1';
  const forceSsl = parseBoolean(settings.gateway_force_ssl, false);
  const sslEnabled = parseBoolean(settings.gateway_ssl_enabled, false);
  const httpPort = Number(settings.gateway_port || 8080);
  const httpsPort = Number(settings.gateway_ssl_port || 8443);
  const protocol = forceSsl || sslEnabled ? 'https' : 'http';
  const port = protocol === 'https' ? httpsPort : httpPort;
  return {
    listenAddress,
    protocol,
    port,
    baseUrl: `${protocol}://${listenAddress}:${port}/v1`,
  };
}

function loadGatewayKey(db, masterKey) {
  const row = db
    .prepare(
      `SELECT id, name, key_prefix, encrypted_key
       FROM gateway_keys
       WHERE enabled = 1 AND encrypted_key IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get();
  if (!row) {
    fail('没有找到启用中的 wiseSpace Gateway key。请先在应用里创建并启用一个 Gateway key。');
  }
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    plainKey: decryptGatewayKey(row.encrypted_key, masterKey),
  };
}

function inferInputTypes(capabilities) {
  const input = ['text'];
  if (capabilities.includes('Vision')) {
    input.push('image');
  }
  return input;
}

function loadEnabledModels(db) {
  const rows = db
    .prepare(
      `SELECT
         p.name AS provider_name,
         p.provider_type,
         m.model_id,
         m.name AS model_name,
         m.capabilities,
         m.max_tokens
       FROM providers p
       JOIN models m ON m.provider_id = p.id
       WHERE p.enabled = 1 AND m.enabled = 1
       ORDER BY p.name, m.name`,
    )
    .all();

  const models = [];
  for (const row of rows) {
    let capabilities = [];
    try {
      capabilities = JSON.parse(row.capabilities || '[]');
    } catch {
      capabilities = [];
    }
    if (!Array.isArray(capabilities) || capabilities.length === 0) continue;

    models.push({
      id: row.model_id,
      name: row.model_name || row.model_id,
      reasoning: capabilities.includes('Reasoning'),
      input: inferInputTypes(capabilities),
      contextWindow: Number(row.max_tokens || 128000),
      maxTokens: Number(row.max_tokens || 32000),
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
    });
  }

  const deduped = [];
  const seen = new Set();
  for (const model of models) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    deduped.push(model);
  }
  return deduped;
}

function chooseDefaultModel(models) {
  for (const id of preferredModelIds) {
    const hit = models.find((model) => model.id === id);
    if (hit) return hit.id;
  }
  return models[0]?.id ?? null;
}

async function ensureModelsJson(baseUrl, apiKey, models) {
  await fs.mkdir(piAgentDir, { recursive: true });

  let doc = {};
  try {
    const raw = await fs.readFile(modelsJsonPath, 'utf8');
    doc = JSON.parse(raw);
  } catch {
    doc = {};
  }

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    doc = {};
  }
  if (!doc.providers || typeof doc.providers !== 'object' || Array.isArray(doc.providers)) {
    doc.providers = {};
  }

  doc.providers.wisespace = {
    baseUrl,
    api: 'openai-completions',
    apiKey,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
    models,
  };

  await fs.writeFile(modelsJsonPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

async function checkGatewayReachable(baseUrl, key) {
  const controller = AbortSignal.timeout(5000);
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: controller,
    });
    return response.ok;
  } catch {
    return false;
  }
}

function hasFlag(args, ...names) {
  return args.some((arg, index) => {
    if (names.includes(arg)) return true;
    return names.some((name) => arg.startsWith(`${name}=`) && index >= 0);
  });
}

async function main() {
  const cliArgs = process.argv.slice(2);
  const db = new DatabaseSync(dbPath, { readonly: true });
  const masterKey = await fs.readFile(masterKeyPath);
  const gateway = loadGatewaySettings(db);
  const gatewayKey = loadGatewayKey(db, masterKey);
  const models = loadEnabledModels(db);
  db.close();

  if (models.length === 0) {
    fail('没有找到启用中的文本模型。请先在 wiseSpace 里启用至少一个聊天模型。');
  }

  const defaultModel = chooseDefaultModel(models);
  await ensureModelsJson(gateway.baseUrl, gatewayKey.plainKey, models);

  const reachable = await checkGatewayReachable(gateway.baseUrl, gatewayKey.plainKey);
  if (!reachable) {
    fail(`wiseSpace Gateway 当前不可访问：${gateway.baseUrl}\n请先在 wiseSpace 设置中启动 Gateway，然后再运行此命令。`);
  }

  const piArgs = [...cliArgs];
  if (!hasFlag(piArgs, '--provider')) {
    piArgs.unshift('wisespace');
    piArgs.unshift('--provider');
  }
  if (defaultModel && !hasFlag(piArgs, '--model')) {
    piArgs.unshift(defaultModel);
    piArgs.unshift('--model');
  }

  console.error(`[pi:wisespace] gateway=${gateway.baseUrl}`);
  console.error(`[pi:wisespace] key=${gatewayKey.keyPrefix}`);
  console.error(`[pi:wisespace] defaultModel=${defaultModel}`);

  const child = spawn('pi', piArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      WISESPACE_GATEWAY_API_KEY: gatewayKey.plainKey,
    },
    windowsHide: true,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
  child.on('error', (error) => {
    fail(`启动 pi 失败：${error.message}`);
  });
}

await main();
