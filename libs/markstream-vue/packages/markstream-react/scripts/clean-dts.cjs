const fs = require('node:fs')
const path = require('node:path')

const typesDir = path.resolve(__dirname, '..', 'dist', 'types')
const distDir = path.resolve(__dirname, '..', 'dist')

function rewriteTypesEntry(content) {
  return content
    .replace(/from\s+(['"])\.\//g, 'from $1./types/')
    .replace(/import\((['"])\.\//g, 'import($1./types/')
}

function copyEntry(entryName) {
  const sourcePath = path.join(typesDir, `${entryName}.d.ts`)
  const targetPath = path.join(distDir, `${entryName}.d.ts`)
  if (!fs.existsSync(sourcePath))
    return

  const content = rewriteTypesEntry(fs.readFileSync(sourcePath, 'utf8'))
  fs.writeFileSync(targetPath, content)
  console.log('Rewrote', targetPath, 'from', sourcePath)
}

for (const entryName of ['index']) {
  copyEntry(entryName)
}
