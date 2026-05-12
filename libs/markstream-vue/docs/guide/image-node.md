# ImageNode — Custom preview handling

`ImageNode` renders images and emits events for user interactions. We expose a `click` event on images so you can take over the click behavior (for example to open a custom image preview / lightbox) without replacing the whole renderer.

- Events: `click` — emitted when a user clicks a successfully loaded image. Payload is `[Event, string]` where the second item is the src actually used for rendering (this may be a fallback URL).
- Events: `load` / `error` — emitted when an image finishes loading or fails, payload is the image `src`.

## Example: wrapper + VitePress registration

Create a small wrapper component that intercepts `click` and use `setCustomComponents` to register it in the client app.

### 1) `CustomImageNode.vue` (simple wrapper)

```vue twoslash
<script setup lang="ts">
import { ImageNode } from 'markstream-vue'

const emit = defineEmits(['load', 'error', 'click'])

function onImageClick(payload: [Event, string]) {
  const [, src] = payload
  // Simple example: open the image in a new tab for preview.
  // Replace this with a modal/lightbox call in real apps.
  window.open(src, '_blank')
  // Re-emit the click so parent code can also react if needed.
  emit('click', payload)
}
</script>

<template>
  <ImageNode v-bind="$attrs" @load="emit('load', $event)" @error="emit('error', $event)" @click="onImageClick" />
</template>
```

### 2) Register in VitePress theme enhance

```ts twoslash
import type { App, Component } from 'vue'
import { setCustomComponents } from 'markstream-vue'
// docs/.vitepress/theme/index.ts
declare const CustomImageNode: Component

export default ({ app }: { app: App }) => {
  setCustomComponents('vitepress-image-preview', { image: CustomImageNode })
}
```

## Optional: richer preview interactions

For zoom/gesture/slide support, call a lightbox library such as `photoswipe`, `fslightbox` or `basiclightbox` inside `onImageClick`, or control an application-level modal to show the preview.

## Summary

The `click` event from `ImageNode` is the primary hook for implementing custom previews. The usual approach is wrapping the original component and registering it with `setCustomComponents` in the client app. The wrapper can also forward `load`/`error` events or add additional behavior (analytics, alternative lazy-load handling, custom placeholders, etc.).

Quick try — register `CustomImageNode` in a VitePress client enhance and test clicking images in the `playground`:

```ts twoslash
// docs/.vitepress/theme/index.ts
import type { App, Component } from 'vue'
import { setCustomComponents } from 'markstream-vue'

declare const CustomImageNode: Component

export default ({ app }: { app: App }) => setCustomComponents('vitepress-image-preview', { image: CustomImageNode })
```
