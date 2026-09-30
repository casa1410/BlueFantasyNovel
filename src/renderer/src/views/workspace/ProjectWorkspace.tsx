/**
 * Espacio de trabajo de un proyecto abierto.
 *
 * Es el "dueño" del estado del proyecto: lo carga, lo pasa a las secciones y
 * recibe de ellas la versión actualizada tras cada cambio (`onProjectChange`).
 * El proceso principal siempre devuelve el proyecto completo después de
 * guardar, así que la interfaz nunca queda desincronizada del disco.
 *
 * También guarda el estado que debe sobrevivir al cambiar de sección:
 * capítulo activo, modo enfoque y sprint de escritura en curso.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Id, Project } from '@shared/types'
import { SettingsDialog } from '@renderer/components/SettingsDialog'
import { useToast } from '@renderer/components/Toasts'
import { api, errorMessage } from '@renderer/lib/api'
import { plural } from '@renderer/lib/format'
import { flushAll } from '@renderer/lib/pendingSaves'
import { BestiaryView } from '../bestiary/BestiaryView'
import { BoardsView } from '../boards/BoardsView'
import { SocialCardsDialog } from '../cards/SocialCardsDialog'
import { CharactersView } from '../characters/CharactersView'
import { CoverView } from '../cover/CoverView'
import { GlossaryView } from '../glossary/GlossaryView'
import { LineagesView } from '../lineages/LineagesView'
import { LoreView } from '../lore/LoreView'
import { ManuscriptView } from '../manuscript/ManuscriptView'
import { SearchDialog } from '../manuscript/SearchDialog'
import type { Sprint } from '../manuscript/editor/SprintButton'
import { MapsView } from '../maps/MapsView'
import { PlotsView } from '../plots/PlotsView'
import { RacesView } from '../races/RacesView'
import { RelationsView } from '../relations/RelationsView'
import { StatsView } from '../stats/StatsView'
import { TimelineView } from '../timeline/TimelineView'
import { Sidebar } from './Sidebar'
import type { WorkspaceSection } from './sections'
import './workspace.css'

interface ProjectWorkspaceProps {
  projectId: Id
  onExit: () => void
}

const totalWords = (project: Project) => project.chapters.reduce((sum, c) => sum + c.wordCount, 0)

export function ProjectWorkspace({ projectId, onExit }: ProjectWorkspaceProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [section, setSection] = useState<WorkspaceSection>('manuscript')
  const [activeChapterId, setActiveChapterId] = useState<Id | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [dialog, setDialog] = useState<'search' | 'settings' | 'cards' | null>(null)
  const [cardText, setCardText] = useState('')
  const [sceneJump, setSceneJump] = useState<{ chapterId: Id; separatorsBefore: number; nonce: number } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [sprint, setSprint] = useState<Sprint | null>(null)
  const toast = useToast()
  // Referencias estables para callbacks y temporizadores.
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  const projectRef = useRef(project)
  projectRef.current = project

  useEffect(() => {
    api.projects
      .get(projectId)
      .then((loaded) => {
        setProject(loaded)
        setActiveChapterId(loaded.chapters[0]?.id ?? null)
      })
      .catch((error) => {
        toast.error(`No se pudo abrir la historia: ${errorMessage(error)}`)
        onExitRef.current()
      })
  }, [projectId, toast])

  /** Envuelve una operación que devuelve el proyecto actualizado. */
  const run = useCallback(
    async (operation: () => Promise<Project>, failMessage: string) => {
      try {
        setProject(await operation())
      } catch (error) {
        toast.error(`${failMessage}: ${errorMessage(error)}`)
      }
    },
    [toast]
  )

  // El modo enfoque usa pantalla completa real; al salir con Esc del
  // navegador también desactivamos el modo.
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setFocusMode(false)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const toggleFocusMode = useCallback(() => {
    setFocusMode((enabled) => {
      const next = !enabled
      if (next) void document.documentElement.requestFullscreen().catch(() => undefined)
      else if (document.fullscreenElement) void document.exitFullscreen()
      return next
    })
  }, [])

  // Ctrl+Mayús+F: buscar en todo el manuscrito.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setDialog('search')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------------------------------------------------------------------- */
  /* Sprints de escritura                                                   */
  /* ---------------------------------------------------------------------- */

  const startSprint = useCallback(async (minutes: number) => {
    await flushAll()
    const current = projectRef.current
    if (current) setSprint({ startedAt: Date.now(), minutes, startWords: totalWords(current) })
  }, [])

  const finishSprint = useCallback(async () => {
    const running = sprint
    if (!running) return
    setSprint(null)
    await flushAll()
    const current = projectRef.current
    if (!current) return
    const words = Math.max(0, totalWords(current) - running.startWords)
    const minutes = Math.round(((Date.now() - running.startedAt) / 60000) * 10) / 10
    if (minutes >= 1) {
      await run(
        () => api.projects.addSession(current.id, { start: new Date(running.startedAt).toISOString(), minutes, words }),
        'No se pudo guardar el sprint'
      )
    }
    toast.success(`Sprint terminado: ${plural(words, 'palabra')} en ${Math.round(minutes)} min`)
  }, [sprint, run, toast])

  // Termina el sprint cuando se acaba el tiempo.
  useEffect(() => {
    if (!sprint) return
    const remaining = sprint.startedAt + sprint.minutes * 60_000 - Date.now()
    const timer = setTimeout(() => void finishSprint(), Math.max(0, remaining))
    return () => clearTimeout(timer)
  }, [sprint, finishSprint])

  if (!project) return <div className="workspace-loading" />

  const createChapter = async (draft = false) => {
    try {
      const count = project.chapters.filter((c) => c.draft === draft).length + 1
      const result = await api.chapters.create(project.id, draft ? `Borrador ${count}` : `Capítulo ${count}`, draft)
      setProject(result.project)
      setActiveChapterId(result.chapter.id)
      setSection('manuscript')
    } catch (error) {
      toast.error(`No se pudo crear el capítulo: ${errorMessage(error)}`)
    }
  }

  const openChapter = (chapterId: Id) => {
    setActiveChapterId(chapterId)
    setSection('manuscript')
  }

  const openCards = (text = '') => {
    setCardText(text)
    setDialog('cards')
  }

  const views: Record<WorkspaceSection, () => ReactNode> = {
    manuscript: () => (
      <ManuscriptView
        project={project}
        chapterId={activeChapterId}
        onProjectChange={setProject}
        onRenameChapter={(id, title) => run(() => api.chapters.rename(project.id, id, title), 'No se pudo renombrar')}
        focusMode={focusMode}
        onToggleFocusMode={toggleFocusMode}
        onCreateChapter={() => createChapter(false)}
        reloadToken={reloadToken}
        sprint={sprint}
        onStartSprint={(minutes) => void startSprint(minutes)}
        onStopSprint={() => void finishSprint()}
        onOpenCards={openCards}
        sceneJump={sceneJump}
      />
    ),
    plots: () => <PlotsView project={project} onProjectChange={setProject} onOpenChapter={openChapter} />,
    cover: () => <CoverView project={project} onProjectChange={setProject} />,
    lineages: () => <LineagesView project={project} onProjectChange={setProject} onOpenChapter={openChapter} />,
    races: () => <RacesView project={project} onProjectChange={setProject} onOpenChapter={openChapter} />,
    glossary: () => <GlossaryView project={project} onProjectChange={setProject} onOpenChapter={openChapter} />,
    characters: () => <CharactersView project={project} onProjectChange={setProject} onOpenChapter={openChapter} />,
    relations: () => <RelationsView project={project} onProjectChange={setProject} />,
    lore: () => <LoreView project={project} onProjectChange={setProject} onOpenChapter={openChapter} />,
    bestiary: () => <BestiaryView project={project} onProjectChange={setProject} onOpenChapter={openChapter} />,
    timeline: () => <TimelineView project={project} onProjectChange={setProject} onOpenChapter={openChapter} />,
    maps: () => <MapsView project={project} onProjectChange={setProject} />,
    boards: () => <BoardsView project={project} onProjectChange={setProject} />,
    stats: () => (
      <StatsView
        project={project}
        onWordGoalChange={(wordGoal) => run(() => api.projects.update(project.id, { wordGoal }), 'No se pudo guardar el objetivo')}
        onDailyGoalChange={(dailyGoal) => run(() => api.projects.update(project.id, { dailyGoal }), 'No se pudo guardar el objetivo')}
      />
    )
  }

  return (
    <div className={`workspace ${focusMode ? 'is-focus' : ''}`}>
      {!focusMode && (
        <Sidebar
          project={project}
          section={section}
          onSectionChange={setSection}
          activeChapterId={activeChapterId}
          onSelectChapter={openChapter}
          onJumpToScene={(chapterId, separatorsBefore) => {
            openChapter(chapterId)
            setSceneJump({ chapterId, separatorsBefore, nonce: Date.now() })
          }}
          onExit={onExit}
          onRenameProject={(title) => run(() => api.projects.update(project.id, { title }), 'No se pudo renombrar')}
          onCreateChapter={createChapter}
          onRenameChapter={(id, title) => run(() => api.chapters.rename(project.id, id, title), 'No se pudo renombrar')}
          onDeleteChapter={async (id) => {
            await run(() => api.chapters.delete(project.id, id), 'No se pudo eliminar el capítulo')
            if (id === activeChapterId) {
              const remaining = project.chapters.filter((c) => c.id !== id)
              setActiveChapterId(remaining[0]?.id ?? null)
            }
          }}
          onReorderChapters={(ids) => {
            // Actualización optimista: se reordena ya en pantalla y luego se guarda.
            const byId = new Map(project.chapters.map((c) => [c.id, c]))
            setProject({ ...project, chapters: ids.map((id) => byId.get(id)!) })
            void run(() => api.chapters.reorder(project.id, ids), 'No se pudo reordenar')
          }}
          onSetDraft={(id, draft) =>
            run(() => api.chapters.setDraft(project.id, id, draft), draft ? 'No se pudo mover a borradores' : 'No se pudo pasar al manuscrito')
          }
          onOpenSearch={() => setDialog('search')}
          onOpenCards={() => openCards()}
          onOpenSettings={() => setDialog('settings')}
        />
      )}

      <main className="workspace-main">{views[section]()}</main>

      {dialog === 'search' && (
        <SearchDialog
          projectId={project.id}
          onClose={() => setDialog(null)}
          onOpenChapter={openChapter}
          onReplaced={(updated) => {
            setProject(updated)
            setReloadToken((n) => n + 1)
          }}
        />
      )}
      {dialog === 'cards' && <SocialCardsDialog project={project} initialText={cardText} onClose={() => setDialog(null)} />}
      {dialog === 'settings' && (
        // Tras restaurar una copia se vuelve a la biblioteca para cargar lo restaurado.
        <SettingsDialog onClose={() => setDialog(null)} onRestored={onExit} />
      )}
    </div>
  )
}
