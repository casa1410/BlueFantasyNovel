/**
 * Biblioteca: pantalla inicial con todas las historias del usuario.
 */
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BookOpen, Cloud, FolderOpen, Library, Plus, RotateCcw, Settings, ShieldCheck, Sparkles } from 'lucide-react'
import type { Id, ProjectSummary, Saga } from '@shared/types'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { BackupPanel } from '@renderer/components/BackupPanel'
import { Modal } from '@renderer/components/Modal'
import { SettingsDialog } from '@renderer/components/SettingsDialog'
import { useLocalPreference } from '@renderer/hooks/useLocalPreference'
import { relativeTime } from '@renderer/lib/format'
import { useSettings } from '@renderer/lib/settings'
import { useToast } from '@renderer/components/Toasts'
import { api, errorMessage } from '@renderer/lib/api'
import { NewProjectDialog } from './NewProjectDialog'
import { ProjectCard } from './ProjectCard'
import { SagasDialog } from './SagasDialog'
import './library.css'

interface LibraryViewProps {
  onOpenProject: (projectId: Id) => void
}

export function LibraryView({ onOpenProject }: LibraryViewProps) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [sagasOpen, setSagasOpen] = useState(false)
  const [sagas, setSagas] = useState<Saga[]>([])
  const [bannerDismissed, setBannerDismissed] = useLocalPreference('backup.bannerDismissed', false)
  const { settings } = useSettings()
  const backup = settings?.backup
  const toast = useToast()

  const reload = useCallback(async () => {
    try {
      setProjects(await api.projects.list())
      setSagas(await api.sagas.list())
    } catch (error) {
      toast.error(`No se pudo leer la biblioteca: ${errorMessage(error)}`)
      setProjects([])
    }
  }, [toast])

  useEffect(() => {
    void reload()
  }, [reload])

  const totalWords = projects?.reduce((sum, p) => sum + p.wordCount, 0) ?? 0

  return (
    <div className="library">
      <header className="library-header">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <h1>BlueFantasyNovel</h1>
            <p className="muted">
              {projects && projects.length > 0
                ? `${projects.length} ${projects.length === 1 ? 'historia' : 'historias'} · ${totalWords.toLocaleString('es-ES')} palabras escritas`
                : 'Tu estudio de escritura, sin conexión y sin suscripciones'}
            </p>
          </div>
        </div>
        <div className="library-actions">
          {backup?.enabled && backup.folder && (
            <button
              className={`btn btn-ghost btn-sm backup-chip ${backup.lastError ? 'is-error' : ''}`}
              onClick={() => setBackupOpen(true)}
              title={backup.lastError || backup.folder}
            >
              {backup.lastError ? <AlertTriangle size={14} /> : <Cloud size={14} />}
              {backup.lastError
                ? 'La copia falló'
                : backup.lastBackupAt
                  ? `Copia: ${relativeTime(backup.lastBackupAt)}`
                  : 'Copias activadas'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setSagasOpen(true)} title="Historias que comparten mundo">
            <Library size={15} /> Sagas
          </button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Ajustes">
            <Settings size={17} />
          </button>
          <button className="btn btn-ghost" onClick={() => api.library.openFolder()} title="Abrir la carpeta donde se guardan tus historias">
            <FolderOpen size={16} />
            Carpeta de datos
          </button>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            Nueva historia
          </button>
        </div>
      </header>

      {settings && !backup?.folder && !bannerDismissed && (
        <div className="backup-banner">
          <ShieldCheck size={26} />
          <div>
            <strong>Protege tus historias</strong>
            <small>Activa las copias de seguridad en Google Drive, OneDrive o Dropbox. Es un clic y te salva si el ordenador falla.</small>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setBannerDismissed(true)}>
            Ahora no
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setBackupOpen(true)}>
            Activar copias
          </button>
        </div>
      )}
      {backup?.enabled && backup.lastError && (
        <div className="backup-banner is-error">
          <AlertTriangle size={24} />
          <div>
            <strong>La última copia de seguridad no se pudo hacer</strong>
            <small>{backup.lastError}</small>
          </div>
          <button className="btn btn-sm" onClick={() => setBackupOpen(true)}>
            Revisar
          </button>
        </div>
      )}

      <main className="library-content">
        {projects === null ? null : projects.length === 0 ? (
          <div className="empty-state library-empty">
            <BookOpen size={44} />
            <h3>Todas las grandes sagas empiezan con una página en blanco</h3>
            <p>Crea tu primera historia para empezar a escribir capítulos y dar vida a tus personajes.</p>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} />
              Crear mi primera historia
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setBackupOpen(true)}>
              <RotateCcw size={14} />
              ¿Vienes de otro ordenador? Restaura tus historias desde una copia
            </button>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                sagaName={sagas.find((s) => s.id === project.sagaId)?.name}
                onOpen={() => onOpenProject(project.id)}
                onDelete={() => setPendingDelete(project)}
              />
            ))}
            <button className="project-card project-card-new" onClick={() => setCreating(true)}>
              <Plus size={28} />
              <span>Nueva historia</span>
            </button>
          </div>
        )}
      </main>

      {creating && (
        <NewProjectDialog
          onClose={() => setCreating(false)}
          onCreated={(project) => {
            setCreating(false)
            onOpenProject(project.id)
          }}
        />
      )}

      {sagasOpen && projects && <SagasDialog projects={projects} onClose={() => setSagasOpen(false)} onChanged={reload} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} onRestored={reload} />}
      {backupOpen && (
        <Modal
          title="Copias de seguridad"
          description="Una copia de todas tus historias en la nube, por si el ordenador falla."
          onClose={() => setBackupOpen(false)}
          footer={
            <button className="btn btn-primary" onClick={() => setBackupOpen(false)}>
              Cerrar
            </button>
          }
        >
          <BackupPanel onRestored={reload} />
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`¿Eliminar «${pendingDelete.title}»?`}
          message="La historia se moverá a la Papelera de reciclaje de Windows. Podrás recuperarla desde allí si cambias de opinión."
          confirmLabel="Mover a la papelera"
          destructive
          onClose={() => setPendingDelete(null)}
          onConfirm={async () => {
            try {
              await api.projects.delete(pendingDelete.id)
              toast.success('Historia enviada a la papelera')
              await reload()
            } catch (error) {
              toast.error(`No se pudo eliminar: ${errorMessage(error)}`)
            }
          }}
        />
      )}
    </div>
  )
}
