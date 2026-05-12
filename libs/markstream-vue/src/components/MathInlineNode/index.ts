import type { App } from 'vue'
import MathInlineNode from './MathInlineNode.vue'

MathInlineNode.install = (app: App) => {
  app.component(MathInlineNode.__name as string, MathInlineNode)
}

export default MathInlineNode
