import type { App } from 'vue'
import HtmlBlockNode from './HtmlBlockNode.vue'

HtmlBlockNode.install = (app: App) => {
  app.component(HtmlBlockNode.__name as string, HtmlBlockNode)
}

export default HtmlBlockNode
