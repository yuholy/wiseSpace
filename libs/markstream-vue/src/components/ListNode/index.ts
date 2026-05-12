import type { App } from 'vue'
import ListNode from './ListNode.vue'

ListNode.install = (app: App) => {
  app.component(ListNode.__name as string, ListNode)
}

export default ListNode
