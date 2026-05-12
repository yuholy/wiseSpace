import CompositionApi, * as CompositionApiExports from '@vue/composition-api'
import Vue from 'vue'

// Vue 2.6 needs the Composition API plugin to support `setup`.
// Also expose Composition API helpers on the Vue export because
// the built markstream-vue2 bundle imports them from "vue".
const compositionApiInstalled = Vue.__composition_api_installed__ || Vue.__compositionApiInstalled
if (!compositionApiInstalled) {
  Vue.use(CompositionApi)
  Vue.__compositionApiInstalled = true
}

Object.keys(CompositionApiExports).forEach((key) => {
  if (key === 'default')
    return
  if (Vue[key] == null)
    Vue[key] = CompositionApiExports[key]
})
