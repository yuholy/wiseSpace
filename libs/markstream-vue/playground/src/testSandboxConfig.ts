import type { SandboxFrameworkTarget } from '../../playground-shared/versionSandbox'

export const TEST_SANDBOX_KATEX_VERSION = '0.16.22'
export const TEST_SANDBOX_MERMAID_VERSION = '11'

export const testSandboxFrameworks: ReadonlyArray<SandboxFrameworkTarget> = [
  {
    id: 'vue3',
    label: 'Vue 3',
    packageName: 'markstream-vue',
    defaultVersion: '0.0.9-beta.0',
    runtimeVersion: '3.5.29',
    supportsWorkspace: true,
  },
  {
    id: 'vue2',
    label: 'Vue 2',
    packageName: 'markstream-vue2',
    defaultVersion: '0.0.20',
    runtimeVersion: '2.7.16',
    supportsWorkspace: false,
  },
  {
    id: 'react18',
    label: 'React 18',
    packageName: 'markstream-react',
    defaultVersion: '0.0.25',
    runtimeVersion: '18.3.1',
    supportsWorkspace: false,
  },
  {
    id: 'react19',
    label: 'React 19',
    packageName: 'markstream-react',
    defaultVersion: '0.0.25',
    runtimeVersion: '19.2.4',
    supportsWorkspace: false,
  },
  {
    id: 'angular',
    label: 'Angular',
    packageName: 'markstream-angular',
    defaultVersion: '0.0.1-alpha.0',
    runtimeVersion: '20.3.18',
    supportsWorkspace: true,
  },
] as const

export function getTestSandboxFramework(id: string | null | undefined) {
  return testSandboxFrameworks.find(item => item.id === id) ?? testSandboxFrameworks[0]
}
