/**
 * "Abrir al iniciar Windows". No se guarda en settings.json: el estado real es
 * la entrada de Windows (HKCU\...\Run), así que se lee y se cambia ahí, y
 * siempre coincide con lo que ve el usuario en el Administrador de tareas.
 *
 * Se usa `reg.exe` directamente: app.getLoginItemSettings no encuentra las
 * entradas con nombre propio (no admite `name`) y la casilla salía siempre
 * desmarcada aunque la entrada existiera.
 *
 * Empieza desactivado: no hay entrada hasta que se activa, y el desinstalador
 * la borra (build/installer.nsh), así que una instalación nueva nunca arranca
 * sola.
 */
import { execFile } from 'node:child_process'
import path from 'node:path'
import { app } from 'electron'
import type { StartupState } from '@shared/types'

/** Nombre de la entrada en el registro (el desinstalador usa el mismo). */
export const STARTUP_ENTRY = 'BlueFantasyNovel'
const RUN_KEY = String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
/** Donde el Administrador de tareas guarda si una entrada está deshabilitada. */
const APPROVED_KEY = String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run`

/**
 * Programa que debe abrir Windows. En la versión portable, `execPath` es la
 * copia descomprimida en una carpeta temporal, que cambia cada vez: hay que
 * registrar el .exe portable original.
 */
function executable(): string {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
}

/** Ejecuta reg.exe; devuelve su salida o null si falla (p. ej. el valor no existe). */
function reg(args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('reg.exe', args, { windowsHide: true, encoding: 'utf8' }, (error, stdout) => resolve(error ? null : stdout))
  })
}

/** Dato de un valor del registro (la parte tras `REG_SZ`/`REG_BINARY`), o null. */
async function readValue(key: string, name: string): Promise<string | null> {
  const out = await reg(['query', key, '/v', name])
  const line = out?.split(/\r?\n/).find((l) => l.trim().startsWith(name))
  const match = line?.match(/REG_\w+\s+(.*)$/)
  return match ? match[1].trim() : null
}

/** Misma ruta en Windows (sin comillas ni diferencias de mayúsculas). */
function sameFile(a: string, b: string): boolean {
  const clean = (p: string) => path.resolve(p.trim().replace(/^"([^"]*)".*$/, '$1')).toLowerCase()
  return clean(a) === clean(b)
}

function available(): boolean {
  // En desarrollo, execPath es electron.exe: registrarlo no tendría sentido.
  return app.isPackaged && process.platform === 'win32'
}

export async function getStartup(): Promise<StartupState> {
  const portable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE)
  if (!available()) return { available: false, enabled: false, portable }
  const command = await readValue(RUN_KEY, STARTUP_ENTRY)
  // Primer byte impar (03…) = deshabilitada desde el Administrador de tareas.
  const approved = await readValue(APPROVED_KEY, STARTUP_ENTRY)
  const disabledInTaskManager = approved ? parseInt(approved.slice(0, 2), 16) % 2 === 1 : false
  return { available: true, enabled: Boolean(command && sameFile(command, executable()) && !disabledInTaskManager), portable }
}

export async function setStartup(enabled: boolean): Promise<StartupState> {
  if (!available()) return getStartup()
  // Quitar la marca del Administrador de tareas: si no, la entrada seguiría deshabilitada.
  await reg(['delete', APPROVED_KEY, '/v', STARTUP_ENTRY, '/f'])
  if (enabled) {
    const ok = await reg(['add', RUN_KEY, '/v', STARTUP_ENTRY, '/t', 'REG_SZ', '/d', `"${executable()}"`, '/f'])
    if (ok === null) throw new Error('Windows no dejó añadir la aplicación al inicio')
  } else {
    await reg(['delete', RUN_KEY, '/v', STARTUP_ENTRY, '/f'])
  }
  return getStartup()
}
