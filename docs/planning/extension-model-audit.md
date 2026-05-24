# Unified Extension Model Audit

> Last updated: 2026-05-24

## Why This Exists

wiseSpace already has multiple extension-like systems:

- `skills`
- `MCP` servers and tool descriptors
- `external agents`
- built-in runtime tools
- future UI-level contributions

These systems already solve real problems, but they currently grow through
parallel command surfaces, metadata shapes, lifecycle models, and permission
rules. This document defines the first audit pass for converging them into a
shared extension model.

## Current Systems

### 1. Skills

Current implementation centers on installable skill directories and skill
metadata surfaced through the skills command layer.

Relevant code:

- `src-tauri/src/commands/skills.rs`
- `src/types/index.ts`

Current characteristics:

- global install / uninstall / enable / disable lifecycle
- marketplace-aware metadata
- user-invocable and prompt-guided behavior
- file-backed source identity and update detection

### 2. MCP Servers

Current implementation centers on persisted server records plus runtime tool
resolution.

Relevant code:

- `src-tauri/src/commands/mcp.rs`
- `src/types/mcp.ts`

Current characteristics:

- CRUD lifecycle for server definitions
- runtime connection testing
- tool discovery and tool execution metadata
- separate enablement and approval behavior from skills

### 3. External Agents

Current implementation centers on connector definitions and remote task
dispatch.

Relevant code:

- `src-tauri/src/commands/external_agents.rs`
- `src/types/externalAgent.ts`

Current characteristics:

- connector registration and health testing
- remote task dispatch and task history
- distinct protocol and lifecycle from local skills and MCP

### 4. Built-In Runtime Tools

Built-in tools already exist as part of the local runtime, but they are not
yet modeled as first-class extensions.

Current characteristics:

- runtime-owned instead of user-installed
- no shared manifest with other contribution systems
- permissions are partially surfaced through agent policy rather than a single
  extension registry

### 5. Future UI Contributions

wiseSpace already has a product direction that can benefit from pluggable UI
surfaces, such as inspector sections, workspace panels, or extension-owned
settings pages, but there is no contribution host model yet.

## Shared Dimensions Across All Extension Systems

Any unified extension model should cover the following dimensions:

- identity
- source and install origin
- manifest metadata
- contributed capability types
- enable / disable lifecycle
- workspace attachment scope
- permission and approval policy
- health diagnostics
- compatibility and upgrade state

## Current Gaps

### Parallel Registries

Skills, MCP, and external agents are managed through separate repositories,
commands, and frontend types. This increases product complexity and makes it
harder to explain "what is installed" in one place.

### Inconsistent Metadata Shapes

Each system exposes a different metadata model. That makes it difficult to
build a shared management UI, shared filters, or shared diagnostics.

### Different Scope Models

Workspace-scoped context bindings are now much stronger after `P0`, but the
extension surfaces themselves still do not share one attachment model.

### Different Permission Models

Tool approval, runtime permissions, and connector trust are still expressed
through different concepts. Users can feel these boundaries, but they are not
yet described through one extension policy language.

### No Shared Contribution Schema

There is no common structure for answering:

- what this extension contributes
- where it can run
- what it needs access to
- how it should be enabled, tested, or attached to a workspace

## Target Model

The recommended next step is to introduce an `Extension` host model with
manifest-driven contributions.

### Extension Record

At a high level, each extension should expose:

- stable id
- display name
- source type
- version
- install location
- enabled state
- health state
- workspace attachment capabilities
- declared contributions
- declared permissions

### Contribution Types

The first shared contribution taxonomy can stay intentionally small:

- `skill`
- `mcp_server`
- `tool_bundle`
- `external_agent`
- `ui_panel`

This is enough to unify the host model without forcing all runtime behavior to
be rewritten at once.

### Workspace Attachment

Extensions should be explicit about whether they are:

- globally available
- workspace attachable
- conversation-local override capable

That keeps the new `workspace-first` backbone aligned with extension growth.

### Permission Model

The unified model should declare:

- execution trust level
- tool approval expectations
- filesystem or connector access expectations
- whether the extension is safe by default, inherited from workspace policy,
  or requires explicit approval

## Suggested Manifest Direction

This audit does not define the final manifest schema yet, but the likely shape
should include:

- identity block
- source block
- contribution list
- permission declaration
- compatibility declaration
- workspace attachment declaration
- diagnostics hooks or health capability declaration

## Phased Rollout

### Phase 1. Audit and Draft

- inventory current systems
- define shared vocabulary
- document first manifest direction

### Phase 2. Type and Backend Abstraction

- add shared frontend extension types
- add backend extension summary model
- expose one query surface for installed extensions

### Phase 3. Adapters for Existing Systems

- wrap skills in the shared extension summary
- wrap MCP servers in the shared extension summary
- wrap external agents in the shared extension summary

### Phase 4. Unified Management Surface

- build one extension management view
- support filtering by contribution type, workspace attachment, health, and
  permissions

## Non-Goals for This Stage

- a full plugin marketplace
- runtime sandbox isolation for all extension types
- a complete plugin UI host
- replacing existing Skills or MCP implementations immediately

## Recommended Immediate Follow-Up

The next concrete deliverable after this audit should be a schema draft for:

- shared `ExtensionSummary` frontend type
- shared Rust-side extension summary response shape
- first-pass manifest field mapping for Skills, MCP, and External Agents

## References

- `src/types/index.ts`
- `src-tauri/src/commands/skills.rs`
- `src-tauri/src/commands/mcp.rs`
- `src-tauri/src/commands/external_agents.rs`
- `docs/research/COMPETITOR_DECISION_ROADMAP.md`
