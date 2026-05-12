export type HeightEstimationWorkload = 'text' | 'code'

interface HeightEstimationTranscriptOptions {
  total?: number
}

function buildCodeFence(language: string, lines: string[]) {
  return [`\`\`\`${language}`, ...lines, '```'].join('\n')
}

function buildPlainParagraph(index: number) {
  const variants = [
    'This keeps the structure simple enough for conservative measurement.',
    'It also mirrors restored chat history where adjacent messages can have noticeably different lengths.',
    'Some paragraphs stay compact while others expand with additional context about resize, restore anchoring, and viewport math.',
    'The goal is to avoid a perfectly uniform document so baseline average-height fallback has a more realistic distribution to approximate.',
  ]
  const repeat = (index % 4) + 1
  const suffix = Array.from({ length: repeat }, (_, variantIndex) =>
    variants[(index + variantIndex) % variants.length]).join(' ')

  return `Paragraph ${index} is intentionally plain text with enough words to wrap over multiple lines as the viewport moves between 375 and 1280 pixels. ${suffix}`
}

function buildCodeHeavyLines(index: number, count: number) {
  return Array.from({ length: count }, (_, lineIndex) => {
    const label = `section-${index}-${lineIndex}`
    if (lineIndex % 6 === 0)
      return `export const ${label.replace(/-/g, '_')} = ${index + lineIndex}`
    if (lineIndex % 6 === 1)
      return `export function render${index}_${lineIndex}(input: string) {`
    if (lineIndex % 6 === 2)
      return `  return input.split(/\\r?\\n/).map((line, idx) => \`\${idx}:\${line.trim()}\`)`
    if (lineIndex % 6 === 3)
      return '}'
    if (lineIndex % 6 === 4)
      return `const tuple${lineIndex} = ['${label}', ${index}, ${lineIndex}] as const`
    return `console.log('${label}', tuple${Math.max(0, lineIndex - 1)})`
  })
}

export function buildHeightEstimationTranscript(workload: HeightEstimationWorkload, options: HeightEstimationTranscriptOptions = {}) {
  const blocks: string[] = [
    `# Height Estimation ${workload === 'text' ? 'Text' : 'Code'} Workload`,
    'This transcript is generated for cross-framework height-estimation experiments.',
  ]

  const total = Math.max(32, Math.round(options.total ?? (workload === 'text' ? 960 : 720)))

  for (let index = 1; index <= total; index += 1) {
    if (index % 64 === 0) {
      blocks.push(`## Section ${index / 64}`)
      continue
    }

    if (workload === 'text') {
      if (index % 33 === 0) {
        blocks.push([
          '- A simple list item that keeps the inline structure predictable for measurement.',
          '- Another simple list item that should still go through the conservative text estimator.',
          '- Final list item used to validate list wrapper overhead.',
        ].join('\n'))
        continue
      }

      if (index % 29 === 0) {
        blocks.push(`Paragraph ${index} mixes [links](https://example.com/${index}) with **strong text** and \`inline code\` so conservative text estimation should skip it.`)
        continue
      }

      if (index % 87 === 0) {
        blocks.push(buildCodeFence('ts', [
          `export function helper${index}(source: string) {`,
          '  return source.split(/\\r?\\n/).map((line, lineIndex) => ({ lineIndex, line }))',
          '}',
        ]))
        continue
      }

      blocks.push(buildPlainParagraph(index))
      continue
    }

    if (index % 3 === 0) {
      const lineCount = 8 + (index % 5) * 6
      blocks.push(buildCodeFence('ts', [
        `export const record${index} = {`,
        `  id: ${index},`,
        `  label: 'code-heavy-${index}',`,
        `  values: Array.from({ length: 8 }, (_, i) => i + ${index}),`,
        '}',
        '',
        ...buildCodeHeavyLines(index, lineCount),
      ]))
      continue
    }

    if (index % 11 === 0) {
      const diffLines = 4 + (index % 4) * 3
      blocks.push(buildCodeFence('diff-ts', [
        '<<<<<<< original',
        `export const diff${index} = () => 'before-${index}'`,
        ...Array.from({ length: diffLines }, (_, lineIndex) => `const before_${index}_${lineIndex} = ${lineIndex}`),
        '=======',
        `export const diff${index} = () => 'after-${index}'`,
        ...Array.from({ length: diffLines }, (_, lineIndex) => `const after_${index}_${lineIndex} = ${lineIndex + 1}`),
        '>>>>>>> updated',
      ]))
      continue
    }

    blocks.push(`Code workload paragraph ${index} still provides text around code blocks so the renderer has mixed content and realistic spacing between editors. ${index % 2 === 0 ? 'Some of these paragraphs intentionally stay short.' : 'Others stretch longer to keep the surrounding non-code heights uneven across the transcript.'}`)
  }

  return blocks.join('\n\n')
}
