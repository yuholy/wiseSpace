# Monorepo Migration Guide

## Overview

The markdown parsing utilities have been extracted into a separate package `stream-markdown-parser` to enable framework-agnostic usage.

## Package Structure

```
markstream-vue/
├── packages/
│   └── markdown-parser/          # stream-markdown-parser
│       ├── src/
│       │   ├── index.ts          # Main entry
│       │   ├── config.ts         # Math options config
│       │   ├── types.ts          # TypeScript types
│       │   ├── parser/           # Core parsing logic
│       │   ├── plugins/          # Markdown-it plugins
│       │   │   └── math.ts       # Math plugin
│       │   └── renderers/        # Custom renderers
│       ├── dist/                 # Built files
│       ├── package.json
│       ├── tsconfig.json
│       └── tsup.config.ts
├── src/                          # Main Vue package
│   ├── components/
│   ├── utils/
│   └── exports.ts
└── playground/
```

## Changes

### 1. New Package: `stream-markdown-parser`

- **Pure JavaScript/TypeScript** - No Vue dependencies
- **Framework agnostic** - Can be used in any JS project
- **Single entry point** - All exports from main index
- **Exports**: Everything from `stream-markdown-parser`

### 2. Updated Main Package

The main `markstream-vue` package now depends on `stream-markdown-parser`:

```json
{
  "dependencies": {
    "stream-markdown-parser": "workspace:*"
  }
}
```

### 3. Import Changes

**Before:**
```typescript
import { getMarkdown, parseMarkdownToStructure, setDefaultMathOptions } from 'markstream-vue'
```

**After (same for consumers):**
```typescript
import { getMarkdown, parseMarkdownToStructure, setDefaultMathOptions } from 'markstream-vue'
```

The API remains the same for end users! The change is internal.

**For parser-only usage:**
```typescript
import {
  getMarkdown,
  KATEX_COMMANDS,
  normalizeStandaloneBackslashT,
  parseMarkdownToStructure,
  setDefaultMathOptions
} from 'stream-markdown-parser'

// All exports are from the main entry point
```

## Development

### Install Dependencies

```bash
pnpm install
```

### Build Parser Package

```bash
cd packages/markdown-parser
pnpm build
```

### Build Main Package

```bash
cd ../..
pnpm build
```

### Run Tests

```bash
# Test all packages
pnpm test

# Test parser only
cd packages/markdown-parser
pnpm test
```

## Publishing

### Publish Parser Package

```bash
cd packages/markdown-parser
pnpm build
npm publish
```

### Publish Main Package

```bash
cd ../..
pnpm build
npm publish
```

## Benefits

1. **Reusability**: The parser can be used in non-Vue projects
2. **Smaller bundles**: Projects that only need parsing don't need Vue
3. **Better separation**: Clear boundary between parsing and rendering
4. **Independent versioning**: Parser and Vue components can version separately
5. **Easier testing**: Parser logic can be tested in isolation

## Migration for Internal Code

If you're working on the codebase:

**Old:**
```typescript
import type { ParsedNode } from './utils/markdown/types'
import { getMarkdown } from './utils/markdown'
```

**New:**
```typescript
import type { ParsedNode } from 'stream-markdown-parser'
import { getMarkdown } from 'stream-markdown-parser'
```

## Future Plans

- Add more parser utilities
- Support for custom node types in parser
- Streaming parser improvements
- Performance optimizations
