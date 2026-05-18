import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@/types';
import { DefaultModelSettings } from '../DefaultModelSettings';

const mocks = vi.hoisted(() => ({
  saveSettings: vi.fn(),
  fetchProviders: vi.fn(async () => undefined),
}));

let settings: Partial<AppSettings> = {};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const labels: Record<string, string> = {
        'settings.defaultConversationModel': 'Default Conversation Model',
        'settings.defaultConversationModelDesc': 'Default model for new conversations.',
        'settings.titleSummaryModel': 'Title Summary Model',
        'settings.titleSummaryModelDesc': 'Model used for title generation.',
        'settings.compressionModel': 'Context Compression Model',
        'settings.compressionModelDesc': 'Model used for context compression.',
        'settings.multimodalFallbackModel': 'Fallback vision model',
        'settings.multimodalFallbackEnabledDesc': 'When the current model cannot inspect images, use a vision-capable helper model first.',
        'settings.multimodalFallbackPlaceholder': 'Select a vision-capable model',
        'settings.multimodalFallbackDesc': 'The helper model analyzes attached images first, then passes a summary and OCR back to the current text model.',
        'settings.useActiveModel': 'Use active conversation model',
        'settings.compressionPromptPlaceholder': 'Compress...',
        'settings.promptLabel': 'Prompt',
        'settings.modelParams': 'Model Params',
        'settings.contextCount': 'Context Count',
        'settings.contextCountTooltip': 'Context Count Tooltip',
        'settings.titleSummaryPromptPlaceholder': 'Title prompt',
        'common.unlimited': 'Unlimited',
      };
      return labels[key] ?? fallback ?? key;
    },
  }),
}));

vi.mock('antd', () => {
  const Input = () => null;
  Input.TextArea = ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
  }) => <textarea placeholder={placeholder} value={value} onChange={onChange} />;

  return {
    Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
      <button type="button" onClick={onClick}>{children}</button>
    ),
    Divider: () => <hr />,
    Input,
    InputNumber: ({ value, onChange }: { value?: number; onChange?: (value: number | null) => void }) => (
      <input type="number" value={value ?? ''} onChange={(e) => onChange?.(Number(e.target.value))} />
    ),
    Modal: ({ open, children }: { open?: boolean; children?: React.ReactNode }) => (open ? <div>{children}</div> : null),
    Slider: () => <div />,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    theme: {
      useToken: () => ({
        token: {
          colorTextDescription: '#666666',
        },
      }),
    },
  };
});

vi.mock('@/components/shared/ModelSelect', () => ({
  parseModelValue: (value: string | undefined) => {
    if (!value) return null;
    const idx = value.indexOf('::');
    if (idx < 0) return null;
    return { providerId: value.slice(0, idx), modelId: value.slice(idx + 2) };
  },
  ModelSelect: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange: (value: string | undefined) => void;
    placeholder?: string;
  }) => (
    <select
      aria-label={placeholder ?? 'model-select'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">--</option>
      <option value="provider-vision::MiniMax-VL-01">MiniMax-VL-01</option>
    </select>
  ),
}));

vi.mock('@/components/common/ModelParamSliders', () => ({
  ModelParamSliders: () => <div />,
}));

vi.mock('../SettingsGroup', () => ({
  SettingsGroup: ({
    title,
    children,
  }: {
    title?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <section>
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  ),
}));

vi.mock('@/stores', () => ({
  useSettingsStore: (
    selector: (state: { settings: Partial<AppSettings>; saveSettings: typeof mocks.saveSettings }) => unknown,
  ) =>
    selector({
      settings,
      saveSettings: mocks.saveSettings,
    }),
  useProviderStore: (
    selector: (state: { fetchProviders: typeof mocks.fetchProviders }) => unknown,
  ) =>
    selector({
      fetchProviders: mocks.fetchProviders,
    }),
}));

describe('DefaultModelSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings = {
      multimodal_fallback_enabled: false,
      multimodal_fallback_provider_id: null,
      multimodal_fallback_model_id: null,
    };
  });

  it('renders the fallback vision model in the default model page', () => {
    render(<DefaultModelSettings />);

    expect(screen.getByText('Fallback vision model')).toBeInTheDocument();
    expect(screen.getByText('When the current model cannot inspect images, use a vision-capable helper model first.')).toBeInTheDocument();
  });

  it('saves fallback vision model selection from the default model page', () => {
    render(<DefaultModelSettings />);

    fireEvent.change(screen.getByLabelText('Select a vision-capable model'), {
      target: { value: 'provider-vision::MiniMax-VL-01' },
    });

    expect(mocks.saveSettings).toHaveBeenCalledWith({
      multimodal_fallback_provider_id: 'provider-vision',
      multimodal_fallback_model_id: 'MiniMax-VL-01',
      multimodal_fallback_enabled: true,
    });
  });
});
