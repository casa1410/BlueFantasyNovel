/**
 * Marca de TipTap para los comentarios al margen.
 *
 * El fragmento comentado se guarda en el documento como
 * `{ type: 'comment', attrs: { commentId } }`. El texto del comentario vive
 * en `project.comments` (ver MarginComment en shared/types.ts).
 *
 * Las exportaciones ignoran esta marca: los comentarios nunca salen en el
 * libro. Ver `richText.ts`.
 */
import { Mark, mergeAttributes } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /** Marca la selección actual con el comentario `commentId`. */
      setComment: (commentId: string) => ReturnType
      /** Quita la marca del comentario `commentId` de todo el documento. */
      unsetComment: (commentId: string) => ReturnType
      /** Selecciona el fragmento del comentario y lo muestra en pantalla. */
      selectComment: (commentId: string) => ReturnType
    }
  }
}

/** Rango del documento marcado con un comentario (o null si ya no existe). */
export function findCommentRange(doc: ProseMirrorNode, commentId: string): { from: number; to: number } | null {
  let from = -1
  let to = -1
  doc.descendants((node, pos) => {
    if (!node.isText) return
    if (node.marks.some((m) => m.type.name === 'comment' && m.attrs.commentId === commentId)) {
      if (from < 0) from = pos
      to = pos + node.nodeSize
    }
  })
  return from >= 0 ? { from, to } : null
}

export const CommentMark = Mark.create({
  name: 'comment',
  // Al escribir justo al final del fragmento, el texto nuevo no queda comentado.
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs) => ({ 'data-comment-id': attrs.commentId })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'comment-mark' }), 0]
  },

  addCommands() {
    return {
      setComment:
        (commentId) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),
      unsetComment:
        (commentId) =>
        ({ tr, state, dispatch }) => {
          const type = state.schema.marks.comment
          state.doc.descendants((node, pos) => {
            if (!node.isText) return
            const mark = node.marks.find((m) => m.type === type && m.attrs.commentId === commentId)
            if (mark) tr.removeMark(pos, pos + node.nodeSize, mark)
          })
          if (dispatch) dispatch(tr)
          return true
        },
      selectComment:
        (commentId) =>
        ({ state, chain }) => {
          const range = findCommentRange(state.doc, commentId)
          if (!range) return false
          return chain().setTextSelection(range).scrollIntoView().run()
        }
    }
  }
})
