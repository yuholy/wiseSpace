declare module '*.vue' {
  import { defineComponent } from 'vue'
  const component: ReturnType<typeof defineComponent>
  export default component
}

// Vite asset imports used in this project
declare module '*.svg?raw' {
  const src: string
  export default src
}

declare module '*.svg?url' {
  const src: string
  export default src
}
