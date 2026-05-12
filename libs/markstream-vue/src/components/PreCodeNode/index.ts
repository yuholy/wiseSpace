import type { App } from 'vue'
import PreCodeNode from './PreCodeNode.vue'

PreCodeNode.install = (app: App) => {
  app.component(PreCodeNode.__name as string, PreCodeNode)
}

export default PreCodeNode
