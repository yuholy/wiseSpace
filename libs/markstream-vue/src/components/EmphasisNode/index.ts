import type { App } from 'vue'
import EmphasisNode from './EmphasisNode.vue'

EmphasisNode.install = (app: App) => {
  app.component(EmphasisNode.__name as string, EmphasisNode)
}

export default EmphasisNode
