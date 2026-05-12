import type { App } from 'vue'
import SubscriptNode from './SubscriptNode.vue'

SubscriptNode.install = (app: App) => {
  app.component(SubscriptNode.__name as string, SubscriptNode)
}

export default SubscriptNode
