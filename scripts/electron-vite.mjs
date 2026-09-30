/**
 * Lanzador de electron-vite.
 *
 * Algunos entornos (extensiones de VS Code, otras apps Electron) definen
 * ELECTRON_RUN_AS_NODE=1. Con esa variable Electron arranca como Node puro y
 * la aplicación falla con "Cannot find module 'electron'". Este script la
 * elimina y después ejecuta electron-vite con los mismos argumentos.
 *
 * Uso (desde package.json): node scripts/electron-vite.mjs dev
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const cli = path.join(path.dirname(require.resolve('electron-vite/package.json')), 'bin', 'electron-vite.js')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))
