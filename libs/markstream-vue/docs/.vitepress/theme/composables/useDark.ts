import { useData } from 'vitepress'

/**
 * VitePress theme composable for dark mode
 * Uses VitePress's built-in isDark from useData()
 *
 * @example
 * ```vue
 * <script setup>
 * const isDark = useDark()
 * </script>
 *
 * <template>
 *   <MarkdownRender :is-dark="isDark" />
 * </template>
 * ```
 */
export function useDark() {
  const { isDark } = useData()
  return isDark
}
