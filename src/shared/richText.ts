/**
 * Conversión del texto enriquecido (JSON de TipTap/ProseMirror) a otros
 * formatos: texto plano, Markdown y HTML.
 *
 * Nodos soportados: doc, paragraph, heading, blockquote, bulletList,
 * orderedList, listItem, horizontalRule, hardBreak, codeBlock, text.
 * Marcas soportadas: bold, italic, underline, strike, code, link.
 *
 * Si activas una extensión nueva en el editor que añade nodos o marcas,
 * añade aquí su conversión; si no, su contenido se exportará como texto
 * plano (nunca se pierde texto, solo el formato).
 */
import type { RichTextMark, RichTextNode } from './types'

export function emptyDoc(): RichTextNode {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

/* -------------------------------------------------------------------------- */
/* Texto plano                                                                */
/* -------------------------------------------------------------------------- */

/** Nodos que contienen otros bloques: sus hijos se separan con línea en blanco. */
const CONTAINER_TYPES = new Set(['doc', 'blockquote', 'bulletList', 'orderedList', 'listItem'])

/** Extrae el texto sin formato. Los bloques se separan con una línea en blanco. */
export function toPlainText(node: RichTextNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'horizontalRule') return '* * *'

  const separator = CONTAINER_TYPES.has(node.type) ? '\n\n' : ''
  return (node.content ?? []).map(toPlainText).join(separator)
}

/* -------------------------------------------------------------------------- */
/* Markdown                                                                   */
/* -------------------------------------------------------------------------- */

export function toMarkdown(doc: RichTextNode): string {
  return (doc.content ?? []).map((block) => blockToMarkdown(block)).join('\n\n').trim()
}

function blockToMarkdown(node: RichTextNode): string {
  const children = node.content ?? []
  switch (node.type) {
    case 'paragraph':
      return inlineToMarkdown(children)
    case 'heading': {
      const level = Number(node.attrs?.level ?? 1)
      return `${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${inlineToMarkdown(children)}`
    }
    case 'blockquote':
      return children
        .map(blockToMarkdown)
        .join('\n\n')
        .split('\n')
        .map((line) => `> ${line}`.trimEnd())
        .join('\n')
    case 'bulletList':
      return children.map((item) => listItemToMarkdown(item, '- ')).join('\n')
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1)
      return children.map((item, i) => listItemToMarkdown(item, `${start + i}. `)).join('\n')
    }
    case 'horizontalRule':
      return '* * *'
    case 'codeBlock':
      return '```\n' + children.map((c) => c.text ?? '').join('') + '\n```'
    default:
      return children.length ? children.map(blockToMarkdown).join('\n\n') : (node.text ?? '')
  }
}

function listItemToMarkdown(item: RichTextNode, bullet: string): string {
  const indent = ' '.repeat(bullet.length)
  const body = (item.content ?? []).map(blockToMarkdown).join('\n')
  return bullet + body.split('\n').join('\n' + indent)
}

function inlineToMarkdown(nodes: RichTextNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '  \n'
      if (node.type !== 'text') return toPlainText(node)
      return applyMarkdownMarks(escapeMarkdown(node.text ?? ''), node.marks ?? [])
    })
    .join('')
}

function applyMarkdownMarks(text: string, marks: RichTextMark[]): string {
  let result = text
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`
        break
      case 'italic':
        result = `*${result}*`
        break
      case 'strike':
        result = `~~${result}~~`
        break
      case 'code':
        result = `\`${result}\``
        break
      case 'underline':
        // Markdown no tiene subrayado estándar; se usa HTML en línea.
        result = `<u>${result}</u>`
        break
      case 'link':
        result = `[${result}](${String(mark.attrs?.href ?? '')})`
        break
    }
  }
  return result
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]#])/g, '\\$1')
}

/* -------------------------------------------------------------------------- */
/* HTML                                                                       */
/* -------------------------------------------------------------------------- */

export function toHtml(node: RichTextNode): string {
  const children = (node.content ?? []).map(toHtml).join('')
  switch (node.type) {
    case 'doc':
      return children
    case 'text':
      return applyHtmlMarks(escapeHtml(node.text ?? ''), node.marks ?? [])
    case 'paragraph':
      return `<p>${children}</p>`
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6)
      return `<h${level}>${children}</h${level}>`
    }
    case 'blockquote':
      return `<blockquote>${children}</blockquote>`
    case 'bulletList':
      return `<ul>${children}</ul>`
    case 'orderedList':
      return `<ol start="${Number(node.attrs?.start ?? 1)}">${children}</ol>`
    case 'listItem':
      return `<li>${children}</li>`
    case 'horizontalRule':
      return '<hr />'
    case 'hardBreak':
      return '<br />'
    case 'codeBlock':
      return `<pre><code>${children}</code></pre>`
    default:
      return children
  }
}

function applyHtmlMarks(html: string, marks: RichTextMark[]): string {
  let result = html
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `<strong>${result}</strong>`
        break
      case 'italic':
        result = `<em>${result}</em>`
        break
      case 'underline':
        result = `<u>${result}</u>`
        break
      case 'strike':
        result = `<s>${result}</s>`
        break
      case 'code':
        result = `<code>${result}</code>`
        break
      case 'link':
        result = `<a href="${escapeHtml(String(mark.attrs?.href ?? ''))}">${result}</a>`
        break
    }
  }
  return result
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
