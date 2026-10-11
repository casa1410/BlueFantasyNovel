/**
 * Patrón de búsqueda común: lo usan la búsqueda en todo el manuscrito
 * (proceso principal) y Ctrl+F dentro del capítulo (editor).
 */
import type { SearchOptions } from './types'

/** Expresión regular para `query`, o null si está vacía. Escapa los caracteres especiales. */
export function buildSearchPattern(query: string, options: SearchOptions): RegExp | null {
  const trimmed = query.trim()
  if (!trimmed) return null
  let source = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (options.wholeWord) source = `(?<![\\p{L}\\p{N}])${source}(?![\\p{L}\\p{N}])`
  return new RegExp(source, options.caseSensitive ? 'gu' : 'giu')
}
