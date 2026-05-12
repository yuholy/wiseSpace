import type { App } from 'vue'
import LinkNode from './LinkNode.vue'

LinkNode.install = (app: App) => {
  app.component(LinkNode.__name as string, LinkNode)
}

export default LinkNode
