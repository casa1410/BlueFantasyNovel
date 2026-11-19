/**
 * Resumen global de la biblioteca: palabras nuevas sumando todas las
 * historias. La racha cuenta cualquier día en que se escribió en alguna, así
 * que no se pierde por cambiar de libro. (Las estadísticas de cada historia
 * siguen en su sección «Estadísticas».)
 */
import { CalendarDays, Flame, PenLine, Trophy } from 'lucide-react'
import { addDays, currentStreak, longestStreak, toDayKey, todayKey } from '@shared/dates'
import type { DayKey, ProjectSummary } from '@shared/types'
import { plural } from '@renderer/lib/format'

const DAYS_SHOWN = 14

/** Palabras por día sumando todas las historias. */
function mergeDailyWords(projects: ProjectSummary[]): Record<DayKey, number> {
  const total: Record<DayKey, number> = {}
  for (const project of projects) {
    for (const [day, words] of Object.entries(project.dailyWords ?? {})) {
      if (words > 0) total[day] = (total[day] ?? 0) + words
    }
  }
  return total
}

export function LibraryStats({ projects }: { projects: ProjectSummary[] }) {
  const daily = mergeDailyWords(projects)
  const today = daily[todayKey()] ?? 0
  const streak = currentStreak(daily)
  const best = longestStreak(daily)
  const now = new Date()
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const date = addDays(now, i - DAYS_SHOWN + 1)
    return { date, words: daily[toDayKey(date)] ?? 0 }
  })
  const week = days.slice(-7).reduce((sum, d) => sum + d.words, 0)
  const max = Math.max(1, ...days.map((d) => d.words))
  // Historias con palabras hoy, de más a menos.
  const todayBy = projects
    .map((p) => ({ title: p.title, words: p.dailyWords?.[todayKey()] ?? 0 }))
    .filter((p) => p.words > 0)
    .sort((a, b) => b.words - a.words)

  if (!Object.keys(daily).length) return null

  return (
    <section className="library-stats" aria-label="Estadísticas de todas tus historias">
      <div className="library-stat" title={todayBy.map((p) => `${p.title}: +${p.words.toLocaleString('es-ES')}`).join('\n') || 'Aún no has escrito hoy'}>
        <span className="library-stat-label">
          <PenLine size={13} /> Hoy, en todas
        </span>
        <strong className="library-stat-value is-today">+{today.toLocaleString('es-ES')}</strong>
        <small className="faint">{todayBy.length ? plural(todayBy.length, 'historia', 'historias') : 'palabras'}</small>
      </div>
      <div className="library-stat" title="Días seguidos escribiendo en cualquier historia">
        <span className="library-stat-label">
          <Flame size={13} /> Racha
        </span>
        <strong className="library-stat-value">{plural(streak, 'día', 'días')}</strong>
        <small className="faint">{today > 0 || streak === 0 ? 'seguidos' : 'escribe hoy para seguirla'}</small>
      </div>
      <div className="library-stat">
        <span className="library-stat-label">
          <Trophy size={13} /> Mejor racha
        </span>
        <strong className="library-stat-value">{plural(best, 'día', 'días')}</strong>
      </div>
      <div className="library-stat">
        <span className="library-stat-label">
          <CalendarDays size={13} /> Últimos 7 días
        </span>
        <strong className="library-stat-value">{week.toLocaleString('es-ES')}</strong>
        <small className="faint">palabras</small>
      </div>
      <div className="library-stat library-stat-bars" aria-label={`Palabras de los últimos ${DAYS_SHOWN} días`}>
        <span className="library-stat-label">Últimos {DAYS_SHOWN} días</span>
        <div className="library-bars">
          {days.map(({ date, words }) => (
            <span
              key={toDayKey(date)}
              className={`library-bar ${words > 0 ? 'has-words' : ''}`}
              style={{ height: `${Math.max(6, (words / max) * 100)}%` }}
              title={`${date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}: ${words.toLocaleString('es-ES')} palabras`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
