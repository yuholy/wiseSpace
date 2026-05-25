#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const VERSION_FILES = [
  { path: 'package.json', kind: 'json' },
  { path: 'src-tauri/tauri.conf.json', kind: 'json' },
  { path: 'src-tauri/Cargo.toml', kind: 'toml' },
];

const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const TOML_VERSION_RE = /^version\s*=\s*"([^"]+)"\s*$/m;

function readVersion(file) {
  const filepath = resolve(root, file.path);
  const content = readFileSync(filepath, 'utf-8');

  if (file.kind === 'json') {
    return JSON.parse(content).version;
  }

  const match = content.match(TOML_VERSION_RE);
  if (!match) {
    throw new Error(`未在 ${file.path} 中找到 version 字段`);
  }
  return match[1];
}

function writeVersion(file, version) {
  const filepath = resolve(root, file.path);
  const content = readFileSync(filepath, 'utf-8');

  if (file.kind === 'json') {
    const json = JSON.parse(content);
    const oldVersion = json.version;
    json.version = version;
    writeFileSync(filepath, `${JSON.stringify(json, null, 2)}\n`);
    return oldVersion;
  }

  const match = content.match(TOML_VERSION_RE);
  if (!match) {
    throw new Error(`未在 ${file.path} 中找到 version 字段`);
  }

  const oldVersion = match[1];
  const nextContent = content.replace(TOML_VERSION_RE, `version = "${version}"`);
  writeFileSync(filepath, nextContent);
  return oldVersion;
}

function getVersionMap() {
  return VERSION_FILES.map((file) => ({
    ...file,
    version: readVersion(file),
  }));
}

function ensureVersionInput(version) {
  if (!version) {
    console.error('用法: pnpm bump [--push] <version>');
    console.error('示例: pnpm bump 0.1.3');
    console.error('      pnpm bump --push 0.1.3');
    console.error('      node scripts/bump-version.mjs --check 0.1.3');
    process.exit(1);
  }

  if (!VERSION_RE.test(version)) {
    console.error(`无效版本号: ${version}`);
    process.exit(1);
  }
}

function runCheck(expectedVersion) {
  const versions = getVersionMap();
  const uniqueVersions = [...new Set(versions.map((item) => item.version))];
  const baselineVersion = expectedVersion ?? versions[0]?.version;
  const mismatched = versions.filter((item) => item.version !== baselineVersion);

  for (const item of versions) {
    console.log(`${item.path}: ${item.version}`);
  }

  if (expectedVersion && mismatched.length > 0) {
    console.error(`\n版本校验失败，期望全部为 ${expectedVersion}`);
    process.exit(1);
  }

  if (!expectedVersion && uniqueVersions.length > 1) {
    console.error('\n版本校验失败，以下文件版本不一致');
    process.exit(1);
  }

  console.log(`\n版本校验通过: ${baselineVersion}`);
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const positional = args.filter((arg) => !arg.startsWith('--'));
const autoPush = flags.has('--push');
const checkOnly = flags.has('--check');
const version = positional[0];

if (checkOnly) {
  if (version) {
    ensureVersionInput(version);
  }
  runCheck(version);
  process.exit(0);
}

ensureVersionInput(version);

const versionsBefore = getVersionMap();
if (versionsBefore.every((item) => item.version === version)) {
  console.log(`所有目标文件已经是 ${version}，无需更新。`);
  process.exit(0);
}

for (const file of VERSION_FILES) {
  const oldVersion = writeVersion(file, version);
  console.log(`已更新 ${file.path}: ${oldVersion} -> ${version}`);
}

console.log(`\n版本已更新为 ${version}`);

const tag = `v${version}`;
const commitMessage = [
  `chore(version): 发布 ${tag}`,
  '',
  '修改内容:',
  `- 同步 package.json、src-tauri/tauri.conf.json、src-tauri/Cargo.toml 的版本号到 ${version}`,
  `- 创建版本提交并打上 ${tag} 标签`,
  '',
  '修改目的:',
  '- 保证桌面应用版本、发布标签与自动更新元数据保持一致',
  '',
  '影响范围:',
  '- 版本管理脚本',
  '- Tauri 桌面应用版本识别与 GitHub Release 发布流程',
  '',
  '风险与兼容性:',
  '- 仅调整版本元数据，不改变运行时逻辑',
  '- 若未同步推送标签，Release 工作流不会触发',
  '',
  '验证方式:',
  `- node scripts/bump-version.mjs --check ${version}`,
].join('\n');

execSync(`git add ${VERSION_FILES.map((file) => file.path).join(' ')}`, {
  cwd: root,
  stdio: 'inherit',
});
execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
  cwd: root,
  stdio: 'inherit',
});
execSync(`git tag ${tag}`, { cwd: root, stdio: 'inherit' });
console.log(`\n已创建提交和标签: ${tag}`);

if (autoPush) {
  execSync('git push', { cwd: root, stdio: 'inherit' });
  execSync('git push --tags', { cwd: root, stdio: 'inherit' });
  console.log(`\n已推送提交和标签: ${tag}`);
} else {
  console.log('\n执行 git push && git push --tags 即可触发 Release 工作流');
}
