function resolveVendorAssetUrl(pathname: string) {
  if (typeof document !== 'undefined')
    return new URL(pathname.replace(/^\/+/, ''), document.baseURI).href

  return pathname
}

export async function bootstrapPlayground() {
  const [
    { enableD2, setKaTeXWorker, setMermaidWorker },
    { provideZonelessChangeDetection },
    { bootstrapApplication },
    { AppComponent },
    { default: KatexWorker },
    { default: MermaidWorker },
  ] = await Promise.all([
    import('markstream-angular'),
    import('@angular/core'),
    import('@angular/platform-browser'),
    import('./app.component'),
    import('../../packages/markstream-angular/src/workers/katexRenderer.worker?worker&inline'),
    import('../../packages/markstream-angular/src/workers/mermaidParser.worker?worker&inline'),
  ])

  const d2VendorUrl = resolveVendorAssetUrl('/vendor/d2-browser.js')
  enableD2?.(() => import(/* @vite-ignore */ d2VendorUrl))
  setKaTeXWorker?.(new KatexWorker())
  setMermaidWorker?.(new MermaidWorker())

  return bootstrapApplication(AppComponent, {
    providers: [
      provideZonelessChangeDetection(),
    ],
  })
}
