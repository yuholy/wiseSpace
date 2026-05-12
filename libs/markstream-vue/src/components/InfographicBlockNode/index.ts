import type { App } from 'vue'
import InfographicBlockNode from './InfographicBlockNode.vue'

InfographicBlockNode.install = (app: App) => {
  app.component(InfographicBlockNode.__name as string, InfographicBlockNode)
}

export default InfographicBlockNode
