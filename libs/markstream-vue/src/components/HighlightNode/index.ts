import type { App } from 'vue'
import HighlightNode from './HighlightNode.vue'

HighlightNode.install = (app: App) => {
  app.component(HighlightNode.__name as string, HighlightNode)
}

export default HighlightNode
