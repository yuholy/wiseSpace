import { App } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExtensionsSettings from '../ExtensionsSettings';

const loadExtensions = vi.fn();
const clearError = vi.fn();
const setActivePage = vi.fn();
const setSettingsSection = vi.fn();

let extensionState = {
  extensions: [
    {
      id: 'skill::lint',
      kind: 'skill',
      name: 'Lint Helper',
      description: 'Example skill',
      enabled: true,
      source: { kind: 'builtin' },
      health: { status: 'healthy', summary: 'Skill ready' },
      scope: { availability: 'workspace_attachable' },
      permissions: { trustLevel: 'safe', approvalMode: 'inherit' },
      contributions: [{ id: 'c1', type: 'prompt_skill', name: 'Lint Helper' }],
      tags: [],
    },
    {
      id: 'mcp_server::srv-1',
      kind: 'mcp_server',
      name: 'Docs MCP',
      description: 'Example MCP',
      enabled: true,
      source: { kind: 'local' },
      health: { status: 'warning', summary: 'Disabled in workspace' },
      scope: { availability: 'workspace_attachable' },
      permissions: { trustLevel: 'networked', approvalMode: 'ask' },
      contributions: [{ id: 'c2', type: 'tool_provider', name: 'Docs MCP' }],
      tags: [],
    },
  ],
  loading: false,
  error: null as string | null,
  loadExtensions,
  clearError,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/stores', () => ({
  useExtensionStore: (selector?: (state: typeof extensionState) => unknown) =>
    selector ? selector(extensionState) : extensionState,
  useUIStore: (selector: (state: { setActivePage: typeof setActivePage; setSettingsSection: typeof setSettingsSection }) => unknown) =>
    selector({ setActivePage, setSettingsSection }),
}));

describe('ExtensionsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders unified extension summary cards', () => {
    render(
      <App>
        <ExtensionsSettings />
      </App>,
    );

    expect(screen.getByText('Extensions')).toBeInTheDocument();
    expect(screen.getByText('Lint Helper')).toBeInTheDocument();
    expect(screen.getByText('Docs MCP')).toBeInTheDocument();
  });

  it('navigates to source settings for MCP items', () => {
    render(
      <App>
        <ExtensionsSettings />
      </App>,
    );

    const buttons = screen.getAllByRole('button', { name: 'Open source settings' });
    fireEvent.click(buttons[1]);

    expect(setActivePage).toHaveBeenCalledWith('settings');
    expect(setSettingsSection).toHaveBeenCalledWith('mcpServers');
  });
});
