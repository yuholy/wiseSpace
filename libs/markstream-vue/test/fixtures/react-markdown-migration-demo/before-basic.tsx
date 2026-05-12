import Markdown from 'react-markdown'

export function BasicArticle({ markdown }: { markdown: string }) {
  return <Markdown>{markdown}</Markdown>
}
