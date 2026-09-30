/**
 * Mapa de actividad del último año: una columna por semana, una fila
 * por día (lunes arriba). La intensidad del azul indica cuántas palabras
 * nuevas se escribieron ese día.
 *
 * Escala secuencial de un solo tono. Como el fondo es oscuro, "más" es más
 * claro. Los umbrales se adaptan al propio historial (cuartiles de los días
 * activos), así un escritor de 300 palabras/día también ve contraste.
 */
import { useMemo } from 'react'
import { addDays, toDayKey } from '@shared/dates'
import type { DayKey } from '@shared/types'
import { useChartTooltip } from './ChartTooltip'

const WEEKS = 52
const LEVEL_COLORS = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)']
const WEEKDAY_LABELS = ['L', '', 'X', '', 'V', '', 'D']

interface Cell {
  key: DayKey
  date: Date
  words: number
  level: number
  future: boolean
}

export function ActivityHeatmap({ dailyWords }: { dailyWords: Record<DayKey, number> }) {
  const tooltip = useChartTooltip()

  const { weeks, monthLabels } = useMemo(() => buildGrid(dailyWords), [dailyWords])

  return (
    <div className="heatmap">
      <div className="heatmap-months" style={{ gridTemplateColumns: `24px repeat(${WEEKS}, minmax(0, 1fr))` }}>
        <span />
        {monthLabels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>

      <div className="heatmap-grid" style={{ gridTemplateColumns: `24px repeat(${WEEKS}, minmax(0, 1fr))` }}>
        <div className="heatmap-weekdays">
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={w} className="heatmap-week">
            {week.map((cell) => (
              <div
                key={cell.key}
                className={`heatmap-cell ${cell.future ? 'is-future' : ''}`}
                style={{ background: cell.future ? 'transparent' : LEVEL_COLORS[cell.level] }}
                aria-label={`${formatDay(cell.date)}: ${cell.words} palabras`}
                onMouseEnter={(e) =>
                  !cell.future &&
                  tooltip.show(
                    e,
                    <>
                      <strong>{cell.words.toLocaleString('es-ES')} palabras</strong>
                      <span>{formatDay(cell.date)}</span>
                    </>
                  )
                }
                onMouseLeave={tooltip.hide}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="heatmap-legend">
        <span>Menos</span>
        {LEVEL_COLORS.map((color) => (
          <span key={color} className="heatmap-cell" style={{ background: color }} />
        ))}
        <span>Más</span>
      </div>
      {tooltip.element}
    </div>
  )
}

function buildGrid(dailyWords: Record<DayKey, number>) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Empezamos en el lunes de hace WEEKS-1 semanas.
  const mondayOffset = (today.getDay() + 6) % 7
  const start = addDays(today, -mondayOffset - (WEEKS - 1) * 7)

  const thresholds = computeThresholds(Object.values(dailyWords).filter((w) => w > 0))

  const weeks: Cell[][] = []
  const monthLabels: string[] = []
  let lastMonth = -1

  for (let w = 0; w < WEEKS; w++) {
    const week: Cell[] = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d)
      const key = toDayKey(date)
      const words = dailyWords[key] ?? 0
      week.push({ key, date, words, level: levelFor(words, thresholds), future: date > today })
    }
    weeks.push(week)

    const month = week[0].date.getMonth()
    monthLabels.push(month !== lastMonth ? week[0].date.toLocaleDateString('es-ES', { month: 'short' }) : '')
    lastMonth = month
  }
  return { weeks, monthLabels }
}

/** Cortes de los niveles 1-4 según los cuartiles de los días con escritura. */
function computeThresholds(values: number[]): number[] {
  if (values.length === 0) return [1, 2, 3]
  const sorted = [...values].sort((a, b) => a - b)
  const quantile = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  return [quantile(0.25), quantile(0.5), quantile(0.75)]
}

function levelFor(words: number, [q1, q2, q3]: number[]): number {
  if (words <= 0) return 0
  if (words <= q1) return 1
  if (words <= q2) return 2
  if (words <= q3) return 3
  return 4
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}
