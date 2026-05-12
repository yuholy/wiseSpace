import type { App } from 'vue'
import MathBlockNode from './MathBlockNode.vue'

MathBlockNode.install = (app: App) => {
  app.component(MathBlockNode.__name as string, MathBlockNode)
}

export default MathBlockNode
