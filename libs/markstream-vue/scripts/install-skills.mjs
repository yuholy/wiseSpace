import process from 'node:process'
import {
  parseInstallArgs,
  printInstallHelp,
  printInstallSummary,
  runSkillsInstall,
} from '../bin/skills-lib.mjs'

async function main() {
  const args = parseInstallArgs(process.argv.slice(2), {
    target: 'agents',
    mode: 'symlink',
  })

  if (args.help) {
    printInstallHelp('node scripts/install-skills.mjs', 'symlink')
    return
  }

  const result = await runSkillsInstall(args)
  printInstallSummary(result)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
