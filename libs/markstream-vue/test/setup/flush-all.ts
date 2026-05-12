import { nextTick } from 'vue'

/**
 * Flushes Vue microtasks and a couple of macrotasks to allow async chains
 * like: visibility await -> worker reject -> getKatex -> sync render -> DOM update.
 */
export async function flushAll() {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(r => setTimeout(r, 0))
  await new Promise(r => setTimeout(r, 0))
}
