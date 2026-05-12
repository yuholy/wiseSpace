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
]

for (const p of probes) {
  try {
    const nodes = parseMarkdownToStructure(p, md)
    console.log('--- INPUT:', JSON.stringify(p))
    console.log(JSON.stringify(nodes, null, 2))
  }
  catch (e) {
    console.error('ERROR for input', p, (e && e.stack) || e)
  }
}
