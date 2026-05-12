import type { App } from 'vue'
import ListItemNode from './ListItemNode.vue'

ListItemNode.install = (app: App) => {
  app.component(ListItemNode.__name as string, ListItemNode)
}

export default ListItemNode
