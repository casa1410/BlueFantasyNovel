/**
 * Utilidades de texto puras (sin dependencias). Se usan tanto en la interfaz
 * (contador en vivo) como en el proceso principal (estadísticas al guardar),
 * así ambos cuentan exactamente igual.
 */

/**
 * Una "palabra" es una secuencia de letras o números, que puede incluir
 * apóstrofos o guiones internos ("arco-iris", "l'amour").
 * Usa clases Unicode, así que funciona con tildes, ñ, cirílico, etc.
 */
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu

export function countWords(text: string): number {
  const matches = text.match(WORD_PATTERN)
  return matches ? matches.length : 0
}

/** Formatea números con separador de miles en español: 12345 -> "12.345". */
export function formatNumber(value: number): string {
  return value.toLocaleString('es-ES')
}

/**
 * Tiempo estimado de lectura en minutos, a 230 palabras por minuto
 * (velocidad media de lectura de ficción en adultos).
 */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230))
}

/**
 * Palabras por página de una novela impresa en formato 15 × 23 cm, con letra
 * de 11 pt. Es una media: los diálogos cortos y los saltos de capítulo hacen
 * que varíe bastante.
 */
export const WORDS_PER_PAGE = 280

/** Páginas aproximadas de un texto (al menos 1 si tiene alguna palabra). */
export function approxPages(words: number): number {
  return words > 0 ? Math.max(1, Math.round(words / WORDS_PER_PAGE)) : 0
}

/** "≈ 1 página", "≈ 12 páginas". */
export function pagesLabel(words: number, short = false): string {
  const pages = approxPages(words)
  if (short) return `≈ ${pages.toLocaleString('es-ES')} pág.`
  return `≈ ${pages.toLocaleString('es-ES')} ${pages === 1 ? 'página' : 'páginas'}`
}
