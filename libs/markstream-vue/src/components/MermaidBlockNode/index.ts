import type { App } from 'vue'
import MermaidBlockNode from './MermaidBlockNode.vue'

MermaidBlockNode.install = (app: App) => {
  app.component(MermaidBlockNode.__name as string, MermaidBlockNode)
}

export default MermaidBlockNode
