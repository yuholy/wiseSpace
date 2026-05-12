// Provide a lightweight module declaration so Playground imports of the
// local `src/components/NodeRenderer` (used for dev) get proper types.
// This maps the source import to the package's exported types (which are
// available at `dist/index.d.ts`). It helps the editor and `vue-tsc` when
// the playground imports the component by relative path.
declare module '../../../src/components/NodeRenderer' {
  // Use the package's exported default type as the component type.
  const comp: import('markstream-vue').default
  export default comp
}
