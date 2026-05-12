import type { App } from 'vue'
import FootnoteNode from './FootnoteNode.vue'

FootnoteNode.install = (app: App) => {
  app.component(FootnoteNode.__name as string, FootnoteNode)
}

export default FootnoteNode
