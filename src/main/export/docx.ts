/**
 * Exportación a Word (.docx) con la librería `docx`.
 *
 * Estructura del documento generado:
 *  - Página de título (título, género y descripción).
 *  - Cada capítulo empieza en página nueva con su título como "Título 1",
 *    de modo que Word genera el índice automáticamente si se desea.
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  type IRunOptions
} from 'docx'
import type { RichTextMark, RichTextNode } from '@shared/types'
import type { Manuscript } from './manuscript'

const ORDERED_LIST_REF = 'ordered-list'

const HEADING_BY_LEVEL = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6
} as const

export async function manuscriptToDocx(manuscript: Manuscript): Promise<Buffer> {
  const ctx: ConversionContext = { listInstance: 0 }

  const titlePage: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { before: 3000 }, children: [new TextRun(manuscript.title)] }),
    ...(manuscript.genre
      ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: manuscript.genre, italics: true })] })]
      : []),
    ...(manuscript.description
      ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [new TextRun(manuscript.description)] })]
      : [])
  ]

  const chapters = manuscript.chapters.flatMap((chapter) => [
    new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(chapter.title)] }),
    ...blocksToParagraphs(chapter.doc.content ?? [], ctx, 0)
  ])

  const document = new Document({
    title: manuscript.title,
    styles: {
      default: {
        document: {
          run: { font: 'Georgia', size: 24 }, // size en medios puntos: 24 = 12 pt
          paragraph: { spacing: { after: 160, line: 360 } } // interlineado 1,5
        }
      }
    },
    numbering: {
      config: [
        {
          reference: ORDERED_LIST_REF,
          levels: [0, 1, 2, 3].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } }
          }))
        }
      ]
    },
    sections: [{ children: [...titlePage, ...chapters] }]
  })

  return Packer.toBuffer(document)
}

interface ConversionContext {
  /** Cada lista numerada necesita su propia "instancia" para reiniciar en 1. */
  listInstance: number
}

interface BlockOptions {
  bulletLevel?: number
  numbering?: { level: number; instance: number }
  quote?: boolean
}

function blocksToParagraphs(nodes: RichTextNode[], ctx: ConversionContext, depth: number, options: BlockOptions = {}): Paragraph[] {
  return nodes.flatMap((node) => blockToParagraphs(node, ctx, depth, options))
}

function blockToParagraphs(node: RichTextNode, ctx: ConversionContext, depth: number, options: BlockOptions): Paragraph[] {
  const children = node.content ?? []
  switch (node.type) {
    case 'paragraph':
      return [
        new Paragraph({
          children: inlineToRuns(children, options.quote),
          ...(options.bulletLevel !== undefined && { bullet: { level: options.bulletLevel } }),
          ...(options.numbering && { numbering: { reference: ORDERED_LIST_REF, ...options.numbering } }),
          ...(options.quote && { indent: { left: 720, right: 720 } })
        })
      ]
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 2), 1), 6) as keyof typeof HEADING_BY_LEVEL
      return [new Paragraph({ heading: HEADING_BY_LEVEL[level], children: inlineToRuns(children) })]
    }
    case 'blockquote':
      return blocksToParagraphs(children, ctx, depth, { ...options, quote: true })
    case 'bulletList':
      return children.flatMap((item) => blocksToParagraphs(item.content ?? [], ctx, depth + 1, { bulletLevel: depth }))
    case 'orderedList': {
      const instance = ++ctx.listInstance
      return children.flatMap((item) =>
        blocksToParagraphs(item.content ?? [], ctx, depth + 1, { numbering: { level: depth, instance } })
      )
    }
    case 'horizontalRule':
      return [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('* * *')] })]
    case 'codeBlock':
      return [new Paragraph({ children: [new TextRun({ text: children.map((c) => c.text ?? '').join(''), font: 'Consolas' })] })]
    default:
      return children.length ? blocksToParagraphs(children, ctx, depth, options) : []
  }
}

function inlineToRuns(nodes: RichTextNode[], italicize = false): TextRun[] {
  return nodes.map((node) => {
    if (node.type === 'hardBreak') return new TextRun({ text: '', break: 1 })
    return new TextRun({ text: node.text ?? '', ...marksToRunOptions(node.marks ?? []), ...(italicize && { italics: true }) })
  })
}

function marksToRunOptions(marks: RichTextMark[]): Partial<IRunOptions> {
  const options: { -readonly [K in keyof IRunOptions]?: IRunOptions[K] } = {}
  for (const mark of marks) {
    if (mark.type === 'bold') options.bold = true
    if (mark.type === 'italic') options.italics = true
    if (mark.type === 'underline' || mark.type === 'link') options.underline = {}
    if (mark.type === 'strike') options.strike = true
    if (mark.type === 'code') options.font = 'Consolas'
  }
  return options
}
