/**
 * "Abrir al iniciar Windows". No se guarda en settings.json: el estado real es
 * la entrada de Windows (HKCU\...\Run), así que se lee y se cambia ahí, y
 * siempre coincide con lo que ve el usuario en el Administrador de tareas.
 *
 * Empieza desactivado: Electron no crea la entrada hasta que se activa, y el
 * desinstalador la borra (build/installer.nsh), así que una instalación nueva
 * nunca arranca sola.
 */
import { app } from 'electron'
import type { StartupState } from '@shared/types'

/** Nombre de la entrada en el registro (el desinstalador usa el mismo). */
export const STARTUP_ENTRY = 'BlueFantasyNovel'

/**
 * Programa que debe abrir Windows. En la versión portable, `execPath` es la
 * copia descomprimida en una carpeta temporal, que cambia cada vez: hay que
 * registrar el .exe portable original.
 */
function executable(): string {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
}

function options() {
  return { path: executable(), args: [] as string[], name: STARTUP_ENTRY }
}

export function getStartup(): StartupState {
  // En desarrollo, execPath es electron.exe: registrarlo no tendría sentido.
  if (!app.isPackaged || process.platform !== 'win32') return { available: false, enabled: false, portable: false }
  const { openAtLogin, executableWillLaunchAtLogin } = app.getLoginItemSettings(options())
  return {
    available: true,
    // executableWillLaunchAtLogin es false si el usuario lo desactivó desde el Administrador de tareas.
    enabled: openAtLogin && executableWillLaunchAtLogin !== false,
    portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE)
  }
}

export function setStartup(enabled: boolean): StartupState {
  if (!getStartup().available) return getStartup()
  app.setLoginItemSettings({ ...options(), openAtLogin: Boolean(enabled), enabled: Boolean(enabled) })
  return getStartup()
}
