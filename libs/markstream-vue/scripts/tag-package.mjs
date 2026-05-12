import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
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
    packageJson: 'package.json',
    ref: 'HEAD',
    tag: null,
    message: null,
    remote: 'origin',
    push: false,
    pushTagOnly: false,
    allowDirty: false,
    dryRun: false,
    force: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i]
    if (cur === '--package-json') {
      args.packageJson = argv[++i]
    }
    else if (cur === '--ref') {
      args.ref = argv[++i]
    }
    else if (cur === '--tag') {
      args.tag = argv[++i]
    }
    else if (cur === '--message') {
      args.message = argv[++i]
    }
    else if (cur === '--remote') {
      args.remote = argv[++i]
    }
    else if (cur === '--push') {
      args.push = true
    }
    else if (cur === '--push-tag-only') {
      args.pushTagOnly = true
    }
    else if (cur === '--allow-dirty') {
      args.allowDirty = true
    }
    else if (cur === '--dry-run') {
      args.dryRun = true
    }
    else if (cur === '--force') {
      args.force = true
    }
    else if (cur === '--help' || cur === '-h') {
      console.log(`
Usage:
  node scripts/tag-package.mjs [options]

Options:
  --package-json <path>   Path to package.json (default: package.json)
  --ref <git-ref>         Tag target ref (default: HEAD)
  --tag <tagName>         Override tag name (default: <name>@<version>)
  --message <msg>         Tag annotation message (default: tag name)
  --remote <name>         Git remote to push to (default: origin)
  --push                  Push current branch + the new tag
  --push-tag-only         Only push the tag (skip git push)
  --allow-dirty           Skip clean working tree check
  --dry-run               Print actions without mutating git state
  --force                 Force-update local tag if it exists
`)
      process.exit(0)
    }
    else {
      throw new Error(`Unknown argument: ${cur}`)
    }
  }

  return args
}

function getCommitForRef(ref) {
  return runGit(['rev-parse', `${ref}^{}`]).trim()
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

  if (!args.allowDirty) {
    const dirty = runGit(['status', '--porcelain']).trim()
    if (dirty) {
      throw new Error(`Working tree is not clean. Commit/stash changes or pass --allow-dirty.\n\n${dirty}`)
    }
  }

  const packageJsonAbs = path.resolve(process.cwd(), args.packageJson)
  const pkg = JSON.parse(await readFile(packageJsonAbs, 'utf8'))
  const name = String(pkg?.name ?? '').trim()
  const version = String(pkg?.version ?? '').trim()
  if (!name || !version)
    throw new Error(`Invalid package.json (missing name/version): ${args.packageJson}`)

  const tagName = args.tag ?? `${name}@${version}`
  const message = args.message ?? tagName
  const refCommit = getCommitForRef(args.ref)
  const existingCommit = getCommitForTag(tagName)

  if (existingCommit && existingCommit === refCommit) {
    console.log(`[tag-package] Tag already exists: ${tagName} -> ${existingCommit}`)
    return
  }

  if (existingCommit && !args.force)
    throw new Error(`[tag-package] Tag already exists and points elsewhere: ${tagName} -> ${existingCommit} (wanted ${refCommit}). Use --force if you really want to retag locally.`)

  const tagArgs = ['tag', '-a', tagName, args.ref, '-m', message]
  if (args.force)
    tagArgs.splice(2, 0, '-f')

  if (args.dryRun) {
    console.log(`[tag-package][dry-run] git ${tagArgs.join(' ')}`)
  }
  else {
    runGit(tagArgs, { stdio: 'inherit' })
  }

  if (!args.push)
    return

  if (!args.pushTagOnly) {
    if (args.dryRun) {
      console.log('[tag-package][dry-run] git push')
    }
    else {
      runGit(['push'], { stdio: 'inherit' })
    }
  }

  if (args.dryRun) {
    console.log(`[tag-package][dry-run] git push ${args.remote} ${tagName}`)
  }
  else {
    runGit(['push', args.remote, tagName], { stdio: 'inherit' })
  }
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
