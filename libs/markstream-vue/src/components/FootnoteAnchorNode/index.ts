import type { App } from 'vue'
import FootnoteAnchorNode from './FootnoteAnchorNode.vue'

FootnoteAnchorNode.install = (app: App) => {
  app.component(FootnoteAnchorNode.__name as string, FootnoteAnchorNode)
}

export default FootnoteAnchorNode
