import type { App } from 'vue'
import HeadingNode from './HeadingNode.vue'

// local binding to avoid circular import alias during declaration emit
const _HeadingNode = HeadingNode as any

_HeadingNode.install = (app: App) => {
  app.component(HeadingNode.__name as string, HeadingNode)
}

export default _HeadingNode
