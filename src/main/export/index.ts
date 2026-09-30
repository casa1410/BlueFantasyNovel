/**
 * Punto de entrada de la exportación: pide la ruta al usuario y delega en el
 * conversor del formato elegido.
 *
 * Para añadir un formato (p. ej. RTF):
 *  1. Añádelo a `EXPORT_FORMATS` en src/shared/types.ts.
 *  2. Añade su entrada en `FORMATS` aquí abajo.
 *  3. Añade la opción en src/renderer/src/components/ExportMenu.tsx.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import { toMarkdown, toPlainText } from '@shared/richText'
import type { BibleFormat, ExportFormat, ExportResult, Id } from '@shared/types'
import type { ProjectRepository } from '../storage/ProjectRepository'
import { manuscriptToDocx } from './docx'
import { buildBibleHtml, loadBible } from './bible'
import { bibleToDocx } from './bibleDocx'
import { manuscriptToEpub } from './epub'
import { manuscriptToHtml } from './html'
import { loadManuscript, type Manuscript } from './manuscript'
import { htmlToPdf, manuscriptToPdf } from './pdf'

interface FormatDefinition {
  label: string
  extension: string
  render: (manuscript: Manuscript) => Promise<Buffer | string>
}

const FORMATS: Record<ExportFormat, FormatDefinition> = {
  docx: { label: 'Documento de Word', extension: 'docx', render: manuscriptToDocx },
  pdf: { label: 'Documento PDF', extension: 'pdf', render: manuscriptToPdf },
  epub: { label: 'Libro electrónico ePub', extension: 'epub', render: manuscriptToEpub },
  html: { label: 'Página web', extension: 'html', render: manuscriptToHtml },
  md: { label: 'Markdown', extension: 'md', render: async (m) => manuscriptToMarkdown(m) },
  txt: { label: 'Texto plano', extension: 'txt', render: async (m) => manuscriptToText(m) }
}

export async function exportProject(
  repository: ProjectRepository,
  projectId: Id,
  format: ExportFormat,
  parentWindow: BrowserWindow | null
): Promise<ExportResult> {
  const definition = FORMATS[format]
  if (!definition) throw new Error(`Formato de exportación no soportado: ${format}`)

  const manuscript = await loadManuscript(repository, projectId)
  const defaultPath = path.join(app.getPath('documents'), `${safeFileName(manuscript.title)}.${definition.extension}`)

  const dialogOptions = {
    title: 'Exportar manuscrito',
    defaultPath,
    filters: [{ name: definition.label, extensions: [definition.extension] }]
  }
  const { canceled, filePath } = parentWindow
    ? await dialog.showSaveDialog(parentWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions)
  if (canceled || !filePath) return { status: 'canceled' }

  const output = await definition.render(manuscript)
  await fs.writeFile(filePath, output, typeof output === 'string' ? 'utf8' : undefined)
  return { status: 'saved', filePath }
}

const BIBLE_FORMATS: Record<BibleFormat, { label: string; render: (data: Awaited<ReturnType<typeof loadBible>>) => Promise<Buffer | string> }> = {
  pdf: { label: 'Documento PDF', render: (data) => htmlToPdf(buildBibleHtml(data)) },
  docx: { label: 'Documento de Word', render: bibleToDocx },
  html: { label: 'Página web', render: async (data) => buildBibleHtml(data) }
}

/** Exporta la Biblia del Mundo (todo el worldbuilding) al formato elegido. */
export async function exportBible(
  repository: ProjectRepository,
  projectId: Id,
  format: BibleFormat,
  parentWindow: BrowserWindow | null
): Promise<ExportResult> {
  const definition = BIBLE_FORMATS[format]
  if (!definition) throw new Error(`Formato no soportado: ${format}`)
  const data = await loadBible(repository, projectId)
  const options = {
    title: 'Exportar Biblia del Mundo',
    defaultPath: path.join(app.getPath('documents'), `${safeFileName(`Biblia del Mundo - ${data.project.title}`)}.${format}`),
    filters: [{ name: definition.label, extensions: [format] }]
  }
  const { canceled, filePath } = parentWindow ? await dialog.showSaveDialog(parentWindow, options) : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return { status: 'canceled' }
  const output = await definition.render(data)
  await fs.writeFile(filePath, output, typeof output === 'string' ? 'utf8' : undefined)
  return { status: 'saved', filePath }
}

function manuscriptToMarkdown(manuscript: Manuscript): string {
  const parts = [`# ${manuscript.title}`]
  if (manuscript.description) parts.push(`*${manuscript.description}*`)
  for (const chapter of manuscript.chapters) {
    parts.push(`## ${chapter.title}`, toMarkdown(chapter.doc))
  }
  return parts.filter(Boolean).join('\n\n') + '\n'
}

function manuscriptToText(manuscript: Manuscript): string {
  const parts = [manuscript.title.toUpperCase()]
  if (manuscript.description) parts.push(manuscript.description)
  for (const chapter of manuscript.chapters) {
    parts.push('\n' + chapter.title.toUpperCase(), toPlainText(chapter.doc))
  }
  return parts.join('\n\n') + '\n'
}

/** Quita caracteres no permitidos en nombres de archivo de Windows. */
function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'manuscrito'
}
