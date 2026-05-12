# Translation Guide

Thanks for helping translate the docs — contributions are highly appreciated! This guide describes the recommended workflow for translating English docs to other languages (we currently offer `zh` Chinese translations).

## Basic workflow

1. Copy an English page from `docs/guide/` into `docs/zh/guide/` and keep the same filename.
2. Translate the content while preserving code blocks, front-matter (if present), and internal links (use `/zh/` prefix for links to other zh pages).
3. Run local docs dev or build to test:

```bash
pnpm docs:dev
# or
pnpm docs:build
```

4. Open a PR. Tag it with `docs` and optionally `i18n`.

## Link handling

- Update internal docs links to `zh` variants when pointing to translated pages. For example:

  - English: `[Quick Start](/guide/quick-start)`
  - Chinese: `[快速开始](/zh/guide/quick-start)`

- Keep external links unchanged (unchanged URLs or GitHub links).

## Style & tone

- Keep technical terms — prefer consistent translations for technical terms (`Monaco`, `Mermaid`, `KaTeX`, etc.). If unsure, keep the English term and add explanatory parentheses.
- For code examples, do not change syntax; only translate surrounding text.

## Check the site locally

- Run `pnpm docs:dev` and choose the language at the top-right language selector.
- Check navigation and whether the sidebar shows the translated pages.

## Checklist for PR authors

- [ ] Pages placed under `docs/zh/guide/` with matching filenames
- [ ] Links to other docs updated to `zh` version where appropriate
- [ ] `pnpm docs:build` completes with no errors
- [ ] Add a short PR description noting language and scope of changes

If you'd like me to add a GitHub Action that automatically checks PRs for missing translations or broken links, I can add that as a follow-up. Thank you for contributing translations!

Try this — validate your local docs translation build:

```bash
pnpm docs:dev
# switch to /zh/ using the language selector and confirm pages render
```
