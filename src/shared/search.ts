/**
 * Patrón de búsqueda común: lo usan la búsqueda en todo el manuscrito
 * (proceso principal), Ctrl+F dentro del capítulo (editor) y el cambio de
 * nombre masivo.
 */
import type { SearchOptions } from './types'

/**
 * Letras que se buscan con o sin tilde/diéresis. La ñ no está: en español es
 * otra letra ("año" no es "ano").
 */
const ACCENT_VARIANTS: Record<string, string> = {
  a: 'aáàâäãå',
  e: 'eéèêë',
  i: 'iíìîï',
  o: 'oóòôöõ',
  u: 'uúùûü',
  c: 'cç',
  y: 'yýÿ'
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Letra sin tilde ("á" → "a"), salvo la ñ. */
function baseLetter(char: string): string {
  if (char === 'ñ' || char === 'Ñ') return char
  return char.normalize('NFD').replace(/\p{M}/gu, '')
}

/** Patrón que acepta cada vocal con o sin tilde ("angel" ↔ "Ángel"). */
function accentInsensitive(text: string): string {
  let source = ''
  for (const char of text.normalize('NFC')) {
    const base = baseLetter(char)
    const variants = ACCENT_VARIANTS[base.toLowerCase()]
    if (base.length === 1 && variants) {
      // Misma caja que la letra escrita (si se distingue mayúsculas); \p{M}*
      // por si el texto trae la tilde como carácter aparte (texto pegado).
      source += `[${base === base.toLowerCase() ? variants : variants.toUpperCase()}]\\p{M}*`
    } else {
      source += escape(char)
    }
  }
  return source
}

/** Expresión regular para `query`, o null si está vacía. Escapa los caracteres especiales. */
export function buildSearchPattern(query: string, options: SearchOptions): RegExp | null {
  const trimmed = query.trim()
  if (!trimmed) return null
  let source = options.exactAccents ? escape(trimmed) : accentInsensitive(trimmed)
  if (options.wholeWord) source = `(?<![\\p{L}\\p{N}])${source}(?![\\p{L}\\p{N}\\p{M}])`
  return new RegExp(source, options.caseSensitive ? 'gu' : 'giu')
}
