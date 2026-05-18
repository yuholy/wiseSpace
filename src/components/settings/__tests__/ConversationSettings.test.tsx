import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@/types';
import { ConversationSettings } from '../ConversationSettings';

const mocks = vi.hoisted(() => ({
  saveSettings: vi.fn(),
}));

let settings: Partial<AppSettings> = {};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const labels: Record<string, string> = {
        'settings.additionalFeatures': 'Additional Features',
        'settings.chatMinimap': 'Chat Navigation',
        'settings.showImageModelsInModelSelector': 'Show image models in model selector',
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
    Divider: () => <hr />,
    Input,
    Switch: ({
      checked,
      onChange,
    }: {
      checked?: boolean;
      onChange?: (checked: boolean) => void;
    }) => (
      <button
        aria-checked={checked}
        role="switch"
        type="button"
        onClick={() => onChange?.(!checked)}
      />
    ),
    theme: {
      useToken: () => ({
        token: {
          colorTextDescription: '#666666',
        },
      }),
    },
  };
});

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

vi.mock('../SettingsSelect', () => ({
  SettingsSelect: ({
    value,
    onChange,
    options,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    options: Array<{ label: React.ReactNode; value: string }>;
  }) => (
    <select value={value} onChange={(e) => onChange?.(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {String(option.label)}
        </option>
      ))}
    </select>
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
}));

describe('ConversationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings = {
      bubble_style: 'minimal',
      chat_minimap_enabled: false,
      chat_minimap_style: 'faq',
      default_system_prompt: null,
      multi_model_display_mode: 'tabs',
      render_user_markdown: false,
      show_image_models_in_model_selector: false,
    };
  });

  it('renders the additional features group below chat navigation', () => {
    render(<ConversationSettings />);

    const text = document.body.textContent ?? '';
    expect(text.indexOf('Chat Navigation')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('Additional Features')).toBeGreaterThan(text.indexOf('Chat Navigation'));
    expect(screen.getByText('Show image models in model selector')).toBeInTheDocument();
  });

  it('saves the image-model selector setting when toggled', () => {
    render(<ConversationSettings />);

    const toggles = screen.getAllByRole('switch');
    const toggle = toggles[toggles.length - 1];

    fireEvent.click(toggle);

    expect(mocks.saveSettings).toHaveBeenCalledWith({
      show_image_models_in_model_selector: true,
    });
  });

  it('saves the disabled image-model selector setting when toggled off', () => {
    settings = {
      ...settings,
      show_image_models_in_model_selector: true,
    };

    render(<ConversationSettings />);

    const toggles = screen.getAllByRole('switch');
    const toggle = toggles[toggles.length - 1];

    fireEvent.click(toggle);

    expect(mocks.saveSettings).toHaveBeenCalledWith({
      show_image_models_in_model_selector: false,
    });
  });
});
