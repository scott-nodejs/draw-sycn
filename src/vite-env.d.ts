/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RECORDING_STORAGE?: 'local' | 'http' | 'qiniu'
  readonly VITE_RECORDING_API_BASE_URL?: string
  readonly VITE_TLDRAW_SYNC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
