/**
 * Extensión de TipTap que subraya en el texto los nombres de personajes,
 * entradas de lore y criaturas (y sus alias).
 *
 * Como el resaltado de muletillas, son "decoraciones": no se guardan en el
 * documento. Cada mención lleva `data-mention-kind` y `data-mention-id` para
 * que el editor pueda mostrar la ficha al pasar el ratón (ver
 * MentionHoverCard.tsx).
 *
 * Uso:
 *   editor.commands.setMentionTargets(targets, enabled)
 */
import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { createMentionMatcher, type MentionMatcher, type MentionTarget } from '@shared/mentions'

interface MentionState {
  enabled: boolean
  matcher: MentionMatcher
  decorations: DecorationSet
}

export const mentionsKey = new PluginKey<MentionState>('mentions')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mentions: {
      /** Actualiza la lista de nombres a detectar y activa/desactiva el resaltado. */
      setMentionTargets: (targets: MentionTarget[], enabled: boolean) => ReturnType
    }
  }
}

export const Mentions = Extension.create({
  name: 'mentions',

  addCommands() {
    return {
      setMentionTargets:
        (targets, enabled) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(mentionsKey, { matcher: createMentionMatcher(targets), enabled })
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<MentionState>({
        key: mentionsKey,
        state: {
          init: () => ({ enabled: false, matcher: createMentionMatcher([]), decorations: DecorationSet.empty }),
          apply: (tr, previous) => {
            const meta = tr.getMeta(mentionsKey) as { matcher: MentionMatcher; enabled: boolean } | undefined
            if (meta) return scan(tr.doc, meta.matcher, meta.enabled)
            if (previous.enabled && tr.docChanged) return scan(tr.doc, previous.matcher, true)
            return previous
          }
        },
        props: {
          decorations: (state) => mentionsKey.getState(state)?.decorations
        }
      })
    ]
  }
})

function scan(doc: ProseMirrorNode, matcher: MentionMatcher, enabled: boolean): MentionState {
  if (!enabled) return { enabled, matcher, decorations: DecorationSet.empty }
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (const match of matcher.find(node.text)) {
      const from = pos + match.index
      decorations.push(
        Decoration.inline(from, from + match.length, {
          class: `mention mention-${match.target.kind}`,
          'data-mention-kind': match.target.kind,
          'data-mention-id': match.target.id
        })
      )
    }
  })
  return { enabled, matcher, decorations: DecorationSet.create(doc, decorations) }
}
