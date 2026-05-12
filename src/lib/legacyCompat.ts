const LEGACY_APP_SLUG = ['aq', 'bot'].join('');

export const LEGACY_DEEP_LINK_PROTOCOL = `${LEGACY_APP_SLUG}:`;
export const LEGACY_DISPLAY_ATTR_NAME = `data-${LEGACY_APP_SLUG}`;
export const LEGACY_CONV_ICON_KEY_PREFIX = `${LEGACY_APP_SLUG}_conv_icon_`;
export const LEGACY_STORAGE_KEY_PREFIX = `${LEGACY_APP_SLUG}_`;

export function buildDisplayAttrAlternation(primaryAttrName: string): string {
  return `(?:${primaryAttrName}|${LEGACY_DISPLAY_ATTR_NAME})`;
}
