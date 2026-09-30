/**
 * Biblia del Mundo: documento de referencia con todo el worldbuilding de una
 * historia (personajes, relaciones, linajes, razas, lore, glosario,
 * bestiario, cronología, mapas y tramas).
 *
 * `buildBibleHtml` genera una página web autónoma (imágenes incrustadas) que
 * sirve tal cual para compartir y, con estilos de impresión, para el PDF.
 * La versión Word está en bibleDocx.ts y usa los mismos datos (`BibleData`).
 */
import { promises as fs } from 'node:fs'
import { nativeImage } from 'electron'
import { compareEvents, formatWorldDate } from '@shared/calendar'
import { CREATURE_TYPE_LABELS, DANGER_LABELS, LORE_CATEGORY_LABELS, RELATION_LABELS, ROLE_LABELS } from '@shared/labels'
import { manuscriptChapters } from '@shared/manuscript'
import { escapeHtml } from '@shared/richText'
import { LORE_CATEGORIES, type AssetFileName, type Id, type Project } from '@shared/types'
import type { ProjectRepository } from '../storage/ProjectRepository'
import { READING_STYLES } from './html'

/** Imagen lista para incrustar: PNG (o JPEG) con sus medidas. */
export interface BibleImage {
  data: Buffer
  mime: 'image/png' | 'image/jpeg'
  width: number
  height: number
}

export interface BibleData {
  project: Project
  images: Map<AssetFileName, BibleImage>
}

/** Ancho máximo de las imágenes incrustadas (reduce el peso del archivo). */
const MAX_IMAGE_WIDTH = 1200

/** Carga el proyecto y todas las imágenes que usa, redimensionadas. */
export async function loadBible(repository: ProjectRepository, projectId: Id): Promise<BibleData> {
  const project = await repository.getProject(projectId)
  const files = new Set<AssetFileName>()
  const add = (file: AssetFileName) => file && files.add(file)
  project.characters.forEach((c) => add(c.image))
  project.races.forEach((r) => add(r.image))
  project.lineages.forEach((l) => add(l.image))
  project.lore.forEach((l) => add(l.image))
  project.creatures.forEach((c) => add(c.image))
  project.maps.forEach((m) => add(m.image))
  add(project.cover.front.image)

  const images = new Map<AssetFileName, BibleImage>()
  for (const file of files) {
    try {
      // nativeImage convierte cualquier formato (webp, gif…) a PNG/JPEG, que
      // entienden todos los lectores de PDF, Word y navegadores.
      let image = nativeImage.createFromBuffer(await fs.readFile(repository.assetPath(projectId, file)))
      if (image.isEmpty()) continue
      if (image.getSize().width > MAX_IMAGE_WIDTH) image = image.resize({ width: MAX_IMAGE_WIDTH, quality: 'good' })
      const { width, height } = image.getSize()
      const isPhoto = /\.jpe?g$/i.test(file)
      images.set(file, {
        data: isPhoto ? image.toJPEG(85) : image.toPNG(),
        mime: isPhoto ? 'image/jpeg' : 'image/png',
        width,
        height
      })
    } catch (error) {
      console.error(`No se pudo leer la imagen ${file}:`, error)
    }
  }
  return { project, images }
}

const BIBLE_STYLES = `
  ${READING_STYLES}
  main { max-width: 860px; }
  h2.part { margin-top: 72px; padding-bottom: 8px; border-bottom: 2px solid #c9a86a; font-size: 1.8em; }
  article.entry { display: flex; gap: 20px; margin: 28px 0; padding-bottom: 20px; border-bottom: 1px solid #e3dccd; break-inside: avoid; }
  article.entry img { width: 140px; height: 140px; object-fit: cover; border-radius: 10px; flex-shrink: 0; }
  article.entry.round img { border-radius: 50%; }
  article.entry h3 { margin: 0 0 4px; font-size: 1.3em; }
  .meta { font-size: .85em; color: #7a6d5a; margin-bottom: 8px; }
  dl { margin: 8px 0 0; font-size: .95em; }
  dt { font-weight: bold; font-size: .8em; text-transform: uppercase; letter-spacing: .05em; color: #8a7a62; margin-top: 8px; }
  dd { margin: 2px 0 0; white-space: pre-wrap; }
  .glossary dt { font-size: 1em; text-transform: none; letter-spacing: 0; color: inherit; }
  .event { display: grid; grid-template-columns: 200px 1fr; gap: 16px; padding: 10px 0; border-bottom: 1px solid #e3dccd; break-inside: avoid; }
  .event .date { font-size: .85em; color: #7a6d5a; }
  figure.map { margin: 24px 0; break-inside: avoid; }
  figure.map img { width: 100%; border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: .9em; }
  th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #e3dccd; }
  @page { size: A4; margin: 18mm 16mm; }
  @media print {
    body { background: #fff; font-size: 11pt; }
    main { max-width: none; padding: 0; }
    h2.part { break-before: page; }
    nav.toc { break-after: page; }
  }
  @media (prefers-color-scheme: dark) {
    article.entry, .event, th, td { border-color: #2c313d; }
    .meta, .event .date, dt { color: #a89f90; }
  }
`

