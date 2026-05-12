import type { App } from 'vue'
import TableNode from './TableNode.vue'

TableNode.install = (app: App) => {
  app.component(TableNode.__name as string, TableNode)
}

export default TableNode
