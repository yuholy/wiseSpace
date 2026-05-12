import type { App } from 'vue'
import CheckboxNode from './CheckboxNode.vue'

CheckboxNode.install = (app: App) => {
  app.component(CheckboxNode.__name as string, CheckboxNode)
}

export default CheckboxNode
