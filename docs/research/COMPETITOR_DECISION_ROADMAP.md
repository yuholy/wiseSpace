# wiseSpace Competitor Decision Roadmap

> This document turns the broader competitor research into a decision-oriented
> roadmap for wiseSpace itself.
>
> Related input:
> - `docs/research/COMPETITOR_ANALYSIS.md`
> - `docs/project/ARCHITECTURE.md`
> - `docs/agent/local-agent-first-roadmap.md`
>
> Decision date: 2026-05-23

---

## 1. Executive Summary

The competitor research is useful, but wiseSpace should not copy the visible
surface area of OpenAkita, Proma, or OpenHanako feature-by-feature.

wiseSpace already has a stronger local systems foundation than most similar
projects:

- Tauri + Rust backend
- SQLite + vector store
- local-first storage with explicit path policy
- built-in Gateway
- knowledge, memory, MCP, skills, backup, and agent runtime infrastructure

The current problem is not "missing enough features".

The current problem is that the product still needs a clearer operational axis:

1. `workspace` should become the first-class container
2. `agent execution` should become the first-class action model
3. `skills / MCP / tools / connectors` should converge into one extension model

This means wiseSpace should **not** make multi-agent orchestration the next
major priority. Multi-agent becomes much more valuable only after workspace and
extension boundaries are cleaner.

---

## 2. What We Should Borrow

### 2.1 From OpenAkita

Borrow:

- declarative plugin manifest design
- explicit security layering
- extension lifecycle thinking
- health checks and fault isolation for extensions

Do not borrow first:

- "AI company" / organization theater
- wide IM platform expansion as a core near-term priority
- very broad persona and proactive surface area

### 2.2 From Proma

Borrow:

- clear `Chat` vs `Agent` mental model
- workspace-scoped context model
- lightweight "coach" guidance that teaches users how to use the product well

Do not borrow first:

- file-first storage in place of SQLite
- deep dependence on a single agent SDK shape

### 2.3 From OpenHanako

Borrow:

- workspace as a strong organizing primitive
- plugin runtime / protocol / UI host separation
- better asynchronous collaboration space around the agent
- stronger contract tests around sandbox, workspace, and plugins

Do not borrow first:

- large personality system
- broad bridge / PWA / multi-endpoint expansion

---

## 3. Revised Priority Order

This is the recommended priority order for wiseSpace after competitor review.

### P0: Product Axis Cleanup

These should happen before major multi-agent investment.

#### P0.1 Workspace First

Goal:

- make workspace the primary container for ongoing work

What should converge around workspace:

- conversations
- agent runs
- files and attachments
- skills
- MCP configuration
- knowledge attachment context
- memory retrieval context

Expected outcome:

- wiseSpace feels like a coherent workbench instead of several powerful but
  parallel pages

#### P0.2 Chat vs Agent Boundary

Goal:

- make it obvious when the user is asking for a response versus asking for
  execution

What this should change:

- clearer mode labeling in UI
- clearer approval semantics
- clearer task-center semantics
- clearer conversation rendering for agent lifecycle events

Expected outcome:

- lower cognitive load
- fewer confusing "why did it run tools?" moments
- better foundation for later delegation and automation

#### P0.3 Security Productization

Goal:

- make existing safety real, visible, and more resilient

Recommended near-term layers:

- path tiering: `workspace / controlled / protected / forbidden`
- command interception for obviously dangerous commands
- pre-write snapshots for file edits
- clearer permission and approval messaging

Expected outcome:

- safer local agent behavior
- more user trust
- better foundation for future plugin execution

---

### P1: Extension Unification

These should happen after the product axis is cleaner.

#### P1.1 Skills to Extensions

Goal:

- evolve the current Skills system into a broader extension model

Initial extension contribution types:

- skill
- MCP bundle
- tool
- external agent connector
- provider adapter
- UI panel or widget

Suggested shape:

