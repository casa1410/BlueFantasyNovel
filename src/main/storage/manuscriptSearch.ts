/**
 * Buscar y reemplazar dentro del texto de los capítulos (JSON de TipTap).
 *
 * Limitación conocida: se busca dentro de cada tramo de texto con el mismo
 * formato. Una frase que cambie de formato a mitad ("la **torre** de cristal")
 * no se encuentra como un todo; sí se encuentra cada parte por separado.
 */
import type { RichTextNode, SearchMatch, SearchOptions } from '@shared/types'

/** Caracteres de contexto que se muestran a cada lado de una coincidencia. */
const CONTEXT = 40
/** Máximo de coincidencias que se devuelven por capítulo (el resto solo se cuenta). */
const MAX_MATCHES_PER_CHAPTER = 50

export function buildSearchPattern(query: string, options: SearchOptions): RegExp | null {
  const trimmed = query.trim()
  if (!trimmed) return null
  let source = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (options.wholeWord) source = `(?<![\\p{L}\\p{N}])${source}(?![\\p{L}\\p{N}])`
  return new RegExp(source, options.caseSensitive ? 'gu' : 'giu')
}

/** Recorre los nodos de texto de un documento. */
function forEachTextNode(node: RichTextNode, visit: (node: RichTextNode) => void): void {
  if (node.type === 'text') visit(node)
  node.content?.forEach((child) => forEachTextNode(child, visit))
}

export function findInDoc(doc: RichTextNode, pattern: RegExp): { matches: SearchMatch[]; total: number } {
  const matches: SearchMatch[] = []
  let total = 0
  forEachTextNode(doc, (node) => {
    const text = node.text ?? ''
    pattern.lastIndex = 0
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
      total++
      if (matches.length < MAX_MATCHES_PER_CHAPTER) {
        matches.push({
          before: text.slice(Math.max(0, m.index - CONTEXT), m.index),
          match: m[0],
          after: text.slice(m.index + m[0].length, m.index + m[0].length + CONTEXT)
        })
      }
      if (m[0].length === 0) pattern.lastIndex++
    }
  })
  return { matches, total }
}

/** Devuelve una copia del documento con las sustituciones y cuántas se hicieron. */
export function replaceInDoc(doc: RichTextNode, pattern: RegExp, replacement: string): { doc: RichTextNode; count: number } {
  const copy = structuredClone(doc)
  let count = 0
  forEachTextNode(copy, (node) => {
    const text = node.text ?? ''
    // Función como reemplazo: así "$1" o "$&" en el texto del usuario son literales.
    node.text = text.replace(pattern, () => {
      count++
      return replacement
    })
  })
  // Un reemplazo vacío puede dejar nodos de texto vacíos, que ProseMirror no admite.
  pruneEmptyText(copy)
  return { doc: copy, count }
}

function pruneEmptyText(node: RichTextNode): void {
  if (!node.content) return
  node.content = node.content.filter((child) => child.type !== 'text' || (child.text ?? '') !== '')
  node.content.forEach(pruneEmptyText)
}
