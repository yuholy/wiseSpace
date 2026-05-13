import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import monacoEditorPluginModule from "vite-plugin-monaco-editor";
import { execSync } from "child_process";
import path from "path";

const monacoEditorPlugin = (monacoEditorPluginModule as any).default || monacoEditorPluginModule;

const host = process.env.TAURI_DEV_HOST;

function getGitRemoteUrl(): string {
  try {
    return execSync("git config --get remote.origin.url", {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "https://github.com/yuholy/wiseSpace";
  }
}

function normalizeRemoteUrl(remote: string): string {
  const trimmed = remote.trim();
  if (!trimmed) return "https://github.com/yuholy/wiseSpace";

  const scpLike = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (scpLike) {
    return `https://${scpLike[1]}/${scpLike[2]}`;
  }

  const sshLike = trimmed.match(/^ssh:\/\/git@([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshLike) {
    return `https://${sshLike[1]}/${sshLike[2]}`;
  }

  if (/^https?:\/\//.test(trimmed)) {
    return trimmed.replace(/\.git$/, "");
  }

  return trimmed;
}

function getRepoHostLabel(repoUrl: string): string {
  try {
    const hostName = new URL(repoUrl).hostname.toLowerCase();
    const labels: Record<string, string> = {
      "github.com": "GitHub",
      "gitcode.com": "GitCode",
      "gitlab.com": "GitLab",
      "gitee.com": "Gitee",
      "bitbucket.org": "Bitbucket",
    };
    return labels[hostName] ?? hostName;
  } catch {
    return "Repository";
  }
}

const repoUrl = normalizeRemoteUrl(getGitRemoteUrl());
const repoHostLabel = getRepoHostLabel(repoUrl);
const repoIsGithub = (() => {
  try {
    return new URL(repoUrl).hostname.toLowerCase() === "github.com";
  } catch {
    return false;
  }
})();

// Only bundle commonly-used Shiki language grammars (saves ~8 MB in build).
// Languages not listed here will gracefully degrade (no syntax highlighting).
const SHIKI_ALLOWED_LANGS = new Set([
  "angular-html", "angular-ts", "astro", "bash", "c", "cpp", "csharp",
  "css", "dart", "dockerfile", "go", "graphql", "html", "html-derivative",
  "java", "javascript", "json", "json5", "jsonc", "jsx", "kotlin", "less",
  "lua", "markdown", "mdc", "mdx", "objective-c", "objective-cpp", "php",
  "python", "ruby", "rust", "sass", "scss", "shell", "shellscript",
  "sql", "svelte", "swift", "toml", "tsx", "typescript", "vue",
  "vue-html", "xml", "yaml",
]);

function shikiLanguageFilter(): Plugin {
  return {
    name: "shiki-language-filter",
    enforce: "pre",
    resolveId(id) {
      const m = id.match(/^@shikijs\/langs\/(.+)$/);
      if (m && !SHIKI_ALLOWED_LANGS.has(m[1])) {
        return "\0shiki-lang-noop";
      }
      return null;
    },
    load(id) {
      if (id === "\0shiki-lang-noop") {
        return "export default []";
      }
      return null;
    },
  };
}

export default defineConfig(async () => ({
  define: {
    __APP_REPO_URL__: JSON.stringify(repoUrl),
    __APP_REPO_HOST_LABEL__: JSON.stringify(repoHostLabel),
    __APP_REPO_IS_GITHUB__: JSON.stringify(repoIsGithub),
  },
  plugins: [react(), tailwindcss(), monacoEditorPlugin({}), shikiLanguageFilter()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: /^markstream-react\/index\.css$/,
        replacement: path.resolve(__dirname, "./libs/markstream-vue/packages/markstream-react/dist/index.css"),
      },
      {
        find: /^markstream-react$/,
        replacement: path.resolve(__dirname, "./libs/markstream-vue/packages/markstream-react/dist/index.js"),
      },
      {
        find: /^stream-monaco$/,
        replacement: path.resolve(__dirname, "./libs/stream-monaco/dist/index.js"),
      },
      {
        find: /^stream-markdown-parser$/,
        replacement: path.resolve(__dirname, "./libs/markstream-vue/packages/markdown-parser/dist/index.js"),
      },
    ],
  },
  clearScreen: false,
  server: {
    port: 1430,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1431 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
}));
