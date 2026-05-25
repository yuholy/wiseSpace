# Unified Extension Model Schema Draft

> Last updated: 2026-05-24

## Purpose

This document turns the extension-model audit into a first-pass schema draft.
The goal is not to replace Skills, MCP, or External Agents immediately. The
goal is to define a shared host model that can describe them consistently in
frontend types, backend responses, and future workspace attachment flows.

## Design Principles

- preserve existing runtime implementations in the short term
- add one shared summary model before adding one shared runtime
- keep workspace attachment explicit
- keep permissions and health visible in the host model
- allow adapters for existing systems instead of a flag day rewrite

## Core Host Types

### `ExtensionKind`

The top-level extension kind identifies the primary host category.

```ts
type ExtensionKind =
  | 'skill'
  | 'mcp_server'
  | 'external_agent'
  | 'tool_bundle'
  | 'ui_panel';
```

### `ExtensionSourceKind`

The source kind identifies where the extension came from.

```ts
type ExtensionSourceKind =
  | 'builtin'
  | 'marketplace'
  | 'local'
  | 'project'
  | 'remote_connector'
  | 'imported';
```

### `ExtensionHealth`

The health model gives the host UI one common status summary.

```ts
type ExtensionHealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

interface ExtensionHealth {
  status: ExtensionHealthStatus;
  summary?: string | null;
  checkedAt?: string | null;
}
```

### `ExtensionScope`

The scope model defines where the extension can be attached.

```ts
type ExtensionAvailability =
  | 'global_only'
  | 'workspace_attachable'
  | 'conversation_override';

interface ExtensionScope {
  availability: ExtensionAvailability;
  attachedWorkspaceIds?: string[];
  defaultEnabled?: boolean;
}
```

### `ExtensionPermissionProfile`

The permission model gives the host one shared language for trust and approval.

```ts
type ExtensionTrustLevel = 'safe' | 'elevated' | 'networked' | 'privileged';
type ExtensionApprovalMode = 'inherit' | 'ask' | 'allow_safe' | 'allow_all';

interface ExtensionPermissionProfile {
  trustLevel: ExtensionTrustLevel;
  approvalMode: ExtensionApprovalMode;
  requiresFilesystemAccess?: boolean;
  requiresNetworkAccess?: boolean;
  requiresSecrets?: boolean;
}
```

## Shared Summary Type

This should be the first common frontend and backend shape.

```ts
interface ExtensionSummary {
  id: string;
  kind: ExtensionKind;
  name: string;
  description?: string | null;
  version?: string | null;
  enabled: boolean;
  source: {
    kind: ExtensionSourceKind;
    label?: string | null;
    path?: string | null;
    ref?: string | null;
  };
  health: ExtensionHealth;
  scope: ExtensionScope;
  permissions: ExtensionPermissionProfile;
  contributions: ExtensionContributionSummary[];
  tags?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
}
```

## Contribution Types

Each extension can contribute one or more capability blocks.

```ts
type ExtensionContributionType =
  | 'prompt_skill'
  | 'tool_provider'
  | 'connector'
  | 'task_executor'
  | 'ui_surface';
```

```ts
interface ExtensionContributionSummary {
  id: string;
  type: ExtensionContributionType;
  name: string;
  description?: string | null;
  userInvocable?: boolean;
  runtimeLabel?: string | null;
}
```

## Specialized Contribution Metadata

The shared summary should stay lightweight. Detail pages can use
kind-specific metadata blocks.

```ts
interface SkillContributionDetail {
  argumentHint?: string;
  whenToUse?: string;
  group?: string;
}

interface McpContributionDetail {
  transport?: 'stdio' | 'http' | 'sse';
  toolCount?: number;
  permissionPolicy?: 'ask' | 'allow_safe' | 'allow_all';
}

interface ExternalAgentContributionDetail {
  agentKind?: string;
  capabilityNames?: string[];
  baseUrl?: string | null;
}
```

## Detail Type

The detail shape can extend the shared summary without collapsing all runtime
models into one object.

```ts
interface ExtensionDetail extends ExtensionSummary {
  manifest?: Record<string, unknown> | null;
  diagnostics?: {
    canTestConnection?: boolean;
    canCheckUpdates?: boolean;
    lastError?: string | null;
  };
  kindDetail?:
    | SkillContributionDetail
    | McpContributionDetail
    | ExternalAgentContributionDetail
    | Record<string, unknown>;
}
```

## First-Pass Mapping Rules

### Skills -> ExtensionSummary

Current source:

- `src/types/index.ts`
- `src-tauri/src/commands/skills.rs`

Suggested mapping:

- `kind`: `skill`
- `source.kind`: derived from `Skill.source`
- `permissions.approvalMode`: `inherit`
- `contributions`: one `prompt_skill`
- `scope.availability`: `workspace_attachable`

### MCP Servers -> ExtensionSummary

Current source:

- `src/types/mcp.ts`
- `src-tauri/src/commands/mcp.rs`

Suggested mapping:

- `kind`: `mcp_server`
- `permissions.approvalMode`: map from `permissionPolicy`
- `permissions.requiresNetworkAccess`: true for `http` / `sse`
- `contributions`: one `tool_provider`
- `scope.availability`: `workspace_attachable`

### External Agents -> ExtensionSummary

Current source:

- `src/types/externalAgent.ts`
- `src-tauri/src/commands/external_agents.rs`

Suggested mapping:

- `kind`: `external_agent`
- `source.kind`: `remote_connector`
- `permissions.requiresNetworkAccess`: true
- `contributions`: one `task_executor` and optionally one `connector`
- `scope.availability`: `workspace_attachable`

## Rust-Side Response Shape

The backend does not need to persist a new unified table first. The first step
can be an aggregation command that returns:

```rust
pub struct ExtensionSummaryDto {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub enabled: bool,
    pub source: ExtensionSourceDto,
    pub health: ExtensionHealthDto,
    pub scope: ExtensionScopeDto,
    pub permissions: ExtensionPermissionProfileDto,
    pub contributions: Vec<ExtensionContributionSummaryDto>,
    pub tags: Vec<String>,
}
```

This keeps the first implementation additive and low risk.

## Frontend Type Placement

Recommended next file layout:

- `src/types/extension.ts`
- re-export from `src/types/index.ts`

That keeps the host model separate from `mcp.ts` and `externalAgent.ts` while
still allowing those modules to keep their runtime-specific detail types.

## First Backend Command Surface

The first unified command surface can stay intentionally small:

- `list_extensions() -> Vec<ExtensionSummaryDto>`
- `get_extension_detail(id: String) -> ExtensionDetailDto`
- `set_extension_enabled(id: String, enabled: bool) -> ExtensionSummaryDto`

These commands can be adapters over existing Skills, MCP, and External Agent
commands during the first phase.

## Non-Goals for This Draft

- workspace-scoped persistence for every extension kind
- a final on-disk plugin manifest format
- replacing existing MCP or Skills command surfaces immediately
- full compatibility rules for third-party UI panels

## Immediate Implementation Follow-Up

After this schema draft, the next practical step should be:

1. add `src/types/extension.ts`
2. add Rust-side DTOs for unified extension summaries
3. implement a read-only `list_extensions` aggregator command

## References

- `docs/planning/extension-model-audit.md`
- `src/types/index.ts`
- `src/types/mcp.ts`
- `src/types/externalAgent.ts`
- `src-tauri/src/commands/skills.rs`
- `src-tauri/src/commands/mcp.rs`
- `src-tauri/src/commands/external_agents.rs`
