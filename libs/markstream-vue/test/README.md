# Tests — helpers & midstate probes

This short guide explains how to run the mid-typing (midstate) tests and regenerate parser probe output used by the test suite.

Why
- Mid-typing tests exercise the parser's provisional states (unclosed fences, loading links, emoji shortcodes, etc.).
- When Vitest output is not fully available (CI or remote tooling), the probe script writes `test/probes/parse-output.json` so you can inspect the AST node shapes and tune tolerant assertions.

Common commands (zsh / macOS)

# Run the full test suite (CI mode):
CI=1 pnpm test

# Run only the midstate test file (verbose):
CI=1 pnpm vitest run test/markdown-midstates.test.ts --reporter verbose

# Run a named block/describe using grep (fast):
pnpm vitest -t 'additional mid-state edge cases' --reporter verbose

# Regenerate the probe JSON (writes to test/probes/parse-output.json):
node test/probes/parse-probe-write-tmp.cjs

# Inspect the probe output (first 200 lines):
# macOS / zsh
sed -n '1,200p' test/probes/parse-output.json

Test helper notes
- Use `test/utils/midstate-utils.ts` helpers instead of brittle JSON.stringify checks:
  - `textIncludes(nodes, stringOrRegExp)` — safe recursive search (supports RegExp and raw strings)
  - `collect(nodes, type)` — gather all nodes of a given type from an AST
  - `hasLoadingLink(nodes)` and `links(nodes)` — helpers for link mid-states
- Tests are intentionally tolerant: they prefer structured nodes when present but accept plain text fallback (useful when optional plugins are disabled).

If you see a failing midstate test:
1. Run the probe script to capture the parse AST for the failing input.
2. Inspect `test/probes/parse-output.json` to see exactly which node fields exist (e.g. `text`, `raw`, `children`, `loading`).
3. Adjust assertions to use `textIncludes(...)` or `collect(...)` to be tolerant of AST variations.

If you'd like, I can:
- Sweep tests for remaining fragile patterns and replace them conservatively in small batches (I already fixed the most obvious cases).
- Add stricter/gated assertions behind an env var if you want deterministic enforcement in CI.
