/**
 * Ajustes: apariencia, editor y copias de seguridad.
 * Cada cambio se guarda al momento.
 */
import { Monitor, Moon, Sun } from 'lucide-react'
import type { AppSettings, ThemePreference } from '@shared/types'
import { useSettings } from '@renderer/lib/settings'
import { BackupPanel } from './BackupPanel'
import { Modal } from './Modal'
import './settingsDialog.css'

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'system', label: 'Como Windows', icon: Monitor }
]

const FONTS: { value: AppSettings['editorFont']; label: string }[] = [
  { value: 'serif', label: 'Con serifa (libro)' },
  { value: 'sans', label: 'Sin serifa' },
  { value: 'mono', label: 'Máquina de escribir' }
]

interface SettingsDialogProps {
  onClose: () => void
  /** Tras restaurar una copia (para recargar la biblioteca). */
  onRestored?: () => void
}

export function SettingsDialog({ onClose, onRestored }: SettingsDialogProps) {
  const { settings, update } = useSettings()
  if (!settings) return null

  return (
    <Modal title="Ajustes" onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Listo</button>}>
      <section className="settings-section">
        <h3>Apariencia</h3>
        <div className="segmented" role="radiogroup" aria-label="Tema">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={settings.theme === value}
              className={settings.theme === value ? 'is-active' : ''}
              onClick={() => update({ theme: value })}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Editor</h3>
        <label className="field">
          <span className="field-label">Tipo de letra</span>
          <select className="select" value={settings.editorFont} onChange={(e) => update({ editorFont: e.target.value as AppSettings['editorFont'] })}>
            {FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Tamaño de letra · {settings.editorFontSize} px</span>
          <input type="range" min={14} max={28} value={settings.editorFontSize} onChange={(e) => update({ editorFontSize: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span className="field-label">Ancho del texto · {settings.editorWidth} px</span>
          <input type="range" min={520} max={1100} step={20} value={settings.editorWidth} onChange={(e) => update({ editorWidth: Number(e.target.value) })} />
        </label>
        <p className="settings-preview" style={{ fontFamily: 'var(--editor-font)', fontSize: 'var(--editor-font-size)' }}>
          Érase una vez, en un mar sin mapas…
        </p>
      </section>

      <section className="settings-section">
        <h3>Copias de seguridad</h3>
        <BackupPanel onRestored={onRestored} />
      </section>
    </Modal>
  )
}
