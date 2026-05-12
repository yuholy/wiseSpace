import type { App } from 'vue'
import SuperscriptNode from './SuperscriptNode.vue'

SuperscriptNode.install = (app: App) => {
  app.component(SuperscriptNode.__name as string, SuperscriptNode)
}

export default SuperscriptNode
