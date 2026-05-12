import type { App } from 'vue'
import EmojiNode from './EmojiNode.vue'

EmojiNode.install = (app: App) => {
  app.component(EmojiNode.__name as string, EmojiNode)
}

export default EmojiNode
