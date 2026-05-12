import type { App } from 'vue'
import StrikethroughNode from './StrikethroughNode.vue'

StrikethroughNode.install = (app: App) => {
  app.component(StrikethroughNode.__name as string, StrikethroughNode)
}

export default StrikethroughNode
