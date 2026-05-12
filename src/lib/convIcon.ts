import { LEGACY_CONV_ICON_KEY_PREFIX } from './legacyCompat';

export type ConvIconType = 'model' | 'emoji' | 'url' | 'file';

export interface ConvIcon {
  type: ConvIconType;
  value: string;
}

export const CONV_ICON_KEY = (id: string) => `wisespace_conv_icon_${id}`;

export function getConvIcon(conversationId: string): ConvIcon | null {
  const stored =
    localStorage.getItem(CONV_ICON_KEY(conversationId))
    ?? localStorage.getItem(`${LEGACY_CONV_ICON_KEY_PREFIX}${conversationId}`);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as ConvIcon;
  } catch {
    return null;
  }
}
