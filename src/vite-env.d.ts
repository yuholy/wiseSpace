/// <reference types="vite/client" />

declare const __APP_REPO_URL__: string;
declare const __APP_REPO_HOST_LABEL__: string;
declare const __APP_REPO_IS_GITHUB__: boolean;

declare namespace JSX {
  interface IntrinsicElements {
    'emoji-picker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}
