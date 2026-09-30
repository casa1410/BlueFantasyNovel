/// <reference types="vite/client" />
import type { BlueFantasyApi } from '@shared/api'

declare global {
  interface Window {
    /** Puente hacia el proceso principal. Definido en src/preload/index.ts. */
    api: BlueFantasyApi
  }
}

export {}
