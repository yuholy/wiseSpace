import type { App } from 'vue'
import InsertNode from './InsertNode.vue'

InsertNode.install = (app: App) => {
  app.component(InsertNode.__name as string, InsertNode)
}

export default InsertNode
