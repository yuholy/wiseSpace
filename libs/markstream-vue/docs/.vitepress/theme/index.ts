import type { EnhanceAppContext } from 'vitepress'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import MarkdownRender from 'markstream-vue'
import Theme from 'vitepress/theme'
import GitHubStarBadge from './GitHubStarBadge.vue'
import Layout from './Layout.vue'
import SupportQRCodes from './SupportQRCodes.vue'
import '@shikijs/vitepress-twoslash/style.css'
import 'markstream-vue/index.css'
import './style.css'

export default {
  extends: Theme,
  Layout,
  enhanceApp({ app }: EnhanceAppContext) {
    app.use(TwoslashFloatingVue)
    app.component('GitHubStarBadge', GitHubStarBadge)
    app.component('MarkdownRender', MarkdownRender)
    app.component('SupportQRCodes', SupportQRCodes)
  },
}

// Export useDark for use in VitePress markdown files and components
export { useDark } from './composables/useDark'
