let infographicPromise: Promise<any> | null = null
let infographicInstance: any = null

export async function getInfographic() {
  if (infographicInstance)
    return infographicInstance
  if (infographicPromise)
    return infographicPromise

  infographicPromise = import('@antv/infographic')
    .then((mod) => {
      // Normalize module
      const defaultExport = (mod && (mod as any).default) ? (mod as any).default : mod

      let resolved = defaultExport

      if (typeof defaultExport === 'function' && defaultExport.prototype && defaultExport.prototype.render) {
        resolved = defaultExport
      }
      else if (mod.Infographic) {
        resolved = mod.Infographic
      }
      else if (defaultExport && defaultExport.Infographic) {
        resolved = defaultExport.Infographic
      }

      infographicInstance = resolved
      return resolved
    })
    .catch((e) => {
      console.warn('Failed to load @antv/infographic', e)
      return null
    })
  return infographicPromise
}
