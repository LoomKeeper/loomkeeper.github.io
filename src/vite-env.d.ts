/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_GATEWAY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
