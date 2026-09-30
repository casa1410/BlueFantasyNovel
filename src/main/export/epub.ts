/**
 * Exportación a ePub 3 (libros electrónicos: Kindle vía Send to Kindle,
 * Apple Books, Kobo, Google Play Libros…).
 *
 * Un ePub es un ZIP con esta estructura mínima:
 *
 *   mimetype                     "application/epub+zip" (primero y SIN comprimir)
 *   META-INF/container.xml       indica dónde está el paquete
 *   OEBPS/content.opf            metadatos, lista de archivos y orden de lectura
 *   OEBPS/nav.xhtml              índice
 *   OEBPS/style.css
 *   OEBPS/title.xhtml            portada de texto
 *   OEBPS/chapter-N.xhtml        un archivo por capítulo
 */
import { randomUUID } from 'node:crypto'
import JSZip from 'jszip'
import { escapeHtml, toHtml } from '@shared/richText'
import type { Manuscript } from './manuscript'

const STYLES = `
body { font-family: serif; line-height: 1.5; margin: 0 5%; }
h1 { text-align: center; margin: 2em 0 1.5em; font-size: 1.6em; }
p { margin: 0; text-indent: 1.3em; text-align: justify; }
h1 + p, h2 + p, h3 + p, hr + p, blockquote p { text-indent: 0; }
blockquote { margin: 1em 1.5em; font-style: italic; }
hr { border: 0; text-align: center; margin: 1.2em 0; }
hr::after { content: "* * *"; }
.title-page { text-align: center; margin-top: 30%; }
.title-page .genre { font-style: italic; }
.title-page .description { margin-top: 2em; font-size: 0.9em; }
`

function xhtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="es" xml:lang="es">
<head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${body}</body>
</html>`
}

export async function manuscriptToEpub(manuscript: Manuscript): Promise<Buffer> {
  const zip = new JSZip()
  const bookId = `urn:uuid:${randomUUID()}`
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const chapters = manuscript.chapters.map((chapter, i) => ({ ...chapter, file: `chapter-${i + 1}.xhtml`, id: `ch${i + 1}` }))

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
  )

  zip.file('OEBPS/style.css', STYLES)
  zip.file(
    'OEBPS/title.xhtml',
    xhtml(
      manuscript.title,
      `<section class="title-page" epub:type="titlepage">
  <h1>${escapeHtml(manuscript.title)}</h1>
  ${manuscript.genre ? `<p class="genre">${escapeHtml(manuscript.genre)}</p>` : ''}
  ${manuscript.description ? `<p class="description">${escapeHtml(manuscript.description)}</p>` : ''}
</section>`
    )
  )

  for (const chapter of chapters) {
    zip.file(
      `OEBPS/${chapter.file}`,
      xhtml(chapter.title, `<section epub:type="chapter"><h1>${escapeHtml(chapter.title)}</h1>${toHtml(chapter.doc)}</section>`)
    )
  }

  zip.file(
    'OEBPS/nav.xhtml',
    xhtml(
      'Índice',
      `<nav epub:type="toc" id="toc"><h1>Índice</h1><ol>
${chapters.map((c) => `  <li><a href="${c.file}">${escapeHtml(c.title)}</a></li>`).join('\n')}
</ol></nav>`
    )
  )

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="es">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${bookId}</dc:identifier>
    <dc:title>${escapeHtml(manuscript.title)}</dc:title>
    <dc:language>es</dc:language>
    ${manuscript.description ? `<dc:description>${escapeHtml(manuscript.description)}</dc:description>` : ''}
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
${chapters.map((c) => `    <item id="${c.id}" href="${c.file}" media-type="application/xhtml+xml"/>`).join('\n')}
  </manifest>
  <spine>
    <itemref idref="title"/>
${chapters.map((c) => `    <itemref idref="${c.id}"/>`).join('\n')}
  </spine>
</package>`
  )

  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip', compression: 'DEFLATE' })
}
