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
