/**
 * Calendario del mundo: valores por defecto, orden cronológico y formato de
 * fechas de los eventos de la línea temporal.
 */
import type { TimelineEvent, WorldCalendar } from './types'

/** Calendario inicial de cualquier historia: el gregoriano, editable. */
export const DEFAULT_CALENDAR: WorldCalendar = {
  eraName: '',
  months: [
    { name: 'Enero', days: 31 },
    { name: 'Febrero', days: 28 },
    { name: 'Marzo', days: 31 },
    { name: 'Abril', days: 30 },
    { name: 'Mayo', days: 31 },
    { name: 'Junio', days: 30 },
    { name: 'Julio', days: 31 },
    { name: 'Agosto', days: 31 },
    { name: 'Septiembre', days: 30 },
    { name: 'Octubre', days: 31 },
    { name: 'Noviembre', days: 30 },
    { name: 'Diciembre', days: 31 }
  ]
}

/** Días totales de un año en el calendario. */
export function daysInYear(calendar: WorldCalendar): number {
  return Math.max(1, calendar.months.reduce((sum, m) => sum + Math.max(1, m.days), 0))
}

/**
 * Posición del evento en "años decimales" (p. ej. mitad del año 12 = 12,5).
 * Sirve para ordenar y para colocarlo en el eje de la línea temporal.
 */
export function eventPosition(event: Pick<TimelineEvent, 'year' | 'month' | 'day'>, calendar: WorldCalendar): number {
  if (event.month === null || !calendar.months[event.month]) return event.year
  const daysBefore = calendar.months.slice(0, event.month).reduce((sum, m) => sum + Math.max(1, m.days), 0)
  const day = Math.max(1, event.day ?? 1) - 1
  return event.year + (daysBefore + day) / daysInYear(calendar)
}

export function compareEvents(a: TimelineEvent, b: TimelineEvent, calendar: WorldCalendar): number {
  return eventPosition(a, calendar) - eventPosition(b, calendar) || a.title.localeCompare(b.title, 'es')
}

/** "12 de Marzo del año 340 d.C." / "Año 340 d.C." */
export function formatWorldDate(event: Pick<TimelineEvent, 'year' | 'month' | 'day'>, calendar: WorldCalendar): string {
  const era = calendar.eraName.trim() ? ` ${calendar.eraName.trim()}` : ''
  const year = `${event.year}${era}`
  const month = event.month !== null ? calendar.months[event.month]?.name : undefined
  if (!month) return `Año ${year}`
  if (event.day) return `${event.day} de ${month} del año ${year}`
  return `${month} del año ${year}`
}
