import type { App } from 'vue'
import BlockquoteNode from './BlockquoteNode.vue'

BlockquoteNode.install = (app: App) => {
  app.component(BlockquoteNode.__name as string, BlockquoteNode)
}

export default BlockquoteNode
