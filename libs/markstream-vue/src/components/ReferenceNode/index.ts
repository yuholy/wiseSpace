import type { App } from 'vue'
import ReferenceNode from './ReferenceNode.vue'

ReferenceNode.install = (app: App) => {
  app.component(ReferenceNode.__name as string, ReferenceNode)
}

export default ReferenceNode
