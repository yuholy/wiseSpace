export function getVue2MinorVersion(version: unknown) {
  const raw = typeof version === 'string' ? version : ''
  const [major, minor] = raw.split('.').map(Number)
  if (!Number.isFinite(major) || !Number.isFinite(minor) || major !== 2)
    return null
  return minor
}

function hasProperty(input: unknown, key: PropertyKey) {
  if (input == null)
    return false
  const type = typeof input
  if (type !== 'object' && type !== 'function')
    return false
  return key in (input as object)
}

export function isLegacyVue26Version(version: unknown) {
  const minor = getVue2MinorVersion(version)
  return minor != null && minor < 7
}

export function resolveVueVersion(input: any) {
  const directBaseVersion = input?.$options?._base?.version
  if (typeof directBaseVersion === 'string' && directBaseVersion)
    return directBaseVersion

  const rootBaseVersion = input?.$root?.$options?._base?.version
  if (typeof rootBaseVersion === 'string' && rootBaseVersion)
    return rootBaseVersion

  if (hasProperty(input, '$')) {
    const appVersion = input.$?.appContext?.app?.version
    if (typeof appVersion === 'string' && appVersion)
      return appVersion
  }

  if (hasProperty(input, 'constructor')) {
    const ctorVersion = input.constructor?.version
    if (typeof ctorVersion === 'string' && ctorVersion)
      return ctorVersion
  }

  if (hasProperty(input, 'version')) {
    const version = input.version
    if (typeof version === 'string' && version)
      return version
  }

  return ''
}

export function isLegacyVue26Vm(input: any) {
  return isLegacyVue26Version(resolveVueVersion(input))
}

type VueListener = (...args: unknown[]) => unknown
type VueListenerValue = VueListener | VueListener[]

function normalizeListenerEvent(key: string) {
  return key
    .slice(2)
    .replace(/^[A-Z]/, char => char.toLowerCase())
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
}

export function resolveVueListeners(input: any) {
  if (hasProperty(input, '$listeners')) {
    const listeners = input.$listeners
    if (listeners && typeof listeners === 'object')
      return listeners as Record<string, VueListenerValue>
  }

  if (!hasProperty(input, '$attrs'))
    return {}

  const attrs = input.$attrs
  if (!attrs || typeof attrs !== 'object')
    return {}

  const listeners: Record<string, VueListenerValue> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (!/^on[A-Z]/.test(key))
      continue
    if (typeof value === 'function')
      listeners[normalizeListenerEvent(key)] = value as VueListener
    else if (Array.isArray(value) && value.every(item => typeof item === 'function'))
      listeners[normalizeListenerEvent(key)] = value as VueListener[]
  }
  return listeners
}
