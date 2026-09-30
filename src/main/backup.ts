/**
 * Copias de seguridad de la biblioteca completa.
 *
 * Cada copia es una carpeta normal (no un ZIP) para que se pueda abrir y
 * recuperar cualquier archivo sin herramientas:
 *
 *   <carpeta de copias>/BlueFantasyNovel-copia-2026-09-29_18-30-05/
 *
 * La carpeta de copias suele estar dentro de Google Drive, OneDrive o Dropbox
 * (ver cloudFolders.ts): así el programa del servicio la sube a la nube solo.
 *
 * Cuándo se copia (si las copias están activadas):
 *  - al abrir la aplicación, si la última copia tiene más de un día;
 *  - al cerrarla, si ha cambiado algo desde la última copia;
 *  - cuando el usuario pulsa "Hacer copia ahora".
 *
 * Qué se conserva: la copia más reciente de cada día, de los últimos
 * `keep` días con copia. El resto se borra.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { RestoreSummary } from '@shared/types'
import type { SettingsStore } from './settings'
import { assertSafeId, pathExists, readJson } from './storage/fsUtils'

const PREFIX = 'BlueFantasyNovel-copia-'
/** Nombre de la subcarpeta que se crea dentro de la nube elegida. */
export const BACKUP_FOLDER_NAME = 'BlueFantasyNovel (copias)'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export class BackupService {
  /** ¿Ha cambiado algo en la biblioteca desde la última copia? */
  private dirty = false
  private running: Promise<string> | null = null

  constructor(
    private readonly libraryRoot: string,
    private readonly settings: SettingsStore,
    /** Cómo apartar una historia que se va a sustituir al restaurar (Papelera). */
    private readonly moveToTrash: (dir: string) => Promise<void>
  ) {}

  /** El repositorio avisa aquí de cada cambio guardado. */
  markDirty(): void {
    this.dirty = true
  }

  /** Activa las copias en `<parentFolder>/BlueFantasyNovel (copias)` y hace la primera. */
  async useFolder(parentFolder: string): Promise<void> {
    const current = await this.settings.get()
    const folder = path.basename(parentFolder) === BACKUP_FOLDER_NAME ? parentFolder : path.join(parentFolder, BACKUP_FOLDER_NAME)
    await this.settings.update({ backup: { ...current.backup, enabled: true, folder } })
    await this.createBackup()
  }

  /** Hace una copia ahora. Si ya hay una en curso, espera a esa. */
  createBackup(): Promise<string> {
    this.running ??= this.copy().finally(() => {
      this.running = null
    })
    return this.running
  }

  /** Copia al arrancar si la última tiene más de un día. Nunca lanza. */
  async runOnStartup(): Promise<void> {
    const { backup } = await this.settings.get()
    if (!backup.enabled || !backup.folder) return
    const last = backup.lastBackupAt ? new Date(backup.lastBackupAt).getTime() : 0
    if (Date.now() - last < ONE_DAY_MS) return
    await this.createBackup().catch(() => undefined) // el error queda guardado en los ajustes
  }

  /** Copia al cerrar si hubo cambios en esta sesión. Nunca lanza. */
  async runOnQuit(): Promise<void> {
    const { backup } = await this.settings.get()
    if (!backup.enabled || !backup.folder || !this.dirty) return
    await this.createBackup().catch(() => undefined)
  }

  /**
   * Restaura historias desde una copia. `source` puede ser una copia concreta
   * (BlueFantasyNovel-copia-…) o la carpeta que las contiene; en ese caso se
   * usa la más reciente.
   *
   * - Las historias que no existen en este equipo se añaden.
   * - Las que existen se sustituyen solo si la copia es más reciente; la
   *   versión actual se envía antes a la Papelera.
   */
  async restore(source: string): Promise<RestoreSummary> {
    const from = await resolveBackupDir(source)
    const projectDirs = await listProjectDirs(from)
    if (projectDirs.length === 0) {
      throw new Error('Esa carpeta no contiene historias de BlueFantasyNovel. Elige una carpeta de copias.')
    }

    const summary: RestoreSummary = { from, added: 0, updated: 0, skipped: 0 }
    await fs.mkdir(this.libraryRoot, { recursive: true })
    for (const id of projectDirs) {
      const source = path.join(from, id)
      const target = path.join(this.libraryRoot, id)
      if (!(await pathExists(path.join(target, 'project.json')))) {
        await fs.cp(source, target, { recursive: true })
        summary.added++
        continue
      }
      const incoming = await readUpdatedAt(source)
      const existing = await readUpdatedAt(target)
      if (incoming > existing) {
        await this.moveToTrash(target)
        await fs.cp(source, target, { recursive: true })
        summary.updated++
      } else {
        summary.skipped++
      }
    }
    if (summary.added || summary.updated) this.markDirty()
    return summary
  }

  private async copy(): Promise<string> {
    const { backup } = await this.settings.get()
    try {
      if (!backup.folder) throw new Error('Elige primero dónde guardar las copias')
      // Evita copiar la biblioteca dentro de sí misma (bucle infinito).
      const relative = path.relative(this.libraryRoot, backup.folder)
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        throw new Error('La carpeta de copias no puede estar dentro de la biblioteca')
      }

      this.dirty = false
      const target = path.join(backup.folder, `${PREFIX}${timestamp(new Date())}`)
      await fs.mkdir(backup.folder, { recursive: true })
      await fs.mkdir(this.libraryRoot, { recursive: true })
      await fs.cp(this.libraryRoot, target, { recursive: true })
      await pruneBackups(backup.folder, backup.keep)

      const latest = await this.settings.get()
      await this.settings.update({ backup: { ...latest.backup, lastBackupAt: new Date().toISOString(), lastError: '' } })
      return target
    } catch (error) {
      this.dirty = true
      const message = friendlyError(error, backup.folder)
      const latest = await this.settings.get()
      await this.settings.update({ backup: { ...latest.backup, lastError: message } })
      console.error('La copia de seguridad falló:', error)
      throw new Error(message)
    }
  }
}

function timestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

/** Conserva la copia más reciente de cada día, de los últimos `keepDays` días con copia. */
async function pruneBackups(folder: string, keepDays: number): Promise<void> {
  const entries = await fs.readdir(folder, { withFileTypes: true })
  // El nombre lleva la fecha, así que el orden alfabético es el cronológico.
  const names = entries.filter((e) => e.isDirectory() && e.name.startsWith(PREFIX)).map((e) => e.name).sort().reverse()

  const keep = new Set<string>()
  const days = new Set<string>()
  for (const name of names) {
    const day = name.slice(PREFIX.length, PREFIX.length + 10) // AAAA-MM-DD
    if (days.has(day) || days.size >= keepDays) continue
    days.add(day)
    keep.add(name)
  }
  await Promise.all(names.filter((n) => !keep.has(n)).map((n) => fs.rm(path.join(folder, n), { recursive: true, force: true })))
}

/** Si `source` contiene copias, devuelve la más reciente; si no, la propia carpeta. */
async function resolveBackupDir(source: string): Promise<string> {
  const entries = await fs.readdir(source, { withFileTypes: true })
  const copies = entries.filter((e) => e.isDirectory() && e.name.startsWith(PREFIX)).map((e) => e.name).sort()
  if (copies.length > 0) return path.join(source, copies[copies.length - 1])
  // También se acepta la carpeta de la nube que contiene "BlueFantasyNovel (copias)".
  const nested = path.join(source, BACKUP_FOLDER_NAME)
  if (await pathExists(nested)) return resolveBackupDir(nested)
  return source
}

async function listProjectDirs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const result: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      assertSafeId(entry.name)
    } catch {
      continue
    }
    if (await pathExists(path.join(dir, entry.name, 'project.json'))) result.push(entry.name)
  }
  return result
}

async function readUpdatedAt(projectDir: string): Promise<string> {
  try {
    return (await readJson<{ updatedAt?: string }>(path.join(projectDir, 'project.json'))).updatedAt ?? ''
  } catch {
    return ''
  }
}

/** Mensajes comprensibles para los fallos más habituales. */
function friendlyError(error: unknown, folder: string): string {
  const code = (error as NodeJS.ErrnoException)?.code
  if (code === 'ENOENT' || code === 'ENODEV' || code === 'EINVAL') {
    return `No se encuentra la carpeta de copias (${folder}). ¿Está abierto Google Drive / OneDrive o conectado el disco?`
  }
  if (code === 'ENOSPC') return 'No queda espacio en la carpeta de copias.'
  if (code === 'EACCES' || code === 'EPERM') return 'No hay permiso para escribir en la carpeta de copias.'
  return error instanceof Error ? error.message : String(error)
}
