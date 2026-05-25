import { App } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExtensionsSettings from '../ExtensionsSettings';

const loadExtensions = vi.fn();
const loadExtensionDetail = vi.fn();
const refreshExtensionRuntime = vi.fn();
const testExtensionConnection = vi.fn();
const setExtensionEnabled = vi.fn();
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
      runtime: { hostKind: 'native_skill_loader', isolation: 'in_process', supportsConnectionTest: false, supportsEnableToggle: true },
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
      runtime: { hostKind: 'mcp_host', isolation: 'subprocess', supportsConnectionTest: true, supportsEnableToggle: true },
      contributions: [{ id: 'c2', type: 'tool_provider', name: 'Docs MCP' }],
      tags: [],
    },
  ],
  detailsById: {
    'skill::lint': {
      id: 'skill::lint',
      kind: 'skill',
      name: 'Lint Helper',
      enabled: true,
      source: { kind: 'builtin', path: '/skills/lint' },
      health: { status: 'healthy', summary: 'Skill ready' },
      scope: { availability: 'workspace_attachable' },
      permissions: { trustLevel: 'safe', approvalMode: 'inherit' },
      runtime: { hostKind: 'native_skill_loader', isolation: 'in_process', supportsConnectionTest: false, supportsEnableToggle: true },
      contributions: [{ id: 'c1', type: 'prompt_skill', name: 'Lint Helper' }],
      tags: [],
      diagnostics: { compatibilityNotes: ['Runs inside the native skill host.'] },
      kindDetail: { group: 'quality' },
    },
  },
  connectionChecksById: {
    'mcp_server::srv-1': {
      ok: true,
      message: 'Connection test succeeded.',
      checkedAt: Date.now(),
    },
  },
  testingById: {},
  togglingById: {},
  refreshingById: {},
  loading: false,
  error: null as string | null,
  loadExtensions,
  loadExtensionDetail,
  refreshExtensionRuntime,
  testExtensionConnection,
  setExtensionEnabled,
  clearError,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: {
      language: 'en-US',
      resolvedLanguage: 'en-US',
    },
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

    const buttons = screen.getAllByRole('button', { name: 'Open corresponding settings' });
    fireEvent.click(buttons[1]);

    expect(setActivePage).toHaveBeenCalledWith('settings');
    expect(setSettingsSection).toHaveBeenCalledWith('mcpServers');
  });

  it('opens runtime detail modal for an extension', () => {
    render(
      <App>
        <ExtensionsSettings />
      </App>,
    );

    const detailButtons = screen.getAllByRole('button', { name: 'View runtime detail' });
    fireEvent.click(detailButtons[0]);

    expect(screen.getByText('Extension runtime detail')).toBeInTheDocument();
    expect(screen.getAllByText('native_skill_loader').length).toBeGreaterThan(0);
    expect(screen.getAllByText('in_process').length).toBeGreaterThan(0);
  });

  it('refreshes runtime state from the detail modal', () => {
    render(
      <App>
        <ExtensionsSettings />
      </App>,
    );

    const detailButtons = screen.getAllByRole('button', { name: 'View runtime detail' });
    fireEvent.click(detailButtons[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Refresh runtime' })[0]);

    expect(refreshExtensionRuntime).toHaveBeenCalledWith('skill::lint');
  });

  it('shows test connection action for runtime hosts that support it', () => {
    render(
      <App>
        <ExtensionsSettings />
      </App>,
    );

    expect(screen.getByText('Last connection test: reachable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeInTheDocument();
  });

  it('toggles extension enabled state from the overview list', () => {
    render(
      <App>
        <ExtensionsSettings />
      </App>,
    );

    const disableButtons = screen.getAllByRole('button', { name: 'Disable' });
    fireEvent.click(disableButtons[0]);

    expect(setExtensionEnabled).toHaveBeenCalledWith('skill::lint', false);
  });
});
