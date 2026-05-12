import type { App } from 'vue'
import ImageNode from './ImageNode.vue'

ImageNode.install = (app: App) => {
  app.component(ImageNode.__name as string, ImageNode)
}

export default ImageNode
