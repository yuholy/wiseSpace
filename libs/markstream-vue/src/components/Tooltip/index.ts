import type { App } from 'vue'
import Tooltip from './Tooltip.vue'

Tooltip.install = (app: App) => {
  app.component(Tooltip.__name as string, Tooltip)
}

export default Tooltip
