import type { App } from 'vue'
import InlineCodeNode from './InlineCodeNode.vue'

InlineCodeNode.install = (app: App) => {
  app.component(InlineCodeNode.__name as string, InlineCodeNode)
}

export default InlineCodeNode
