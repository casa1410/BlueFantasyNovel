/**
 * Geometría de la línea temporal horizontal: rango visible, marcas del eje
 * y reparto de los eventos en carriles para que las tarjetas no se pisen.
 *
 * Unidad de tiempo: "años decimales" (ver `eventPosition` en shared/calendar.ts).
 */
import { eventPosition } from '@shared/calendar'
import type { TimelineEvent, WorldCalendar } from '@shared/types'

export const CARD_WIDTH = 200
export const CARD_HEIGHT = 64
export const LANE_GAP = 12
export const AXIS_Y = 44
export const PADDING_X = 60

export interface PlacedEvent {
  event: TimelineEvent
  x: number
  lane: number
}

export interface TimelineGeometry {
  start: number
  end: number
  width: number
  height: number
  placed: PlacedEvent[]
  ticks: { x: number; label: string; major: boolean }[]
  toX: (position: number) => number
  toPosition: (x: number) => number
}

/** Rango de años con un margen a cada lado. */
export function timeRange(events: TimelineEvent[], calendar: WorldCalendar): [number, number] {
  if (events.length === 0) return [0, 10]
  const positions = events.map((e) => eventPosition(e, calendar))
  const min = Math.min(...positions)
  const max = Math.max(...positions)
  const pad = Math.max(1, (max - min) * 0.08)
  return [Math.floor(min - pad), Math.ceil(max + pad)]
}

/**
 * Escala (px por año) para que todo el rango quepa en `availableWidth`,
 * dejando sitio para la tarjeta del último evento.
 */
export function fitScale(range: [number, number], availableWidth: number): number {
  return Math.max(0.5, (availableWidth - PADDING_X * 2 - CARD_WIDTH) / Math.max(1, range[1] - range[0]))
}

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]

export function layoutTimeline(
  events: TimelineEvent[],
  calendar: WorldCalendar,
  range: [number, number],
  scale: number
): TimelineGeometry {
  const [start, end] = range
  const toX = (p: number) => PADDING_X + (p - start) * scale
  const toPosition = (x: number) => start + (x - PADDING_X) / scale

  // Carriles: cada tarjeta va al primer carril donde ya haya terminado la anterior.
  const laneEnds: number[] = []
  const placed = [...events]
    .map((event) => ({ event, x: toX(eventPosition(event, calendar)) }))
    .sort((a, b) => a.x - b.x)
    .map(({ event, x }) => {
      let lane = laneEnds.findIndex((endX) => x >= endX + LANE_GAP)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = x + CARD_WIDTH
      return { event, x, lane }
    })

  // Marcas: el paso más pequeño que deje al menos 90 px entre años marcados.
  const step = STEPS.find((s) => s * scale >= 90) ?? STEPS[STEPS.length - 1]
  const era = calendar.eraName.trim()
  const ticks: TimelineGeometry['ticks'] = []
  for (let year = Math.ceil(start / step) * step; year <= end; year += step) {
    ticks.push({ x: toX(year), label: era ? `${year} ${era}` : String(year), major: true })
  }
  // Con mucho zoom, marcas de mes.
  const monthWidth = scale / Math.max(1, calendar.months.length)
  if (step === 1 && monthWidth >= 55) {
    let daysSoFar = 0
    const total = calendar.months.reduce((s, m) => s + Math.max(1, m.days), 0)
    const offsets = calendar.months.map((m) => {
      const offset = daysSoFar / total
      daysSoFar += Math.max(1, m.days)
      return { name: m.name, offset }
    })
    for (let year = Math.floor(start); year < end; year++) {
      for (const { name, offset } of offsets.slice(1)) {
        ticks.push({ x: toX(year + offset), label: name.slice(0, 3), major: false })
      }
    }
  }

  const lanes = Math.max(1, laneEnds.length)
  return {
    start,
    end,
    width: toX(end) + PADDING_X + CARD_WIDTH,
    height: AXIS_Y + 36 + lanes * (CARD_HEIGHT + LANE_GAP) + 24,
    placed,
    ticks,
    toX,
    toPosition
  }
}
