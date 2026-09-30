/**
 * Reglas del manuscrito compartidas por la interfaz y el proceso principal.
 *
 * - Los capítulos marcados como borrador NO forman parte del manuscrito:
 *   no se exportan ni cuentan para el total ni para el objetivo.
 * - Las escenas se delimitan con el separador de escena (línea horizontal).
 */
import { countWords } from './text'
import { toPlainText } from './richText'
import type { ChapterMeta, RichTextNode, SceneMeta } from './types'

/** Capítulos del manuscrito, en orden (sin borradores). */
export function manuscriptChapters<T extends Pick<ChapterMeta, 'draft'>>(chapters: T[]): T[] {
  return chapters.filter((c) => !c.draft)
}

/** Palabras del manuscrito (sin borradores). */
export function manuscriptWordCount(chapters: Pick<ChapterMeta, 'draft' | 'wordCount'>[]): number {
  return manuscriptChapters(chapters).reduce((sum, c) => sum + c.wordCount, 0)
}

const TITLE_WORDS = 6

/**
 * Divide un documento en escenas por sus separadores. Un capítulo sin
 * separadores es una única escena. Las escenas vacías (p. ej. un separador al
 * final) se ignoran.
 */
export function computeScenes(doc: RichTextNode): SceneMeta[] {
  const groups: RichTextNode[][] = [[]]
  for (const block of doc.content ?? []) {
    if (block.type === 'horizontalRule') groups.push([])
    else groups[groups.length - 1].push(block)
  }
  return groups
    .map((blocks, separatorsBefore) => {
      const text = blocks.map(toPlainText).join('\n').trim()
      if (!text) return null
      const first = blocks.find((b) => toPlainText(b).trim())
      const title =
        first?.type === 'heading'
          ? toPlainText(first).trim()
          : text.split(/\s+/).slice(0, TITLE_WORDS).join(' ') + (countWords(text) > TITLE_WORDS ? '…' : '')
      return { title, wordCount: countWords(text), separatorsBefore }
    })
    .filter((scene): scene is SceneMeta => scene !== null)
}
