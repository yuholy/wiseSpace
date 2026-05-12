import type { App } from 'vue'
import FootnoteReferenceNode from './FootnoteReferenceNode.vue'

FootnoteReferenceNode.install = (app: App) => {
  app.component(FootnoteReferenceNode.__name as string, FootnoteReferenceNode)
}

export default FootnoteReferenceNode
