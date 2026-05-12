import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })
}

function runGit(args, options) {
  return run('git', args, options)
}

function parseArgs(argv) {
  const args = {
    remote: 'origin',
    push: false,
    dryRun: false,
    date: null,
    all: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i]
    if (cur === '--remote') {
      args.remote = argv[++i]
    }
    else if (cur === '--push') {
      args.push = true
    }
    else if (cur === '--dry-run') {
      args.dryRun = true
    }
    else if (cur === '--date') {
      args.date = argv[++i]
    }
    else if (cur === '--all') {
      args.all = true
    }
    else if (cur === '--help' || cur === '-h') {
      console.log(`
Usage:
  node scripts/create-nightly-tags.mjs [options]

Options:
  --push               Push created tags to remote
  --remote <name>      Git remote name (default: origin)
  --dry-run            Print actions only
  --date <YYYYMMDD>    Override date segment (default: UTC today)
  --all                Tag all packages even if unchanged
`)
      process.exit(0)
    }
    else {
      throw new Error(`Unknown argument: ${cur}`)
    }
  }

  return args
}

function utcDateYYYYMMDD() {
  const d = new Date()
  const y = String(d.getUTCFullYear())
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function readJson(relativePath) {
  const abs = path.resolve(process.cwd(), relativePath)
  return JSON.parse(readFileSync(abs, 'utf8'))
}

function resolvePackage(relativePackageJson, paths) {
  const pkg = readJson(relativePackageJson)
  const name = String(pkg?.name ?? '').trim()
  if (!name)
    throw new Error(`Invalid package.json (missing name): ${relativePackageJson}`)
  return { name, packageJson: relativePackageJson, paths }
}

function listTags(glob) {
  return runGit(['tag', '--list', glob])
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}

function latestTag(glob) {
  const tags = listTags(glob)
  if (!tags.length)
    return null
  // Sort by taggerdate / creatordate (annotated tags); fallback by refname.
  const sorted = runGit([
    'for-each-ref',
    '--sort=-creatordate',
    '--format=%(refname:strip=2)',
    'refs/tags',
  ])
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  const set = new Set(tags)
  for (const t of sorted) {
    if (set.has(t))
      return t
  }
  return tags[tags.length - 1]
}

function shortSha(ref = 'HEAD') {
  return runGit(['rev-parse', '--short=7', ref]).trim()
}

function hasChangesSince(baseRef, paths) {
  if (!baseRef)
    return true
  const baseSha = runGit(['rev-parse', `${baseRef}^{}`]).trim()
  const headSha = runGit(['rev-parse', 'HEAD^{}']).trim()
  if (baseSha === headSha)
    return false
  const files = runGit(['diff', '--name-only', `${baseRef}..HEAD`, '--', ...paths]).trim()
  return Boolean(files)
}

function tagExists(tag) {
  try {
    runGit(['rev-parse', `${tag}^{}`])
    return true
  }
  catch {
    return false
  }
}

function createAnnotatedTag(tag, message) {
  const args = ['tag', '-a', tag, '-m', message]
  return ['git', ...args]
}

function pushTag(remote, tag) {
  return ['git', 'push', remote, tag]
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const date = args.date ?? utcDateYYYYMMDD()
  const sha = shortSha('HEAD')

  const packages = [
    resolvePackage('package.json', [
      'package.json',
      'src',
      'scripts',
    ]),
    resolvePackage('packages/markstream-vue2/package.json', [
      'packages/markstream-vue2',
    ]),
    resolvePackage('packages/markstream-react/package.json', [
      'packages/markstream-react',
    ]),
    resolvePackage('packages/markdown-parser/package.json', [
      'packages/markdown-parser',
    ]),
  ]

  const packageByName = new Map(packages.map(p => [p.name, p]))
  const parserName = 'stream-markdown-parser'
  const parserPropagatesTo = new Set([
    'markstream-vue',
    'markstream-vue2',
    'markstream-react',
  ])
  if (!packageByName.has(parserName)) {
    throw new Error(`[nightly] Expected parser package "${parserName}" not found in package list.`)
  }

  const created = []

  const directChangedByName = new Map()
  const baseRefByName = new Map()
  for (const pkg of packages) {
    const baseNightly = latestTag(`${pkg.name}@nightly-*`)
    const baseStable = latestTag(`${pkg.name}@[0-9]*`)
    const base = baseNightly ?? baseStable
    baseRefByName.set(pkg.name, base)
    const changed = args.all ? true : hasChangesSince(base, pkg.paths)
    directChangedByName.set(pkg.name, changed)
  }

  const parserChanged = Boolean(directChangedByName.get(parserName))
  const effectiveChangedByName = new Map(directChangedByName)
  const nightlyReasonByName = new Map()
  for (const [name, changed] of directChangedByName.entries()) {
    if (changed) {
      nightlyReasonByName.set(name, 'direct')
      continue
    }
    if (parserChanged && parserPropagatesTo.has(name)) {
      effectiveChangedByName.set(name, true)
      nightlyReasonByName.set(name, `dependency:${parserName}`)
    }
  }

  for (const pkg of packages) {
    const changed = Boolean(effectiveChangedByName.get(pkg.name))
    if (!changed)
      continue

    const tag = `${pkg.name}@nightly-${date}-${sha}`
    if (tagExists(tag))
      continue

    const reason = nightlyReasonByName.get(pkg.name) ?? 'direct'
    const message = reason === 'direct'
      ? `${pkg.name} nightly ${date} ${sha}`
      : `${pkg.name} nightly ${date} ${sha} (${reason})`
    const cmd = createAnnotatedTag(tag, message)
    if (args.dryRun) {
      console.log(`[nightly][dry-run] ${cmd.join(' ')}`)
    }
    else {
      runGit(cmd.slice(1), { stdio: 'inherit' })
    }

    if (args.push) {
      const pushCmd = pushTag(args.remote, tag)
      if (args.dryRun) {
        console.log(`[nightly][dry-run] ${pushCmd.join(' ')}`)
      }
      else {
        runGit(pushCmd.slice(1), { stdio: 'inherit' })
      }
    }

    created.push(tag)
  }

  // Machine-readable output for workflows.

  console.log(JSON.stringify({ created }, null, 2))
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
