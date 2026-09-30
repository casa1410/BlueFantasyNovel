/**
 * Exportación a PDF usando el motor de impresión de Chromium que ya trae
 * Electron: se maqueta el manuscrito como HTML en una ventana invisible y se
 * "imprime" a PDF. No necesita dependencias extra.
 *
 * El aspecto del libro (tamaño de página, tipografía, márgenes) se controla
 * con el CSS de `BOOK_STYLES`.
 */
import { BrowserWindow } from 'electron'
import { escapeHtml, toHtml } from '@shared/richText'
import type { Manuscript } from './manuscript'

const BOOK_STYLES = `
  @page { size: A5; margin: 20mm 16mm 22mm; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.55; color: #111; }
  .title-page { height: 100vh; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  .title-page h1 { font-size: 26pt; margin: 0 0 8mm; }
  .title-page .genre { font-style: italic; color: #444; }
  .title-page .description { margin-top: 12mm; font-size: 10pt; color: #333; }
  .chapter { break-before: page; }
  .chapter > h1 { text-align: center; font-size: 17pt; margin: 18mm 0 10mm; }
  p { margin: 0; text-indent: 1.2em; text-align: justify; hyphens: auto; }
  h1 + p, h2 + p, h3 + p, hr + p, blockquote p { text-indent: 0; }
  blockquote { margin: 0.8em 1.5em; font-style: italic; }
  hr { border: 0; text-align: center; margin: 1em 0; }
  hr::after { content: '* * *'; }
`

export function manuscriptToPdf(manuscript: Manuscript): Promise<Buffer> {
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(manuscript.title)}</title>
<style>${BOOK_STYLES}</style></head>
<body>
  <section class="title-page">
    <h1>${escapeHtml(manuscript.title)}</h1>
    ${manuscript.genre ? `<div class="genre">${escapeHtml(manuscript.genre)}</div>` : ''}
    ${manuscript.description ? `<div class="description">${escapeHtml(manuscript.description)}</div>` : ''}
  </section>
  ${manuscript.chapters
    .map((c) => `<section class="chapter"><h1>${escapeHtml(c.title)}</h1>${toHtml(c.doc)}</section>`)
    .join('\n')}
</body></html>`

  return htmlToPdf(html)
}

/**
 * Convierte una página HTML completa en PDF. El tamaño de página lo decide el
 * propio CSS (`@page`); si no lo indica, se usa A4.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  // Ventana oculta y sin acceso a Node: solo sirve para maquetar.
  const printer = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false }
  })
  try {
    await printer.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await printer.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true })
  } finally {
    printer.destroy()
  }
}
