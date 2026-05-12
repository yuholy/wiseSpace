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
    pattern: 'v*',
    remote: 'origin',
    dryRun: true,
    deleteLocal: false,
    deleteRemote: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i]
    if (cur === '--pattern') {
      args.pattern = argv[++i]
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
    else if (cur === '--local') {
      args.deleteLocal = true
    }
    else if (cur === '--remote-delete') {
      args.deleteRemote = true
    }
    else if (cur === '--help' || cur === '-h') {
      console.log(`
Usage:
  node scripts/prune-tags.mjs [options]

Options:
  --pattern <glob>         Tag pattern for git tag --list (default: v*)
  --dry-run                Print actions only (default)
  --apply                  Actually delete tags (requires --local and/or --remote-delete)
  --local                  Delete local tags
  --remote-delete          Delete remote tags (git push origin :refs/tags/<tag>)
  --remote <name>          Git remote name (default: origin)

Examples:
  node scripts/prune-tags.mjs --pattern 'v*' --dry-run
  node scripts/prune-tags.mjs --pattern 'v*' --apply --local
  node scripts/prune-tags.mjs --pattern 'v*' --apply --local --remote-delete --remote origin
`)
      process.exit(0)
    }
    else {
      throw new Error(`Unknown argument: ${cur}`)
    }
  }

  if (!args.dryRun && !args.deleteLocal && !args.deleteRemote)
    throw new Error('Nothing to do: pass --local and/or --remote-delete with --apply.')

  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const tags = runGit(['tag', '--list', args.pattern])
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  if (!tags.length) {
    console.log(`[prune-tags] No tags match: ${args.pattern}`)
    return
  }

  console.log(`[prune-tags] matched=${tags.length} pattern=${args.pattern} dryRun=${args.dryRun}`)

  for (const tag of tags) {
    if (args.deleteLocal) {
      const cmd = ['tag', '-d', tag]
      if (args.dryRun) {
        console.log(`[prune-tags][dry-run] git ${cmd.join(' ')}`)
      }
      else {
        runGit(cmd, { stdio: 'inherit' })
      }
    }
  }

  if (args.deleteRemote) {
    for (const tag of tags) {
      const cmd = ['push', args.remote, `:refs/tags/${tag}`]
      if (args.dryRun) {
        console.log(`[prune-tags][dry-run] git ${cmd.join(' ')}`)
      }
      else {
        runGit(cmd, { stdio: 'inherit' })
      }
    }
  }
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
