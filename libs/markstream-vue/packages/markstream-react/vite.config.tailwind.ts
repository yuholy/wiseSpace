import { resolve } from 'node:path'
import process from 'node:process'
import autoprefixer from 'autoprefixer'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'

const pluginsArr: any[] = []

if (process.env.ANALYZE === 'true')
  pluginsArr.push(visualizer({ filename: 'bundle-visualizer-tailwind.html', gzipSize: true }) as any)

export default defineConfig({
  plugins: pluginsArr,
  build: {
    target: 'es2019',
    cssTarget: 'chrome80',
    copyPublicDir: false,
    outDir: 'dist-tw',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/tailwind-entry.ts'),
      formats: ['es'],
      name: 'markstream-react',
      fileName: 'index',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo: any) => {
          try {
            const fname = (assetInfo && ((assetInfo as any).name || (assetInfo as any).fileName || '')) as string
            if (fname && fname.endsWith('.css'))
              return 'index.tailwind.css'
          }
          catch {}
          return '[name][extname]'
        },
      },
    },
  },
  css: {
    postcss: {
      plugins: [
        // Do not run Tailwind here; this build produces the Tailwind-ready CSS.
        autoprefixer,
      ],
    },
  },
})
