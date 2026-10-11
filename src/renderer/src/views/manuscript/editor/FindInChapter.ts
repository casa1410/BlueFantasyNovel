/**
 * Extensión de TipTap para Ctrl+F: busca en el capítulo abierto, resalta
 * todas las coincidencias y marca la actual. Como las muletillas, el
 * resaltado son "decoraciones": no se guarda en el documento.
 *
 * Busca dentro de cada párrafo completo, así que encuentra también frases
 * que cambian de formato a mitad ("la **torre** de cristal").
 *
 * Uso:
 *   editor.commands.setChapterSearch('torre', { caseSensitive: false, wholeWord: false })
 *   editor.commands.setChapterSearchIndex(2)
 *   findInChapterKey.getState(editor.state)   // { results, index }
 */
import { Extension } from '@tiptap/react'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { buildSearchPattern } from '@shared/search'
import type { SearchOptions } from '@shared/types'

export interface SearchRange {
  from: number
  to: number
}

interface FindState {
  query: string
  options: SearchOptions
  results: SearchRange[]
  /** Coincidencia actual (-1 si no hay ninguna). */
  index: number
  decorations: DecorationSet
}

type FindMeta = { query: string; options: SearchOptions } | { index: number }

export const findInChapterKey = new PluginKey<FindState>('findInChapter')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    findInChapter: {
      /** Busca `query` ('' = dejar de buscar y quitar el resaltado). */
      setChapterSearch: (query: string, options: SearchOptions) => ReturnType
      /** Cambia la coincidencia actual (da la vuelta al llegar al final). */
      setChapterSearchIndex: (index: number) => ReturnType
      /** Sustituye la coincidencia actual por `replacement`. */
      replaceCurrentMatch: (replacement: string) => ReturnType
      /** Sustituye todas las coincidencias (se deshace de una vez con Ctrl+Z). */
      replaceAllMatches: (replacement: string) => ReturnType
    }
  }
}

const EMPTY: Omit<FindState, 'decorations'> = { query: '', options: { caseSensitive: false, wholeWord: false }, results: [], index: -1 }

export const FindInChapter = Extension.create({
  name: 'findInChapter',

  addCommands() {
    return {
      setChapterSearch:
        (query, options) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(findInChapterKey, { query, options } satisfies FindMeta)
          return true
        },
      setChapterSearchIndex:
        (index) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(findInChapterKey, { index } satisfies FindMeta)
          return true
        },
      replaceCurrentMatch:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const find = findInChapterKey.getState(state)
          const match = find?.results[find.index]
          if (!match) return false
          if (dispatch) tr.insertText(replacement, match.from, match.to)
          return true
        },
      replaceAllMatches:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const results = findInChapterKey.getState(state)?.results ?? []
          if (results.length === 0) return false
          // De atrás hacia delante: así las posiciones pendientes no se mueven.
          if (dispatch) for (const match of [...results].reverse()) tr.insertText(replacement, match.from, match.to)
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findInChapterKey,
        state: {
          init: () => ({ ...EMPTY, decorations: DecorationSet.empty }),
          apply: (tr, previous, _old, state) => applyTransaction(tr, previous, state.doc)
        },
        props: {
          decorations: (state) => findInChapterKey.getState(state)?.decorations
        }
      })
    ]
  }
})

function applyTransaction(tr: Transaction, previous: FindState, doc: ProseMirrorNode): FindState {
  const meta = tr.getMeta(findInChapterKey) as FindMeta | undefined

  if (meta && 'query' in meta) {
    const results = search(doc, meta.query, meta.options)
    // Al escribir la búsqueda, empezar por la primera coincidencia tras el cursor.
    const after = results.findIndex((r) => r.from >= tr.selection.from)
    const index = results.length === 0 ? -1 : after >= 0 ? after : 0
    return build(doc, { query: meta.query, options: meta.options, results, index })
  }
  if (meta && 'index' in meta) {
    const count = previous.results.length
    const index = count === 0 ? -1 : ((meta.index % count) + count) % count
    return build(doc, { ...previous, index })
  }
  if (tr.docChanged && previous.query) {
    // El texto cambió (al escribir o reemplazar): se vuelve a buscar y se
    // conserva la posición en la lista lo más cerca posible.
    const results = search(doc, previous.query, previous.options)
    const index = results.length === 0 ? -1 : Math.min(Math.max(previous.index, 0), results.length - 1)
    return build(doc, { ...previous, results, index })
  }
  return previous
}

function build(doc: ProseMirrorNode, state: Omit<FindState, 'decorations'>): FindState {
  const decorations = state.results.map((r, i) =>
    Decoration.inline(r.from, r.to, { class: i === state.index ? 'find-hit is-current' : 'find-hit' })
  )
  return { ...state, decorations: DecorationSet.create(doc, decorations) }
}

/** Coincidencias en el documento, párrafo a párrafo. */
function search(doc: ProseMirrorNode, query: string, options: SearchOptions): SearchRange[] {
  const pattern = buildSearchPattern(query, options)
  if (!pattern) return []
  const results: SearchRange[] = []

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    // Texto del párrafo y, para cada carácter, su posición en el documento.
    let text = ''
    const positions: number[] = []
    node.forEach((child, offset) => {
      const start = pos + 1 + offset
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) positions.push(start + i)
        text += child.text
      } else {
        positions.push(start) // salto de línea u otro elemento: separa palabras
        text += '\n'
      }
    })
    pattern.lastIndex = 0
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
      if (m[0].length === 0) {
        pattern.lastIndex++
        continue
      }
      const end = m.index + m[0].length - 1
      results.push({ from: positions[m.index], to: positions[end] + 1 })
    }
    return false
  })
  return results
}
