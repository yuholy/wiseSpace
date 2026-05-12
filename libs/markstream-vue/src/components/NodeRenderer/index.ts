import type { App } from 'vue'
import NodeRenderer from './NodeRenderer.vue'

// Some SFCs (script setup) don't expose a typed `__name` property. Use
// a safe fallback chain: try the internal __name, then the standard name,
// and finally a hard-coded string. Cast to `any` only for the lookup so
// we don't weaken the component type elsewhere.
;

(NodeRenderer as any).install = (app: App) => {
  const compName = (NodeRenderer as any).__name ?? (NodeRenderer as any).name ?? 'NodeRenderer'
  app.component(compName as string, NodeRenderer)
}

export default NodeRenderer
