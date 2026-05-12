const fs = require('node:fs')
const { parseMarkdownToStructure, getMarkdown } = require('stream-markdown-parser')

const md = getMarkdown('midstates')

const probes = [
  '#x',
  '`x',
  '[x](http://a',
  '```mermaid\nflowchart TD\nA-->B',
  '- [ ] x\n',
  'Title\n===',
  '``x',
  '~~**x',
  '[:smile:x](http://a',
  'a | b\n---|---',
  '```js { foo:1 }',
  '<div',
  '::: tip\ncontent\n:::',
]

const out = []
for (const p of probes) {
  try {
    const nodes = parseMarkdownToStructure(p, md)
    out.push({ input: p, nodes })
  }
  catch (e) {
    out.push({ input: p, error: String((e && e.stack) || e) })
  }
}
fs.writeFileSync('test/probes/parse-output.json', JSON.stringify(out, null, 2), 'utf8')
console.log('WROTE test/probes/parse-output.json')
