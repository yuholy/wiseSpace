import { execFileSync } from 'node:child_process'
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
    legacyPrefix: 'v',
    remote: 'origin',
    dryRun: true,
    push: false,
    rename: {
      // Historical package rename: keep tags stable under the current package name.
      'vue-renderer-markdown': 'markstream-vue',
    },
  }
  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i]
    if (cur === '--legacy-prefix') {
      args.legacyPrefix = argv[++i]
    }
    else if (cur === '--remote') {
      args.remote = argv[++i]
    }
    else if (cur === '--apply') {
      args.dryRun = false
    }
    else if (cur === '--dry-run') {
      args.dryRun = true
    }
    else if (cur === '--push') {
      args.push = true
    }
    else if (cur === '--rename') {
      const raw = String(argv[++i] ?? '')
      const [from, to] = raw.split('=')
      if (!from || !to)
        throw new Error(`Invalid --rename value (expected from=to): ${raw}`)
      args.rename[from.trim()] = to.trim()
    }
    else if (cur === '--help' || cur === '-h') {
      console.log(`
Usage:
  node scripts/backfill-legacy-tags.mjs [options]

This script creates namespaced package tags (e.g. stream-markdown-parser@0.0.53)
from legacy tags (e.g. v0.0.53) when it can uniquely map a legacy tag to exactly
one package's version at that commit.

Options:
  --legacy-prefix <p>     Legacy tag prefix (default: v)
  --dry-run               Print actions only (default)
  --apply                 Actually create tags
  --push                  Push created tags to remote
  --remote <name>         Remote name (default: origin)
  --rename <from=to>      Rewrite package name when creating tags (repeatable)
`)
      process.exit(0)
    }
    else {
      throw new Error(`Unknown argument: ${cur}`)
    }
  }
  return args
}

const RELEASE_PACKAGE_JSON_PATHS = [
  'package.json',
  'packages/markdown-parser/package.json',
  'packages/markstream-react/package.json',
  'packages/markstream-vue2/package.json',
]

async function getPackageMetaAtTag(legacyTag, packageJsonPath) {
  try {
    const raw = runGit(['show', `${legacyTag}:${packageJsonPath}`])
    const parsed = JSON.parse(raw)
    const name = String(parsed?.name ?? '').trim()
    const version = String(parsed?.version ?? '').trim()
    if (!name || !version)
      return null
    return { name, version, packageJsonPath }
  }
  catch {
    return null
  }
}

function getCommitForTag(tag) {
  try {
    return runGit(['rev-parse', `${tag}^{}`]).trim()
  }
  catch {
    return null
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()

  const legacyPattern = `${args.legacyPrefix}*`
  const legacyTags = runGit(['tag', '--list', legacyPattern])
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  if (!legacyTags.length) {
    console.log(`[backfill] No legacy tags found for pattern: ${legacyPattern}`)
    return
  }

  const created = []
  const skipped = []

  for (const legacyTag of legacyTags) {
    if (!legacyTag.startsWith(args.legacyPrefix)) {
      skipped.push({ legacyTag, reason: 'prefix-mismatch' })
      continue
    }

    const version = legacyTag.slice(args.legacyPrefix.length)
    if (!version) {
      skipped.push({ legacyTag, reason: 'empty-version' })
      continue
    }

    const matches = []
    for (const pj of RELEASE_PACKAGE_JSON_PATHS) {
      const meta = await getPackageMetaAtTag(legacyTag, pj)
      if (meta && meta.version === version)
        matches.push(meta)
    }

    if (matches.length !== 1) {
      skipped.push({ legacyTag, reason: `non-unique(${matches.length})` })
      continue
    }

    const target = matches[0]
    const canonicalName = args.rename[target.name] ?? target.name
    const newTag = `${canonicalName}@${target.version}`
    const existingCommit = getCommitForTag(newTag)
    if (existingCommit) {
      skipped.push({ legacyTag, reason: `already-exists(${newTag})` })
      continue
    }

    const legacyCommit = getCommitForTag(legacyTag)
    if (!legacyCommit) {
      skipped.push({ legacyTag, reason: 'legacy-tag-missing-commit' })
      continue
    }

    const tagArgs = ['tag', '-a', newTag, legacyTag, '-m', `Backfill from ${legacyTag}`]
    if (args.dryRun) {
      console.log(`[backfill][dry-run] git ${tagArgs.join(' ')}`)
    }
    else {
      runGit(tagArgs, { stdio: 'inherit', cwd })
    }

    if (args.push) {
      const pushArgs = ['push', args.remote, newTag]
      if (args.dryRun) {
        console.log(`[backfill][dry-run] git ${pushArgs.join(' ')}`)
      }
      else {
        runGit(pushArgs, { stdio: 'inherit', cwd })
      }
    }

    created.push({ legacyTag, newTag })
  }

  console.log(`[backfill] Done. created=${created.length} skipped=${skipped.length}`)
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
