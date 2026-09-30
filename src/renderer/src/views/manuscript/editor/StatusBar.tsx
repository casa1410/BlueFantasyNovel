import { AlertTriangle, Check, Flame, Loader2, Target, Timer } from 'lucide-react'
import { currentStreak, todayKey } from '@shared/dates'
import { manuscriptWordCount } from '@shared/manuscript'
import { readingMinutes } from '@shared/text'
import type { ChapterMeta, Project } from '@shared/types'
import type { SaveStatus } from '@renderer/hooks/useDebouncedSave'
import { plural } from '@renderer/lib/format'
import { formatCountdown, remainingMs, useTick, type Sprint } from './SprintButton'

interface StatusBarProps {
  project: Project
  chapter: ChapterMeta
  /** Palabras del capítulo contadas en vivo (puede no estar guardado aún). */
  liveWords: number
  saveStatus: SaveStatus
  sprint: Sprint | null
}

export function StatusBar({ project, chapter, liveWords, saveStatus, sprint }: StatusBarProps) {
  useTick(sprint !== null)
  // Mientras hay cambios sin guardar, estimamos los totales con el recuento
  // en vivo para que los números no "salten" al guardarse.
  const unsavedDelta = liveWords - chapter.wordCount
  // El total es el del manuscrito: los borradores no cuentan.
  const total = manuscriptWordCount(project.chapters) + (chapter.draft ? 0 : unsavedDelta)
  const writtenTotal = project.chapters.reduce((sum, c) => sum + c.wordCount, 0) + unsavedDelta
  const today = (project.dailyWords[todayKey()] ?? 0) + Math.max(0, unsavedDelta)
  const streak = currentStreak(today > 0 ? { ...project.dailyWords, [todayKey()]: today } : project.dailyWords)
  const goal = project.dailyGoal
  const goalProgress = goal > 0 ? Math.min(1, today / goal) : 0

  return (
    <footer className="status-bar">
      <span title="Palabras de este capítulo">
        <strong>{liveWords.toLocaleString('es-ES')}</strong> palabras · {readingMinutes(liveWords)} min de lectura
      </span>
      <span className="faint">|</span>
      <span title="Palabras del manuscrito (sin borradores)">
        {chapter.draft && <strong className="status-draft">Borrador · </strong>}
        {plural(total, 'palabra')} en el manuscrito
      </span>
      <span className="faint">|</span>
      <span title="Palabras nuevas escritas hoy" className="status-today-wrap">
        Hoy: <strong className="status-today">+{today.toLocaleString('es-ES')}</strong>
        {goal > 0 && (
          <>
            <span className="faint"> / {goal.toLocaleString('es-ES')}</span>
            <span className={`status-goal ${goalProgress >= 1 ? 'is-done' : ''}`} title={`${Math.round(goalProgress * 100)} % del objetivo diario`}>
              <span style={{ width: `${goalProgress * 100}%` }} />
            </span>
            {goalProgress >= 1 && <Target size={13} className="status-goal-icon" />}
          </>
        )}
      </span>
      {streak > 0 && (
        <span className="status-streak" title="Días seguidos escribiendo">
          <Flame size={14} />
          {plural(streak, 'día', 'días')}
        </span>
      )}
      {sprint && (
        <span className="status-sprint" title="Sprint de escritura en curso">
          <Timer size={13} /> Sprint: +{Math.max(0, writtenTotal - sprint.startWords).toLocaleString('es-ES')} · {formatCountdown(remainingMs(sprint))}
        </span>
      )}
      <div className="spacer" />
      <SaveIndicator status={saveStatus} />
    </footer>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  switch (status) {
    case 'saved':
      return (
        <span className="save-indicator is-saved">
          <Check size={14} /> Guardado
        </span>
      )
    case 'pending':
    case 'saving':
      return (
        <span className="save-indicator">
          <Loader2 size={14} className="spin" /> Guardando…
        </span>
      )
    case 'error':
      return (
        <span className="save-indicator is-error" title="Revisa que la carpeta de datos sea accesible">
          <AlertTriangle size={14} /> Error al guardar
        </span>
      )
  }
}
