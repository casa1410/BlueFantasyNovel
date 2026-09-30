/**
 * Sprints de escritura: escribir sin parar durante un tiempo fijo.
 * El botón muestra la cuenta atrás mientras hay uno en marcha.
 * El estado del sprint vive en ProjectWorkspace (sobrevive a cambiar de capítulo).
 */
import { useEffect, useRef, useState } from 'react'
import { Square, Timer } from 'lucide-react'

export interface Sprint {
  /** Momento de inicio (ms). */
  startedAt: number
  minutes: number
  /** Palabras totales del manuscrito al empezar. */
  startWords: number
}

const DURATIONS = [10, 15, 25, 45]

export function remainingMs(sprint: Sprint, now = Date.now()): number {
  return Math.max(0, sprint.startedAt + sprint.minutes * 60_000 - now)
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Fuerza un re-render cada segundo mientras `active`. */
export function useTick(active: boolean): void {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [active])
}

interface SprintButtonProps {
  sprint: Sprint | null
  onStart: (minutes: number) => void
  onStop: () => void
}

export function SprintButton({ sprint, onStart, onStop }: SprintButtonProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useTick(sprint !== null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  if (sprint) {
    return (
      <button className="btn btn-sm sprint-running" onClick={onStop} title="Terminar el sprint ahora">
        <Square size={12} />
        {formatCountdown(remainingMs(sprint))}
      </button>
    )
  }

  return (
    <div className="dropdown" ref={rootRef}>
      <button className="icon-btn" title="Sprint de escritura" aria-label="Sprint de escritura" onClick={() => setOpen((v) => !v)}>
        <Timer size={17} />
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          <div className="dropdown-caption">Escribe sin parar durante…</div>
          {DURATIONS.map((minutes) => (
            <button
              key={minutes}
              className="dropdown-item"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onStart(minutes)
              }}
            >
              <Timer size={15} /> {minutes} minutos
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