```text
extensions/
└── {extension-id}/
    ├── manifest.json
    ├── entry/
    ├── ui/
    └── assets/
```

Why this matters:

- Skills, MCP, tools, and connectors stop feeling like separate worlds
- installation, health checks, permissions, and lifecycle can be unified

#### P1.2 PluginContext and Capability Boundaries

Goal:

- give extensions a single controlled way to access core services

Suggested direction:

```rust
pub struct ExtensionContext {
    pub workspace: WorkspaceHandle,
    pub session: SessionHandle,
    pub file_system: SandboxedFileSystem,
    pub permissions: PermissionSet,
    pub events: EventBus,
}
```

Why this matters:

- fewer direct dependencies
- easier testing
- safer future extension surface

#### P1.3 Workspace Asset Center

Goal:

- evolve Files into the asset center for workspace-driven agent work

This should include:

- current workspace file context
- generated artifacts
- agent outputs
- draft notes / inbox style async collaboration

Expected outcome:

- a more durable loop than pure chat history

---

### P2: Higher-Order Agent Features

These become much more realistic after P0 and P1.

#### P2.1 SubAgent Before Full Multi-Agent

Goal:

- allow limited task delegation before introducing large orchestration systems

Reasoning:

- it captures most of the practical value
- it avoids prematurely building "AI company" abstractions

#### P2.2 Lightweight Coach

Goal:

- teach users how to use workspace, skills, MCP, memory, and backup better

This should be:

- narrow
- practical
- operational

It should not become:

- a vague companion persona
- a second product inside the product

#### P2.3 IM / Remote Bridge

Goal:

- allow selective remote triggering and notification for local workflows

Priority note:

- useful, but not as foundational as workspace and extension cleanup

---

## 4. Why Multi-Agent Is Not First

The competitor analysis correctly identifies that the market is moving from
single-agent operation toward collaboration.

However, for wiseSpace specifically, the next move should not be:

- complex orchestration
- role hierarchies
- large agent pools
- organization simulation

Why:

1. The current product axis is still more page-centric than workspace-centric.
2. Skills, MCP, tools, and connectors are still too separate structurally.
3. Multi-agent amplifies existing architectural ambiguity.
4. A strong single local agent inside a coherent workspace will create more
   real user value sooner.

Recommended sequence:

```text
single local agent with clean workspace model
  -> unified extension model
  -> limited subagent delegation
  -> richer orchestration only when needed
```

---

## 5. Suggested 6-8 Week Execution Plan

### Track A: Workspace

- define a stronger workspace domain model
- map which current entities must become workspace-scoped
- make workspace visible in conversation, task center, files, and agent flows
- standardize workspace-aware context attachment rules

### Track B: Execution Modes

- clarify `Chat` vs `Agent` states in frontend and backend
- align task lifecycle, recovery, and rendering with that distinction
- simplify the primary chat header around the local agent path

### Track C: Safety

- add dangerous command interception
- add write snapshots for controlled file edits
- expose clearer permission tiers in the UI and event stream

### Track D: Extension Foundation

- design a minimal extension manifest
- map current Skills and MCP records into that model
- define an extension health and permission contract

---

## 6. Decision Checklist

Use this checklist before accepting future feature work inspired by competitors.

- Does it strengthen `workspace` as the main container?
- Does it reinforce the `Chat` vs `Agent` execution boundary?
- Does it fit the future extension model?
- Does it leverage wiseSpace's Rust + Gateway advantage?
- Does it reduce user confusion more than it increases surface area?

If the answer is mostly "no", it should not outrank current P0 work.

---

## 7. Final Position

wiseSpace should position itself as:

**a local-first AI workbench with strong system capabilities, workspace-aware
agent execution, and a unified extension surface**

not as:

- a clone of general AI companions
- an "AI company" simulator
- a feature race version of other desktop clients

The most important next step is to improve structural coherence, not feature
breadth.

