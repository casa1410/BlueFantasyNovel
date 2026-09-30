/**
 * Extensión de TipTap que resalta muletillas en el texto.
 *
 * Funciona con "decoraciones" de ProseMirror: el resaltado es solo visual y
 * NO se guarda en el documento. Mientras está desactivada no consume nada.
 *
 * Uso:
 *   editor.commands.setFillerHighlight(true)
 *   fillerWordsKey.getState(editor.state)?.count   // nº de muletillas
 */
import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { DEFAULT_FILLER_WORDS } from './fillerWordList'

interface FillerState {
  enabled: boolean
  decorations: DecorationSet
  count: number
}

export const fillerWordsKey = new PluginKey<FillerState>('fillerWords')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fillerWords: {
      /** Activa o desactiva el resaltado de muletillas. */
      setFillerHighlight: (enabled: boolean) => ReturnType
    }
  }
}

export interface FillerWordsOptions {
  words: string[]
}

export const FillerWords = Extension.create<FillerWordsOptions>({
  name: 'fillerWords',

  addOptions() {
    return { words: DEFAULT_FILLER_WORDS }
  },

  addCommands() {
    return {
      setFillerHighlight:
        (enabled) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(fillerWordsKey, { enabled })
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    const pattern = buildPattern(this.options.words)

    return [
      new Plugin<FillerState>({
        key: fillerWordsKey,
        state: {
          init: (_config, state) => scan(state.doc, pattern, false),
          apply: (tr, previous) => {
            const meta = tr.getMeta(fillerWordsKey) as { enabled: boolean } | undefined
            const enabled = meta ? meta.enabled : previous.enabled
            // Solo se vuelve a analizar si cambia el interruptor o el texto.
            if (meta || (enabled && tr.docChanged)) return scan(tr.doc, pattern, enabled)
            return previous
          }
        },
        props: {
          decorations: (state) => fillerWordsKey.getState(state)?.decorations
        }
      })
    ]
  }
})

/**
 * Construye una única expresión regular con todas las palabras. Se ordenan
 * de más larga a más corta para que "de repente" gane a "de".
 * Los límites usan clases Unicode para no marcar "muy" dentro de "muymuy" ni
 * "algo" dentro de "algodón".
 */
function buildPattern(words: string[]): RegExp {
  const alternatives = [...new Set(words.map((w) => w.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
    .join('|')
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'giu')
}

function scan(doc: ProseMirrorNode, pattern: RegExp, enabled: boolean): FillerState {
  if (!enabled) return { enabled, decorations: DecorationSet.empty, count: 0 }

  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    pattern.lastIndex = 0
    for (let match = pattern.exec(node.text); match; match = pattern.exec(node.text)) {
      const from = pos + match.index
      decorations.push(
        Decoration.inline(from, from + match[0].length, {
          class: 'filler-word',
          title: 'Posible muletilla'
        })
      )
    }
  })
  return { enabled, decorations: DecorationSet.create(doc, decorations), count: decorations.length }
}
