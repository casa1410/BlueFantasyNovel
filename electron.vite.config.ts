/**
 * Configuración de compilación (electron-vite).
 *
 * Electron tiene tres "mundos" que se compilan por separado:
 *  - main:     proceso principal (Node.js). Ventanas, disco, diálogos nativos.
 *  - preload:  puente seguro entre main y la interfaz (contextBridge).
 *  - renderer: la interfaz en React que se ve en la ventana.
 *
 * El alias `@shared` apunta a código común (tipos y utilidades puras) que
 * pueden importar los tres procesos.
 */
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: sharedAlias }
  },
  preload: {
    resolve: { alias: sharedAlias }
  },
  renderer: {
    resolve: {
      alias: {
        ...sharedAlias,
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
