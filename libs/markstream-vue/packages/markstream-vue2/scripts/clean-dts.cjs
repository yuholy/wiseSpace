const fs = require('node:fs')
const path = require('node:path')

const distDir = path.resolve(__dirname, '..', 'dist')
const typesDir = path.join(distDir, 'types')

function rewriteTypesEntry(content) {
  return content
    .replace(/from\s+(['"])\.\//g, 'from $1./types/')
    .replace(/import\((['"])\.\//g, 'import($1./types/')
}

const sourcePath = path.join(typesDir, 'exports.d.ts')
const targetPath = path.join(distDir, 'index.d.ts')

if (fs.existsSync(sourcePath)) {
  const content = rewriteTypesEntry(fs.readFileSync(sourcePath, 'utf8'))
  fs.writeFileSync(targetPath, content)
  console.log('Rewrote', targetPath, 'from', sourcePath)
}
