import type { App } from 'vue'
import ParagraphNode from './ParagraphNode.vue'

ParagraphNode.install = (app: App) => {
  app.component(ParagraphNode.__name as string, ParagraphNode)
}

export default ParagraphNode
