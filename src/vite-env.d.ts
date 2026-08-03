/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_GATEWAY?: string
  readonly VITE_STATSIG_CLIENT_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