export function buildBibleHtml({ project, images }: BibleData): string {
  const img = (file: AssetFileName, alt: string) => {
    const image = images.get(file)
    return image ? `<img src="data:${image.mime};base64,${image.data.toString('base64')}" alt="${escapeHtml(alt)}">` : ''
  }
  const e = (text: string) => escapeHtml(text ?? '')
  const fields = (pairs: [string, string | undefined][]) => {
    const rows = pairs.filter(([, v]) => v && v.trim())
    return rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v!)}</dd>`).join('')}</dl>` : ''
  }
  const nameOf = (id: Id | null, list: { id: Id; name?: string; title?: string }[]) => {
    const item = list.find((x) => x.id === id)
    return item ? (item.name ?? item.title ?? '') : ''
  }

  const parts: { id: string; title: string; html: string }[] = []

  // Personajes
  if (project.characters.length) {
    parts.push({
      id: 'personajes',
      title: 'Personajes',
      html: project.characters
        .map((c) => {
          const relations = project.relationships
            .filter((r) => r.sourceId === c.id || r.targetId === c.id)
            .map((r) => {
              const other = nameOf(r.sourceId === c.id ? r.targetId : r.sourceId, project.characters)
              const info = RELATION_LABELS[r.kind]
              const label = r.label || info.label
              if (!info.directed) return `${label}: ${other}`
              return r.sourceId === c.id ? `${label} ${other}` : `${other} → ${label.toLowerCase()} ${c.name}`
            })
          return `<article class="entry round">${img(c.image, c.name)}<div>
            <h3>${e(c.name)}</h3>
            <div class="meta">${[ROLE_LABELS[c.role], c.age && `${e(c.age)} años`, nameOf(c.raceId, project.races), nameOf(c.lineageId, project.lineages), c.aliases.length ? `También: ${e(c.aliases.join(', '))}` : '']
              .filter(Boolean)
              .join(' · ')}</div>
            ${fields([
              ['Apariencia', c.appearance],
              ['Personalidad', c.personality],
              ['Motivación', c.motivation],
              ['Miedos y heridas', c.fears],
              ['Arco narrativo', c.arc],
              ['Relaciones', relations.join('\n')],
              ['Notas', c.notes]
            ])}</div></article>`
        })
        .join('')
    })
  }

  // Linajes
  if (project.lineages.length) {
    parts.push({
      id: 'linajes',
      title: 'Linajes',
      html: project.lineages
        .map((l) => {
          const members = project.characters.filter((c) => c.lineageId === l.id).map((c) => c.name)
          return `<article class="entry">${img(l.image, l.name)}<div><h3>${e(l.name)}</h3>
            ${l.motto ? `<div class="meta">«${e(l.motto)}»</div>` : ''}
            ${fields([
              ['Descripción', l.description],
              ['Sede', nameOf(l.seatLoreId, project.lore)],
              ['Miembros', members.join(', ')]
            ])}</div></article>`
        })
        .join('')
    })
  }

  // Razas
  if (project.races.length) {
    parts.push({
      id: 'razas',
      title: 'Razas',
      html: project.races
        .map(
          (r) => `<article class="entry">${img(r.image, r.name)}<div><h3>${e(r.name)}</h3>
          ${fields([
            ['Apariencia', r.appearance],
            ['Esperanza de vida', r.lifespan],
            ['Dónde viven', r.homeland],
            ['Cultura', r.culture],
            ['Habilidades', r.abilities],
            ['Personajes', project.characters.filter((c) => c.raceId === r.id).map((c) => c.name).join(', ')],
            ['Notas', r.notes]
          ])}</div></article>`
        )
        .join('')
    })
  }

  // Lore por categorías
  if (project.lore.length) {
    parts.push({
      id: 'lore',
      title: 'Lore',
      html: LORE_CATEGORIES.map((category) => {
        const entries = project.lore.filter((l) => l.category === category)
        if (!entries.length) return ''
        return `<h3>${e(LORE_CATEGORY_LABELS[category].plural)}</h3>${entries
          .map(
            (l) => `<article class="entry">${img(l.image, l.title)}<div><h3>${e(l.title)}</h3>
            ${l.summary ? `<div class="meta">${e(l.summary)}</div>` : ''}
            ${fields([
              ['Descripción', l.body],
              ['Etiquetas', l.tags.map((t) => `#${t}`).join(' ')]
            ])}</div></article>`
          )
          .join('')}`
      }).join('')
    })
  }

  // Glosario
  if (project.glossary.length) {
    const sorted = [...project.glossary].sort((a, b) => a.term.localeCompare(b.term, 'es'))
    parts.push({
      id: 'glosario',
      title: 'Glosario',
      html: `<dl class="glossary">${sorted
        .map((g) => `<dt>${e(g.term)}${g.category ? ` <span class="meta">(${e(g.category)})</span>` : ''}</dt><dd>${e(g.definition)}</dd>`)
        .join('')}</dl>`
    })
  }

  // Bestiario
  if (project.creatures.length) {
    parts.push({
      id: 'bestiario',
      title: 'Bestiario',
      html: project.creatures
        .map(
          (c) => `<article class="entry">${img(c.image, c.name)}<div><h3>${e(c.name)}</h3>
          <div class="meta">${e(CREATURE_TYPE_LABELS[c.type])} · Peligrosidad: ${e(DANGER_LABELS[c.danger])} (${c.danger}/5)</div>
          ${fields([
            ['Hábitat', c.habitat],
            ['Tamaño', c.size],
            ['Apariencia', c.appearance],
            ['Comportamiento', c.behavior],
            ['Habilidades', c.abilities],
            ['Debilidades', c.weaknesses],
            ['Leyendas y notas', c.notes]
          ])}</div></article>`
        )
        .join('')
    })
  }

  // Cronología
  if (project.events.length) {
    const sorted = [...project.events].sort((a, b) => compareEvents(a, b, project.calendar))
    parts.push({
      id: 'cronologia',
      title: 'Cronología',
      html: sorted
        .map((ev) => {
          const who = ev.characterIds.map((id) => nameOf(id, project.characters)).filter(Boolean)
          const chapter = project.chapters.find((c) => c.id === ev.chapterId)
          return `<div class="event"><div class="date">${e(formatWorldDate(ev, project.calendar))}</div><div>
            <strong>${e(ev.title)}</strong>${ev.description ? `<p>${e(ev.description)}</p>` : ''}
            <div class="meta">${[who.length && `Con: ${e(who.join(', '))}`, chapter && `Capítulo: ${e(chapter.title)}`].filter(Boolean).join(' · ')}</div>
          </div></div>`
        })
        .join('')
    })
  }

  // Mapas
  if (project.maps.length) {
    parts.push({
      id: 'mapas',
      title: 'Mapas',
      html: project.maps
        .map((m) => {
          const pins = m.pins.map((p) => p.label || nameOf(p.loreId, project.lore)).filter(Boolean)
          return `<figure class="map"><h3>${e(m.name)}</h3>${img(m.image, m.name)}${
            pins.length ? `<figcaption class="meta">Lugares marcados: ${e(pins.join(', '))}</figcaption>` : ''
          }</figure>`
        })
        .join('')
    })
  }

  // Tramas
  if (project.plotlines.length) {
    const chapters = manuscriptChapters(project.chapters)
    parts.push({
      id: 'tramas',
      title: 'Tramas',
      html: project.plotlines
        .map((plot) => {
          const rows = chapters
            .filter((c) => plot.beats[c.id]?.trim())
            .map((c) => `<tr><td>${e(c.title)}</td><td>${e(plot.beats[c.id])}</td></tr>`)
            .join('')
          return `<h3>${e(plot.name)}</h3>${plot.description ? `<p>${e(plot.description)}</p>` : ''}${
            rows ? `<table><thead><tr><th>Capítulo</th><th>Qué ocurre</th></tr></thead><tbody>${rows}</tbody></table>` : ''
          }`
        })
        .join('')
    })
  }

  const cover = project.cover.front.image ? img(project.cover.front.image, project.title) : ''
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Biblia del Mundo · ${e(project.title)}</title><style>${BIBLE_STYLES}</style></head>
<body><main>
  <header class="cover">
    ${cover}
    <h1>${e(project.title)}</h1>
    <div class="genre">Biblia del Mundo${project.genre ? ` · ${e(project.genre)}` : ''}</div>
    ${project.description ? `<p class="description">${e(project.description)}</p>` : ''}
  </header>
  <nav class="toc"><strong>Contenido</strong><ol>${parts.map((p) => `<li><a href="#${p.id}">${e(p.title)}</a></li>`).join('')}</ol></nav>
  ${parts.map((p) => `<h2 class="part" id="${p.id}">${e(p.title)}</h2>${p.html}`).join('\n')}
  ${parts.length === 0 ? '<p>Esta historia todavía no tiene fichas de worldbuilding.</p>' : ''}
</main></body></html>`
}
