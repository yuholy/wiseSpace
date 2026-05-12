import type { App } from 'vue'
import HardBreakNode from './HardBreakNode.vue'

HardBreakNode.install = (app: App) => {
  app.component(HardBreakNode.__name as string, HardBreakNode)
}

export default HardBreakNode
