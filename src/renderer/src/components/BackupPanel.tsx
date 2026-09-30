/**
 * Configuración y estado de las copias de seguridad.
 *
 * Pensado para que cualquier usuario lo active en un clic: detecta Google
 * Drive, OneDrive, Dropbox o iCloud en el equipo y ofrece usarlos como
 * destino. También permite restaurar desde una copia (p. ej. en un PC nuevo).
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Cloud, FolderOpen, HardDriveDownload, History, RotateCcw } from 'lucide-react'
import type { CloudFolder } from '@shared/types'
import { api, errorMessage } from '@renderer/lib/api'
import { relativeTime } from '@renderer/lib/format'
import { useSettings } from '@renderer/lib/settings'
import { useToast } from './Toasts'
import './backupPanel.css'

const INSTALL_LINKS = [
  { label: 'Google Drive para ordenadores', url: 'https://www.google.com/drive/download/' },
  { label: 'OneDrive', url: 'https://www.microsoft.com/microsoft-365/onedrive/download' }
]

interface BackupPanelProps {
  /** Tras restaurar historias (para recargar la biblioteca). */
  onRestored?: () => void
}

export function BackupPanel({ onRestored }: BackupPanelProps) {
  const { settings, replace } = useSettings()
  const [clouds, setClouds] = useState<CloudFolder[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.backup.detectClouds().then(setClouds).catch(() => setClouds([]))
  }, [])

  if (!settings) return null
  const { backup } = settings
  const configured = Boolean(backup.folder)
  const destination = clouds?.find((c) => backup.folder.toLowerCase().startsWith(c.path.toLowerCase()))

  /** Ejecuta una acción mostrando "ocupado" en su botón. */
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    try {
      await action()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const activate = (key: string, pick: () => Promise<Awaited<ReturnType<typeof api.backup.useFolder>> | null>) =>
    run(key, async () => {
      const updated = await pick()
      if (!updated) return
      replace(updated)
      setChanging(false)
      if (updated.backup.lastError) toast.error(`Configurado, pero la primera copia falló: ${updated.backup.lastError}`)
      else toast.success('¡Listo! Tus historias ya tienen copia de seguridad.')
    })

  const restore = () =>
    run('restore', async () => {
      const summary = await api.backup.restore()
      if (!summary) return
      const parts = [
        summary.added && `${summary.added} añadidas`,
        summary.updated && `${summary.updated} actualizadas`,
        summary.skipped && `${summary.skipped} ya estaban al día`
      ].filter(Boolean)
      toast.success(`Copia restaurada: ${parts.join(', ') || 'nada que restaurar'}.`)
      onRestored?.()
    })

  const chooser = (
    <div className="backup-choose">
      {clouds === null ? (
        <p className="faint">Buscando Google Drive, OneDrive, Dropbox…</p>
      ) : clouds.length > 0 ? (
        <>
          <p>Elige dónde guardar las copias. Se subirán a la nube automáticamente:</p>
          <div className="backup-destinations">
            {clouds.map((cloud) => (
              <button
                key={cloud.path}
                className="backup-destination"
                disabled={busy !== null}
                onClick={() => activate(cloud.path, () => api.backup.useFolder(cloud.path))}
              >
                <Cloud size={22} />
                <span>
                  <strong>{busy === cloud.path ? 'Configurando…' : cloud.label}</strong>
                  <small>{cloud.path}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="backup-no-cloud">
          <p>
            No hemos encontrado ningún servicio en la nube en este equipo. La forma más fácil es instalar uno gratuito,
            iniciar sesión y volver aquí:
          </p>
          <ul>
            {INSTALL_LINKS.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <button className="btn btn-sm btn-ghost" onClick={() => api.backup.detectClouds().then(setClouds)}>
            Volver a buscar
          </button>
        </div>
      )}
      <button
        className="btn btn-sm btn-ghost backup-other"
        disabled={busy !== null}
        onClick={() => activate('other', () => api.backup.chooseFolder())}
      >
        <FolderOpen size={14} /> Otra carpeta (disco externo, pendrive…)
      </button>
    </div>
  )

  return (
    <div className="backup-panel">
      {configured && !changing ? (
        <>
          <div className={`backup-status ${backup.lastError ? 'is-error' : ''}`}>
            {backup.lastError ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            <div>
              <strong>
                {backup.lastError
                  ? 'La última copia no se pudo hacer'
                  : `Copias en ${destination?.label ?? 'tu carpeta de copias'}`}
              </strong>
              <small title={backup.folder}>{backup.lastError || backup.folder}</small>
              <small>
                {backup.lastBackupAt ? `Última copia: ${relativeTime(backup.lastBackupAt)}` : 'Aún no se ha hecho ninguna copia'}
              </small>
            </div>
          </div>

          <label className="settings-check">
            <input
              type="checkbox"
              checked={backup.enabled}
              onChange={async (e) => replace(await api.settings.update({ backup: { ...backup, enabled: e.target.checked } }))}
            />
            Copiar automáticamente al abrir y al cerrar la aplicación
          </label>
          <p className="field-hint">
            <History size={12} /> Se conserva una copia por día de los últimos{' '}
            <input
              className="input settings-keep"
              type="number"
              min={1}
              max={100}
              value={backup.keep}
              onChange={async (e) => replace(await api.settings.update({ backup: { ...backup, keep: Number(e.target.value) } }))}
            />{' '}
            días.
          </p>

          <div className="backup-actions">
            <button
              className="btn btn-sm"
              disabled={busy !== null}
              onClick={() =>
                run('now', async () => {
                  await api.backup.runNow()
                  replace(await api.settings.get())
                  toast.success('Copia de seguridad hecha')
                })
              }
            >
              <HardDriveDownload size={14} /> {busy === 'now' ? 'Copiando…' : 'Hacer copia ahora'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setChanging(true)}>
              Cambiar destino
            </button>
          </div>
        </>
      ) : (
        chooser
      )}

      <div className="backup-restore">
        <RotateCcw size={14} />
        <span>¿PC nuevo o se estropeó el anterior? Instala la app, inicia sesión en tu nube y</span>
        <button className="btn btn-sm btn-ghost" disabled={busy !== null} onClick={restore}>
          {busy === 'restore' ? 'Restaurando…' : 'restaura desde una copia'}
        </button>
      </div>
    </div>
  )
}
