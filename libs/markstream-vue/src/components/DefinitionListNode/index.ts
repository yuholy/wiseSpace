import type { App } from 'vue'
import DefinitionListNode from './DefinitionListNode.vue'

DefinitionListNode.install = (app: App) => {
  app.component(DefinitionListNode.__name as string, DefinitionListNode)
}

export default DefinitionListNode
