/** Formateo de fechas y textos para la interfaz (en español). */

const relativeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

/** "hace 5 minutos", "ayer", "hace 3 días"... */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'hace un momento'
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relativeFormatter.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return relativeFormatter.format(Math.round(seconds / 86400), 'day')
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "1 palabra" / "12 palabras". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString('es-ES')} ${count === 1 ? singular : pluralForm}`
}
