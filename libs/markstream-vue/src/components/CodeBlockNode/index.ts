import type { App } from 'vue'
import CodeBlockNode from './CodeBlockNode.vue'

CodeBlockNode.install = (app: App) => {
  app.component(CodeBlockNode.__name as string, CodeBlockNode)
}

export default CodeBlockNode
