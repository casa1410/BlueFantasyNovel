/**
 * Exportación del manuscrito a una página web autónoma (un solo archivo
 * .html con los estilos incluidos). Se puede abrir en cualquier navegador,
 * enviar por correo o subir a Google Drive y compartir el enlace.
 */
import { escapeHtml, toHtml } from '@shared/richText'
import type { Manuscript } from './manuscript'

/** Estilos de lectura compartidos por el manuscrito y la Biblia del Mundo. */
export const READING_STYLES = `
  :root { color-scheme: light; }
  body { margin: 0; background: #f6f3ec; color: #1f1b16; font: 18px/1.7 Georgia, 'Palatino Linotype', serif; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 24px 96px; }
  h1, h2, h3 { line-height: 1.25; }
  header.cover { text-align: center; padding: 64px 0 32px; }
  header.cover h1 { font-size: 2.4em; margin: 0 0 8px; }
  header.cover .genre { font-style: italic; color: #6b5d4a; }
  header.cover .description { margin-top: 24px; color: #4a4033; }
  header.cover img { max-width: 280px; border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,.25); margin-bottom: 24px; }
  nav.toc { margin: 32px 0 48px; padding: 20px 24px; background: #fffdf8; border: 1px solid #e3dccd; border-radius: 10px; }
  nav.toc ol { margin: 0; padding-left: 22px; }
  nav.toc a { color: #7a4b15; text-decoration: none; }
  section.chapter { margin-top: 72px; }
  section.chapter > h2 { text-align: center; font-size: 1.6em; margin-bottom: 1.4em; }
  p { margin: 0 0 0.9em; text-align: justify; }
  blockquote { margin: 1em 1.5em; font-style: italic; color: #4a4033; }
  hr { border: 0; text-align: center; margin: 1.6em 0; color: #8a7a62; }
  hr::after { content: '✦  ✦  ✦'; letter-spacing: .3em; }
  @media (prefers-color-scheme: dark) {
    body { background: #14161c; color: #e7e3da; }
    nav.toc { background: #1b1e26; border-color: #2c313d; }
    nav.toc a { color: #e8c46a; }
    header.cover .genre, header.cover .description, blockquote { color: #b8b0a2; }
  }
`

export async function manuscriptToHtml(manuscript: Manuscript): Promise<string> {
  const chapters = manuscript.chapters.map((c, i) => ({ ...c, anchor: `capitulo-${i + 1}` }))
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(manuscript.title)}</title><style>${READING_STYLES}</style></head>
<body><main>
  <header class="cover">
    <h1>${escapeHtml(manuscript.title)}</h1>
    ${manuscript.genre ? `<div class="genre">${escapeHtml(manuscript.genre)}</div>` : ''}
    ${manuscript.description ? `<p class="description">${escapeHtml(manuscript.description)}</p>` : ''}
  </header>
  <nav class="toc"><strong>Índice</strong><ol>
    ${chapters.map((c) => `<li><a href="#${c.anchor}">${escapeHtml(c.title)}</a></li>`).join('\n')}
  </ol></nav>
  ${chapters.map((c) => `<section class="chapter" id="${c.anchor}"><h2>${escapeHtml(c.title)}</h2>${toHtml(c.doc)}</section>`).join('\n')}
</main></body></html>`
}
