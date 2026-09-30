/**
 * Proceso principal de Electron: crea la ventana, prepara la biblioteca de
 * proyectos y registra los manejadores IPC.
 */
import path from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { IPC } from '@shared/api'
import { registerAssetProtocol, registerAssetSchemePrivileges } from './assets'
import { BackupService } from './backup'
import { registerIpcHandlers } from './ipc'
import { SettingsStore } from './settings'
import { ProjectRepository } from './storage/ProjectRepository'

/** Nombre de la carpeta de datos dentro de "Documentos". */
const LIBRARY_FOLDER_NAME = 'BlueFantasyNovel'

/** Color de fondo mientras carga la interfaz (evita un destello blanco). */
const WINDOW_BACKGROUND = '#0b1224'

const isDev = !app.isPackaged

// Debe registrarse antes de que la app esté lista.
registerAssetSchemePrivileges()

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'BlueFantasyNovel',
    backgroundColor: WINDOW_BACKGROUND,
    autoHideMenuBar: true,
    // En la versión instalada, Windows usa el icono del .exe; en desarrollo lo indicamos aquí.
    ...(isDev && { icon: path.join(__dirname, '../../build/icon.png') }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      // Aislamiento completo: la interfaz no puede usar Node directamente.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  })

  window.webContents.session.setSpellCheckerLanguages(['es-ES'])
  window.once('ready-to-show', () => window.show())
  guardCloseUntilSaved(window)

  // Los enlaces externos se abren en el navegador, nunca dentro de la app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault()
  })

  // En desarrollo, electron-vite sirve la interfaz con recarga en caliente.
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return window
}

/** Tiempo máximo que esperamos a la interfaz antes de cerrar igualmente. */
const CLOSE_TIMEOUT_MS = 4000

/**
 * Al cerrar la ventana, primero se pide a la interfaz que guarde lo que tenga
 * pendiente (el autoguardado espera ~1 s tras la última tecla). Cuando
 * responde, o si tarda demasiado, se cierra de verdad.
 */
function guardCloseUntilSaved(window: BrowserWindow): void {
  let readyToClose = false
  let closeRequested = false

  window.on('close', (event) => {
    if (readyToClose) return
    event.preventDefault()
    if (closeRequested) return // ya estamos esperando a la interfaz
    closeRequested = true

    const closeNow = () => {
      if (readyToClose) return
      readyToClose = true
      ipcMain.removeListener(IPC.appCloseReady, onReady)
      if (!window.isDestroyed()) window.close()
    }
    const onReady = (e: Electron.IpcMainEvent) => {
      if (e.sender === window.webContents) closeNow()
    }

    ipcMain.on(IPC.appCloseReady, onReady)
    setTimeout(closeNow, CLOSE_TIMEOUT_MS)
    window.webContents.send(IPC.appCloseRequested)
  })
}

app.whenReady().then(() => {
  if (!isDev) Menu.setApplicationMenu(null)

  const libraryRoot = path.join(app.getPath('documents'), LIBRARY_FOLDER_NAME)
  const settings = new SettingsStore(app.getPath('userData'))
  // Borrar (o sustituir al restaurar) envía a la Papelera: se puede recuperar.
  backups = new BackupService(libraryRoot, settings, (dir) => shell.trashItem(dir))
  const repository = new ProjectRepository({
    libraryRoot,
    removeDirectory: (dir) => shell.trashItem(dir),
    onChange: () => backups?.markDirty()
  })
  registerIpcHandlers(repository, settings, backups)
  registerAssetProtocol(repository)

  createMainWindow()
  // Copia de seguridad diaria (si está activada), sin retrasar el arranque.
  setTimeout(() => void backups?.runOnStartup(), 5000)

  // macOS: reabrir la ventana al pulsar el icono del dock.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

let backups: BackupService | null = null

// Al cerrar la última ventana: copia de seguridad (si hubo cambios) y salir.
// La ventana ya no se ve, así que el usuario no espera.
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  void (backups?.runOnQuit() ?? Promise.resolve()).finally(() => app.quit())
})
