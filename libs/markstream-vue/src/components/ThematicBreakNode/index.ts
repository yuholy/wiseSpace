import type { App } from 'vue'
import ThematicBreakNode from './ThematicBreakNode.vue'

ThematicBreakNode.install = (app: App) => {
  app.component(ThematicBreakNode.__name as string, ThematicBreakNode)
}

export default ThematicBreakNode
