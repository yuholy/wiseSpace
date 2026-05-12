import { getMarkdown } from '../src/utils/markdown/getMarkdown'

const md = getMarkdown({})

// The content above is intentionally escaped wrong to mimic test; instead
// use the original test string:
const test = '可以看作 \\(' + '\\boldsymbol{\\beta}' + '\\) 与 \\(' + 'W' + '\\) 正交的一个特例（当 \\(' + 'W' + '\\) 只由 \\(' + '\\boldsymbol{\\alpha}' + '\\) 张成时）。'

console.log('INPUT:', test)
const tokens = md.parse(test, {})
console.log('TOKENS:')
for (const t of tokens) {
  console.log('type:', t.type, 'tag:', t.tag, 'content:', t.content ? t.content : '')
  if (t.children) {
    for (const c of t.children) {
      console.log('  child:', c.type, c.tag, c.content ? c.content : '')
    }
  }
}
