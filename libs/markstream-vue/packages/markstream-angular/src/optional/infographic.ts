let infographicPromise: Promise<any> | null = null
let infographicInstance: any = null

export async function getInfographic() {
  if (infographicInstance)
    return infographicInstance
  if (infographicPromise)
    return await infographicPromise

  infographicPromise = import('@antv/infographic')
    .then((mod) => {
      const defaultExport = (mod && (mod as any).default) ? (mod as any).default : mod

      let resolved = defaultExport

      if (typeof defaultExport === 'function' && defaultExport.prototype && defaultExport.prototype.render) {
        resolved = defaultExport
      }
      else if ((mod as any)?.Infographic) {
        resolved = (mod as any).Infographic
      }
      else if (defaultExport && defaultExport.Infographic) {
        resolved = defaultExport.Infographic
      }

      infographicInstance = resolved
      return resolved
    })
    .catch((error) => {
      console.warn('[markstream-angular] Failed to load @antv/infographic', error)
      return null
    })

  return await infographicPromise
}
