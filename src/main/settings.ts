/**
 * Ajustes de la aplicación (tema, tipografía del editor, copias de
 * seguridad). Se guardan en `settings.json` dentro de la carpeta de datos de
 * usuario de Electron (%APPDATA%\BlueFantasyNovel), NO en la biblioteca: son
 * preferencias de este equipo, no de una historia.
 */
import path from 'node:path'
import type { AppSettings } from '@shared/types'
import { pathExists, readJson, writeJsonAtomic } from './storage/fsUtils'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  editorFont: 'serif',
  editorFontSize: 19,
  editorWidth: 720,
  backup: { enabled: false, folder: '', keep: 14, lastBackupAt: '', lastError: '' }
}

export class SettingsStore {
  private cache: AppSettings | null = null
  private readonly file: string

  constructor(userDataDir: string) {
    this.file = path.join(userDataDir, 'settings.json')
  }

  async get(): Promise<AppSettings> {
    if (this.cache) return this.cache
    let stored: Partial<AppSettings> = {}
    try {
      if (await pathExists(this.file)) stored = await readJson<Partial<AppSettings>>(this.file)
    } catch (error) {
      console.error('settings.json dañado; se usan los valores por defecto', error)
    }
    this.cache = sanitize({ ...DEFAULT_SETTINGS, ...stored, backup: { ...DEFAULT_SETTINGS.backup, ...stored.backup } })
    return this.cache
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get()
    const next = sanitize({ ...current, ...patch, backup: { ...current.backup, ...patch.backup } })
    await writeJsonAtomic(this.file, next)
    this.cache = next
    return next
  }
}

/** Acota valores que llegan de la interfaz o de un archivo editado a mano. */
function sanitize(settings: AppSettings): AppSettings {
  const clamp = (value: number, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
  return {
    theme: ['dark', 'light', 'system'].includes(settings.theme) ? settings.theme : DEFAULT_SETTINGS.theme,
    editorFont: ['serif', 'sans', 'mono'].includes(settings.editorFont) ? settings.editorFont : DEFAULT_SETTINGS.editorFont,
    editorFontSize: clamp(settings.editorFontSize, 14, 28, DEFAULT_SETTINGS.editorFontSize),
    editorWidth: clamp(settings.editorWidth, 520, 1100, DEFAULT_SETTINGS.editorWidth),
    backup: {
      enabled: Boolean(settings.backup.enabled),
      folder: String(settings.backup.folder ?? ''),
      keep: clamp(settings.backup.keep, 1, 100, DEFAULT_SETTINGS.backup.keep),
      lastBackupAt: String(settings.backup.lastBackupAt ?? ''),
      lastError: String(settings.backup.lastError ?? '')
    }
  }
}
