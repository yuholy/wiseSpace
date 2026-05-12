import type { App } from 'vue'
import StrongNode from './StrongNode.vue'

StrongNode.install = (app: App) => {
  app.component(StrongNode.__name as string, StrongNode)
}

export default StrongNode
