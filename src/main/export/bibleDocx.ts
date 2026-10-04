/**
 * Biblia del Mundo en Word (.docx). Mismo contenido que la versión HTML
 * (bible.ts), maquetado con estilos de Word: cada parte es un "Título 1" y
 * cada ficha un "Título 2", así Word genera el índice y el panel de navegación.
 */
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from 'docx'
import { compareEvents, formatWorldDate } from '@shared/calendar'
import { CREATURE_TYPE_LABELS, DANGER_LABELS, LORE_CATEGORY_LABELS, RELATION_LABELS, characterRoleLabel } from '@shared/labels'
import { manuscriptChapters } from '@shared/manuscript'
import { LORE_CATEGORIES, type AssetFileName, type Id } from '@shared/types'
import type { BibleData } from './bible'

export async function bibleToDocx({ project, images }: BibleData): Promise<Buffer> {
  const out: Paragraph[] = []
  const nameOf = (id: Id | null, list: { id: Id; name?: string; title?: string }[]) => {
    const item = list.find((x) => x.id === id)
    return item ? (item.name ?? item.title ?? '') : ''
  }

  const image = (file: AssetFileName, maxWidth: number) => {
    const img = images.get(file)
    if (!img) return
    const scale = Math.min(1, maxWidth / img.width)
    out.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: img.mime === 'image/png' ? 'png' : 'jpg',
            data: img.data,
            transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) }
          })
        ]
      })
    )
  }
  const part = (title: string) => out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(title)] }))
  const entry = (title: string) => out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(title)] }))
  const meta = (text: string) => text && out.push(new Paragraph({ children: [new TextRun({ text, italics: true, color: '7A6D5A' })] }))
  const field = (label: string, value: string | undefined) => {
    if (!value?.trim()) return
    out.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 18, color: '8A7A62' })] }))
    value.split('\n').forEach((line) => out.push(new Paragraph({ children: [new TextRun(line)] })))
  }

  // Portada
  if (project.cover.front.image) image(project.cover.front.image, 300)
  out.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun(project.title)] }))
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Biblia del Mundo${project.genre ? ` · ${project.genre}` : ''}`, italics: true })] }))
  if (project.description) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun(project.description)] }))

  if (project.characters.length) {
    part('Personajes')
    for (const c of project.characters) {
      entry(c.name)
      image(c.image, 160)
      meta([characterRoleLabel(c), c.age && `${c.age} años`, nameOf(c.raceId, project.races), nameOf(c.lineageId, project.lineages)].filter(Boolean).join(' · '))
      field('También conocido como', c.aliases.join(', '))
      field('Apariencia', c.appearance)
      field('Personalidad', c.personality)
      field('Motivación', c.motivation)
      field('Miedos y heridas', c.fears)
      field('Arco narrativo', c.arc)
      field(
        'Relaciones',
        project.relationships
          .filter((r) => r.sourceId === c.id || r.targetId === c.id)
          .map((r) => `${r.label || RELATION_LABELS[r.kind].label}: ${nameOf(r.sourceId === c.id ? r.targetId : r.sourceId, project.characters)}`)
          .join('\n')
      )
      field('Notas', c.notes)
    }
  }

  if (project.lineages.length) {
    part('Linajes')
    for (const l of project.lineages) {
      entry(l.name)
      image(l.image, 140)
      meta(l.motto && `«${l.motto}»`)
      field('Descripción', l.description)
      field('Sede', nameOf(l.seatLoreId, project.lore))
      field('Miembros', project.characters.filter((c) => c.lineageId === l.id).map((c) => c.name).join(', '))
    }
  }

  if (project.races.length) {
    part('Razas')
    for (const r of project.races) {
      entry(r.name)
      image(r.image, 160)
      field('Apariencia', r.appearance)
      field('Esperanza de vida', r.lifespan)
      field('Dónde viven', r.homeland)
      field('Cultura', r.culture)
      field('Habilidades', r.abilities)
      field('Notas', r.notes)
    }
  }

  if (project.lore.length) {
    part('Lore')
    for (const category of LORE_CATEGORIES) {
      for (const l of project.lore.filter((x) => x.category === category)) {
        entry(`${l.title} (${LORE_CATEGORY_LABELS[category].label})`)
        image(l.image, 400)
        meta(l.summary)
        field('Descripción', l.body)
      }
    }
  }

  if (project.glossary.length) {
    part('Glosario')
    for (const g of [...project.glossary].sort((a, b) => a.term.localeCompare(b.term, 'es'))) {
      out.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: `${g.term}${g.category ? ` (${g.category})` : ''}: `, bold: true }), new TextRun(g.definition)]
        })
      )
    }
  }

  if (project.creatures.length) {
    part('Bestiario')
    for (const c of project.creatures) {
      entry(c.name)
      image(c.image, 160)
      meta(`${CREATURE_TYPE_LABELS[c.type]} · Peligrosidad: ${DANGER_LABELS[c.danger]} (${c.danger}/5)`)
      field('Hábitat', c.habitat)
      field('Tamaño', c.size)
      field('Apariencia', c.appearance)
      field('Comportamiento', c.behavior)
      field('Habilidades', c.abilities)
      field('Debilidades', c.weaknesses)
      field('Leyendas y notas', c.notes)
    }
  }

  if (project.events.length) {
    part('Cronología')
    for (const ev of [...project.events].sort((a, b) => compareEvents(a, b, project.calendar))) {
      out.push(
        new Paragraph({
          spacing: { before: 160 },
          children: [new TextRun({ text: formatWorldDate(ev, project.calendar), italics: true, color: '7A6D5A' }), new TextRun({ text: `  ${ev.title}`, bold: true })]
        })
      )
      if (ev.description) out.push(new Paragraph({ children: [new TextRun(ev.description)] }))
    }
  }

  if (project.maps.length) {
    part('Mapas')
    for (const m of project.maps) {
      entry(m.name)
      image(m.image, 600)
      field('Lugares marcados', m.pins.map((p) => p.label || nameOf(p.loreId, project.lore)).filter(Boolean).join(', '))
    }
  }

  if (project.plotlines.length) {
    part('Tramas')
    for (const plot of project.plotlines) {
      entry(plot.name)
      if (plot.description) out.push(new Paragraph({ children: [new TextRun(plot.description)] }))
      for (const chapter of manuscriptChapters(project.chapters)) field(chapter.title, plot.beats[chapter.id])
    }
  }

  const document = new Document({
    title: `Biblia del Mundo · ${project.title}`,
    styles: { default: { document: { run: { font: 'Georgia', size: 22 } } } },
    sections: [{ children: out }]
  })
  return Packer.toBuffer(document)
}
