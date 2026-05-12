# wiseSpace branding cleanup scan v0.1.0

This note records the first pass of branding cleanup completed for the `0.1.0` baseline.

Completed:
- Unified app-facing name and version references around `wiseSpace`
- Replaced visible legacy submodule references in [`.gitmodules`](D:/project/yuholy/wiseSpace/.gitmodules)
- Consolidated legacy compatibility paths, deep links, localStorage keys, and display-tag parsing behind dedicated legacy helpers
- Kept legacy migration behavior for older local data while removing scattered direct brand references from source files

Follow-up ideas:
- Continue reviewing third-party vendored or generated artifacts separately if upstream branding needs to be updated there too
- Re-run a repo-wide legacy scan before each tagged release
