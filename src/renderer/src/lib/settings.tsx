/**
 * Ajustes de la aplicación en la interfaz.
 *
 * `SettingsProvider` carga los ajustes del proceso principal y los aplica:
 *  - tema: atributo `data-theme` en <html> (ver styles/tokens.css),
 *  - tipografía del editor: variables CSS `--editor-*`.
 *
 * Uso: const { settings, update } = useSettings()
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppSettings } from '@shared/types'
import { api } from './api'

const EDITOR_FONTS: Record<AppSettings['editorFont'], string> = {
  serif: 'var(--font-serif)',
  sans: 'var(--font-ui)',
  mono: 'var(--font-mono)'
}

interface SettingsContextValue {
  settings: AppSettings | null
  update: (patch: Partial<AppSettings>) => Promise<void>
  /** Sustituye el estado local (p. ej. tras elegir carpeta de copias). */
  replace: (settings: AppSettings) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    api.settings.get().then(setSettings).catch(console.error)
  }, [])

  // Tema: "system" sigue la preferencia de Windows y reacciona si cambia.
  useEffect(() => {
    if (!settings) return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const light = settings.theme === 'light' || (settings.theme === 'system' && media.matches)
      document.documentElement.dataset.theme = light ? 'light' : 'dark'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings])

  useEffect(() => {
    if (!settings) return
    const style = document.documentElement.style
    style.setProperty('--editor-font', EDITOR_FONTS[settings.editorFont])
    style.setProperty('--editor-font-size', `${settings.editorFontSize}px`)
    style.setProperty('--editor-width', `${settings.editorWidth}px`)
  }, [settings])

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings(await api.settings.update(patch))
  }, [])

  return <SettingsContext.Provider value={{ settings, update, replace: setSettings }}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings debe usarse dentro de <SettingsProvider>')
  return context
}
