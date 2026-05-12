import MarkdownRender from 'markstream-react'
import 'markstream-react/index.css'

export function BasicArticle({ markdown }: { markdown: string }) {
  return <MarkdownRender content={markdown} />
}
