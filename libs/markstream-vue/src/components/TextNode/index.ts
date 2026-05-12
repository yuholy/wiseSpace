import type { App } from 'vue'
import TextNode from './TextNode.vue'

TextNode.install = (app: App) => {
  app.component(TextNode.__name as string, TextNode)
}

export default TextNode
