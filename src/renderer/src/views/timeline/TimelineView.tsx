/**
 * Sección "Línea temporal": eventos del mundo en un eje horizontal con zoom
 * (rueda + Ctrl, o el deslizador) o como lista cronológica. Usa el
 * calendario propio de la historia (meses y era configurables).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CalendarCog, Clock, List, Maximize, Plus, Rows3 } from 'lucide-react'
import { compareEvents, formatWorldDate } from '@shared/calendar'
import type { Id, Project } from '@shared/types'
import { useToast } from '@renderer/components/Toasts'
import { useLocalPreference } from '@renderer/hooks/useLocalPreference'
import { api, errorMessage } from '@renderer/lib/api'
import { CalendarDialog } from './CalendarDialog'
import { EventPanel } from './EventPanel'
import { AXIS_Y, CARD_HEIGHT, CARD_WIDTH, LANE_GAP, fitScale, layoutTimeline, timeRange } from './timelineLayout'
import './timeline.css'

const EVENT_COLORS = ['#5b8cff', '#e8577a', '#4fd1a5', '#e8c46a', '#8e5bff', '#3fb6d9', '#f08a4b', '#b86bd9']

interface TimelineViewProps {
  project: Project
  onProjectChange: (project: Project) => void
  onOpenChapter: (chapterId: Id) => void
}

export function TimelineView({ project, onProjectChange, onOpenChapter }: TimelineViewProps) {
  const [mode, setMode] = useLocalPreference<'axis' | 'list'>('timeline.mode', 'axis')
  const [selectedId, setSelectedId] = useState<Id | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const toast = useToast()
  const { events, calendar } = project
  const selected = events.find((e) => e.id === selectedId) ?? null

  const createEvent = async () => {
    const lastYear = [...events].sort((a, b) => compareEvents(a, b, calendar)).at(-1)?.year ?? 1
    try {
      const { project: updated, entity } = await api.entities.create(project.id, 'events', {
        title: 'Nuevo evento',
        description: '',
        year: lastYear,
        month: null,
        day: null,
        color: EVENT_COLORS[events.length % EVENT_COLORS.length],
        characterIds: [],
        loreIds: [],
        chapterId: null
      })
      onProjectChange(updated)
      setSelectedId(entity.id)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="timeline">
      <header className="timeline-header">
        <h2>Línea temporal</h2>
        <div className="segmented timeline-mode">
          <button className={mode === 'axis' ? 'is-active' : ''} onClick={() => setMode('axis')}>
            <Rows3 size={14} /> Eje
          </button>
          <button className={mode === 'list' ? 'is-active' : ''} onClick={() => setMode('list')}>
            <List size={14} /> Lista
          </button>
        </div>
        <div className="spacer" />
        <button className="btn btn-sm btn-ghost" onClick={() => setCalendarOpen(true)}>
          <CalendarCog size={15} /> Calendario
        </button>
        <button className="btn btn-sm btn-primary" onClick={createEvent}>
          <Plus size={15} /> Nuevo evento
        </button>
      </header>

      <div className="timeline-body">
        {events.length === 0 ? (
          <div className="empty-state timeline-empty">
            <Clock size={44} />
            <h3>La historia de tu mundo</h3>
            <p>
              Añade batallas, nacimientos, fundaciones y profecías. Vincúlalos a personajes, lugares y capítulos para no perder
              nunca la cronología. Puedes definir tu propio calendario.
            </p>
            <button className="btn btn-primary" onClick={createEvent}>
              <Plus size={16} /> Crear primer evento
            </button>
          </div>
        ) : mode === 'axis' ? (
          <TimelineAxis project={project} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <TimelineList project={project} selectedId={selectedId} onSelect={setSelectedId} />
        )}

        {selected && (
          <EventPanel
            key={selected.id}
            project={project}
            event={selected}
            colors={EVENT_COLORS}
            onProjectChange={onProjectChange}
            onOpenChapter={onOpenChapter}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {calendarOpen && <CalendarDialog project={project} onProjectChange={onProjectChange} onClose={() => setCalendarOpen(false)} />}
    </div>
  )
}

interface SubviewProps {
  project: Project
  selectedId: Id | null
  onSelect: (id: Id) => void
}

/** Eje horizontal con zoom. */
function TimelineAxis({ project, selectedId, onSelect }: SubviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)
  const range = useMemo(() => timeRange(project.events, project.calendar), [project.events, project.calendar])

  const fit = () => {
    const width = scrollRef.current?.clientWidth ?? 900
    setScale(fitScale(range, width))
  }
  // Primera vez: ajustar al ancho disponible.
  useLayoutEffect(() => {
    if (scale === null) fit()
  })

  const geometry = useMemo(
    () => layoutTimeline(project.events, project.calendar, range, scale ?? 1),
    [project.events, project.calendar, range, scale]
  )

  // Zoom con Ctrl + rueda, manteniendo fijo el instante bajo el cursor.
  // Listener nativo NO pasivo: React registra la rueda como pasiva y no
  // permitiría evitar el zoom de toda la ventana.
  const latest = useRef({ scale, geometry })
  latest.current = { scale, geometry }
  const pendingScroll = useRef<number | null>(null)
  useEffect(() => {
    const box = scrollRef.current
    if (!box) return
    const onWheel = (e: globalThis.WheelEvent) => {
      const { scale: current, geometry: geo } = latest.current
      if (!e.ctrlKey || current === null) return
      e.preventDefault()
      const cursorX = e.clientX - box.getBoundingClientRect().left + box.scrollLeft
      pendingScroll.current = geo.toPosition(cursorX)
      setScale(Math.min(5000, Math.max(0.5, current * (e.deltaY < 0 ? 1.2 : 1 / 1.2))))
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [])
  useEffect(() => {
    if (pendingScroll.current === null || !scrollRef.current) return
    const box = scrollRef.current
    box.scrollLeft = geometry.toX(pendingScroll.current) - box.clientWidth / 2
    pendingScroll.current = null
  }, [geometry])

  return (
    <div className="timeline-axis-wrap">
      <div className="timeline-zoom">
        <span className="faint">Zoom</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={scale === null ? 0 : Math.round((Math.log(scale / 0.5) / Math.log(10000)) * 100)}
          onChange={(e) => setScale(0.5 * Math.pow(10000, Number(e.target.value) / 100))}
          aria-label="Zoom"
        />
        <button className="icon-btn" onClick={fit} title="Ajustar a la ventana">
          <Maximize size={15} />
        </button>
        <span className="faint">Ctrl + rueda para acercar</span>
      </div>
      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-canvas" style={{ width: geometry.width, height: geometry.height }}>
          <div className="timeline-axis-line" style={{ top: AXIS_Y }} />
          {geometry.ticks.map((tick, i) => (
            <div key={i} className={`timeline-tick ${tick.major ? 'is-major' : ''}`} style={{ left: tick.x, top: AXIS_Y }}>
              <span>{tick.label}</span>
            </div>
          ))}
          {geometry.placed.map(({ event, x, lane }) => {
            const top = AXIS_Y + 36 + lane * (CARD_HEIGHT + LANE_GAP)
            return (
              <div key={event.id}>
                <div className="timeline-stem" style={{ left: x, top: AXIS_Y, height: top - AXIS_Y, background: event.color }} />
                <div className="timeline-dot" style={{ left: x, top: AXIS_Y, background: event.color }} />
                <button
                  className={`timeline-card ${event.id === selectedId ? 'is-active' : ''}`}
                  style={{ left: x, top, width: CARD_WIDTH, height: CARD_HEIGHT, borderLeftColor: event.color }}
                  onClick={() => onSelect(event.id)}
                >
                  <strong>{event.title || 'Sin título'}</strong>
                  <small>{formatWorldDate(event, project.calendar)}</small>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Lista cronológica agrupada por año. */
function TimelineList({ project, selectedId, onSelect }: SubviewProps) {
  const sorted = [...project.events].sort((a, b) => compareEvents(a, b, project.calendar))
  return (
    <div className="timeline-list">
      {sorted.map((event, i) => {
        const newYear = i === 0 || sorted[i - 1].year !== event.year
        return (
          <div key={event.id}>
            {newYear && (
              <h4 className="timeline-list-year">
                Año {event.year} {project.calendar.eraName}
              </h4>
            )}
            <button className={`timeline-list-item ${event.id === selectedId ? 'is-active' : ''}`} onClick={() => onSelect(event.id)}>
              <span className="timeline-list-dot" style={{ background: event.color }} />
              <span>
                <strong>{event.title || 'Sin título'}</strong>
                <small>{formatWorldDate(event, project.calendar)}</small>
                {event.description && <p>{event.description}</p>}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
