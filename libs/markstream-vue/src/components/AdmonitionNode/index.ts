import type { App } from 'vue'
import AdmonitionNode from './AdmonitionNode.vue'

AdmonitionNode.install = (app: App) => {
  app.component(AdmonitionNode.__name as string, AdmonitionNode)
}

export default AdmonitionNode
