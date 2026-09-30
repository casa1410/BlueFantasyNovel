/**
 * Utilidades de fechas para las estadísticas de escritura.
 *
 * Todas las claves de día usan la zona horaria LOCAL del usuario: si alguien
 * escribe a las 00:30, cuenta para el día que ve en su reloj, no para UTC.
 */
import type { DayKey } from './types'

export function toDayKey(date: Date): DayKey {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): DayKey {
  return toDayKey(new Date())
}

/** Devuelve la fecha desplazada `days` días (negativo = hacia atrás). */
export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

/**
 * Racha actual: días consecutivos con al menos una palabra escrita.
 * Si hoy todavía no se ha escrito, la racha de ayer sigue "viva" (así no se
 * pierde a primera hora de la mañana).
 */
export function currentStreak(dailyWords: Record<DayKey, number>, today = new Date()): number {
  let cursor = today
  if (!(dailyWords[toDayKey(cursor)] > 0)) cursor = addDays(cursor, -1)

  let streak = 0
  while (dailyWords[toDayKey(cursor)] > 0) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** Mayor número de días consecutivos con escritura en todo el historial. */
export function longestStreak(dailyWords: Record<DayKey, number>): number {
  const days = Object.keys(dailyWords)
    .filter((key) => dailyWords[key] > 0)
    .sort()

  let best = 0
  let run = 0
  let previous: DayKey | null = null
  for (const key of days) {
    const expected = previous ? toDayKey(addDays(parseDayKey(previous), 1)) : null
    run = key === expected ? run + 1 : 1
    best = Math.max(best, run)
    previous = key
  }
  return best
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
