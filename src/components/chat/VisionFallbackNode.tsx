import { theme } from 'antd';
import { ImageIcon, Sparkles } from 'lucide-react';
import type { NodeComponentProps } from 'markstream-react';
import { useTranslation } from 'react-i18next';

type VisionFallbackNodeData = {
  type: 'vision-fallback';
  attrs?: Record<string, string> | [string, string][];
  loading?: boolean;
};

function getAttrValue(
  attrs: VisionFallbackNodeData['attrs'],
  key: string,
): string | undefined {
  if (!attrs) return undefined;
  if (Array.isArray(attrs)) {
    const entry = attrs.find(([name]) => name === key);
    return entry?.[1];
  }
  return attrs[key];
}

export function VisionFallbackNode(props: NodeComponentProps<VisionFallbackNodeData>) {
  const { node } = props;
  const { token } = theme.useToken();
  const { t } = useTranslation();

  const provider = getAttrValue(node.attrs, 'provider');
  const model = getAttrValue(node.attrs, 'model');
  const imageCount = Number(getAttrValue(node.attrs, 'images') ?? '0') || 0;

  const label = t('chat.visionFallback.used', {
    count: imageCount > 0 ? imageCount : 1,
    defaultValue: 'Used image fallback helper for {{count}} image(s)',
  });
  const detail = model
    ? t('chat.visionFallback.helper', {
        model,
        provider: provider ?? '',
        defaultValue: provider ? '{{model}} · {{provider}}' : '{{model}}',
      })
    : null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        marginBottom: 8,
        borderRadius: 8,
        backgroundColor: token.colorFillQuaternary,
        color: token.colorTextSecondary,
        fontSize: 12,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ImageIcon size={14} style={{ color: token.colorPrimary }} />
        <span>{label}</span>
      </span>
      {detail ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: token.colorTextTertiary,
          }}
        >
          <Sparkles size={12} />
          {detail}
        </span>
      ) : null}
    </div>
  );
}
