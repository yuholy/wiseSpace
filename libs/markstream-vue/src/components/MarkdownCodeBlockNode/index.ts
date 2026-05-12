import type { App } from 'vue'
import MarkdownCodeBlockNode from './MarkdownCodeBlockNode.vue'

MarkdownCodeBlockNode.install = (app: App) => {
  app.component(MarkdownCodeBlockNode.__name as string, MarkdownCodeBlockNode)
}

export default MarkdownCodeBlockNode
