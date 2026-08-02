/// <reference types="vite/client" />

declare const __PIVOT_DATA_REVISION__: string

interface ImportMetaEnv {
  /** Optional same-origin coaching bridge; absent means built-in private coaching. */
  readonly VITE_STAR67_COACH_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*?url' {
  const url: string
  export default url
}
