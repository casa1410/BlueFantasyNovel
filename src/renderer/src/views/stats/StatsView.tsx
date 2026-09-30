/**
 * Sección "Estadísticas": resumen del progreso de la historia.
 * Todos los datos salen de `project.dailyWords` y de los recuentos de
 * palabras de los capítulos; no hay nada que calcular en disco.
 */
import { useState } from 'react'
import { BookOpenText, CalendarDays, Flame, PenLine, Target, Timer, Trophy } from 'lucide-react'
import { currentStreak, longestStreak, todayKey } from '@shared/dates'
import { manuscriptChapters, manuscriptWordCount } from '@shared/manuscript'
import { formatNumber, readingMinutes } from '@shared/text'
import type { Project } from '@shared/types'
import { plural } from '@renderer/lib/format'
import { ActivityHeatmap } from './ActivityHeatmap'
import { ChapterBars } from './ChapterBars'
import './stats.css'

interface StatsViewProps {
  project: Project
  onWordGoalChange: (wordGoal: number) => void
  onDailyGoalChange: (dailyGoal: number) => void
}

export function StatsView({ project, onWordGoalChange, onDailyGoalChange }: StatsViewProps) {
  // El manuscrito no incluye los borradores.
  const totalWords = manuscriptWordCount(project.chapters)
  const chapters = manuscriptChapters(project.chapters)
  const activeDays = Object.values(project.dailyWords).filter((w) => w > 0)
  const writtenAllTime = activeDays.reduce((sum, w) => sum + w, 0)
  const averagePerDay = activeDays.length ? Math.round(writtenAllTime / activeDays.length) : 0
  const minutes = readingMinutes(totalWords)

  return (
    <div className="stats">
      <header className="stats-header">
        <h2>Estadísticas</h2>
        <p className="muted">El progreso de «{project.title}»</p>
      </header>

      <div className="stat-tiles">
        <StatTile icon={BookOpenText} label="Palabras totales" value={formatNumber(totalWords)} />
        <StatTile icon={PenLine} label="Escritas hoy" value={`+${formatNumber(project.dailyWords[todayKey()] ?? 0)}`} />
        <StatTile icon={Flame} label="Racha actual" value={plural(currentStreak(project.dailyWords), 'día', 'días')} />
        <StatTile icon={Trophy} label="Mejor racha" value={plural(longestStreak(project.dailyWords), 'día', 'días')} />
        <StatTile icon={CalendarDays} label="Media por día activo" value={formatNumber(averagePerDay)} />
        <StatTile
          icon={BookOpenText}
          label="Tiempo de lectura"
          value={minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`}
        />
      </div>

      <div className="goal-cards">
        <GoalCard
          title="Objetivo del manuscrito"
          current={totalWords}
          goal={project.wordGoal}
          onChange={onWordGoalChange}
          placeholder="p. ej. 80000"
          hint="Fija un objetivo para ver cuánto te queda. Una novela suele rondar las 60.000–100.000 palabras."
          doneText="¡Objetivo cumplido!"
        />
        <GoalCard
          title="Objetivo diario"
          current={project.dailyWords[todayKey()] ?? 0}
          goal={project.dailyGoal}
          onChange={onDailyGoalChange}
          placeholder="p. ej. 500"
          hint="Palabras nuevas al día. Verás tu progreso en la barra inferior del editor."
          doneText="¡Hoy lo has conseguido!"
        />
      </div>

      <section className="stats-card">
        <header className="stats-card-header">
          <h3>Actividad</h3>
          <span className="faint">Palabras nuevas por día · último año</span>
        </header>
        <ActivityHeatmap dailyWords={project.dailyWords} />
      </section>

      <SessionsCard project={project} />

      <section className="stats-card">
        <header className="stats-card-header">
          <h3>Palabras por capítulo</h3>
          <span className="faint">{plural(chapters.length, 'capítulo')} (sin borradores)</span>
        </header>
        <ChapterBars chapters={chapters} />
      </section>
    </div>
  )
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">
        <Icon size={14} />
        {label}
      </span>
      <span className="stat-tile-value">{value}</span>
    </div>
  )
}

interface GoalCardProps {
  title: string
  current: number
  goal: number
  onChange: (goal: number) => void
  placeholder: string
  hint: string
  doneText: string
}

/** Tarjeta de objetivo de palabras, editable. */
function GoalCard({ title, current, goal, onChange, placeholder, hint, doneText }: GoalCardProps) {
  const [draft, setDraft] = useState(goal ? String(goal) : '')
  const progress = goal > 0 ? Math.min(1, current / goal) : 0

  const commit = () => {
    const value = Math.max(0, Math.floor(Number(draft.replace(/\D/g, '')) || 0))
    if (value !== goal) onChange(value)
  }

  return (
    <section className="stats-card goal-card">
      <header className="stats-card-header">
        <h3>
          <Target size={16} /> {title}
        </h3>
        <label className="goal-input">
          <input
            className="input"
            inputMode="numeric"
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            aria-label={title}
          />
          <span className="faint">palabras</span>
        </label>
      </header>
      {goal > 0 ? (
        <>
          <div className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="muted">
            <strong className="goal-percent">{Math.round(progress * 100)} %</strong> ·{' '}
            {current >= goal ? doneText : `faltan ${formatNumber(goal - current)} palabras`}
          </p>
        </>
      ) : (
        <p className="faint">{hint}</p>
      )}
    </section>
  )
}

/** Últimos sprints de escritura. */
function SessionsCard({ project }: { project: Project }) {
  const sessions = [...project.sessions].sort((a, b) => b.start.localeCompare(a.start)).slice(0, 8)
  const totalMinutes = project.sessions.reduce((s, x) => s + x.minutes, 0)
  const totalWords = project.sessions.reduce((s, x) => s + x.words, 0)

  return (
    <section className="stats-card">
      <header className="stats-card-header">
        <h3>
          <Timer size={16} /> Sprints de escritura
        </h3>
        {project.sessions.length > 0 && (
          <span className="faint">
            {plural(project.sessions.length, 'sprint')} · media de {formatNumber(Math.round(totalWords / Math.max(1, totalMinutes)))} palabras/min
          </span>
        )}
      </header>
      {sessions.length === 0 ? (
        <p className="faint">Inicia un sprint desde el botón del cronómetro en el editor para escribir sin distracciones durante un tiempo fijo.</p>
      ) : (
        <table className="sessions-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Duración</th>
              <th>Palabras</th>
              <th>Ritmo</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.start}>
                <td>{new Date(session.start).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{Math.round(session.minutes)} min</td>
                <td>{formatNumber(session.words)}</td>
                <td>{formatNumber(Math.round(session.words / Math.max(1, session.minutes)))} /min</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
