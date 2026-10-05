/**
 * Tarjeta flotante con el resumen de una ficha al pasar el ratón por una
 * mención en el texto.
 */
import { createPortal } from 'react-dom'
import { BookA, Crown } from 'lucide-react'
import type { Id, MentionableCollection, Project } from '@shared/types'
import { EntityThumb } from '@renderer/components/EntityThumb'
import { initials } from '@renderer/lib/covers'
import { DANGER_LABELS, creatureTypeLabel } from '../../bestiary/bestiaryOptions'
import { characterRoleLabel } from '../../characters/characterOptions'
import { loreCategoryInfo } from '../../lore/loreOptions'

export interface HoveredMention {
  kind: MentionableCollection
  id: Id
  /** Rectángulo de la palabra en pantalla, para colocar la tarjeta debajo. */
  rect: DOMRect
}

/** Ancho de la tarjeta (debe coincidir con .mention-card en manuscript.css). */
const CARD_WIDTH = 300

export function MentionHoverCard({ project, mention }: { project: Project; mention: HoveredMention }) {
  const content = describe(project, mention)
  if (!content) return null

  const left = Math.min(Math.max(8, mention.rect.left), window.innerWidth - CARD_WIDTH - 8)
  const below = mention.rect.bottom + 8
  const style = below + 220 > window.innerHeight ? { left, bottom: window.innerHeight - mention.rect.top + 8 } : { left, top: below }

  return createPortal(
    <div className="mention-card" style={style} role="tooltip">
      <header>
        {content.thumb}
        <div>
          <strong>{content.name}</strong>
          <small>{content.subtitle}</small>
        </div>
      </header>
      {content.lines.map(({ label, value }) => (
        <p key={label}>
          <span>{label}</span> {value}
        </p>
      ))}
    </div>,
    document.body
  )
}

function describe(project: Project, { kind, id }: HoveredMention) {
  const clip = (text: string) => (text.length > 140 ? `${text.slice(0, 140)}…` : text)
  const lines = (pairs: [string, string][]) =>
    pairs.filter(([, v]) => v.trim()).slice(0, 3).map(([label, value]) => ({ label, value: clip(value) }))

  if (kind === 'characters') {
    const c = project.characters.find((x) => x.id === id)
    if (!c) return null
    return {
      name: c.name,
      subtitle: [characterRoleLabel(c), c.age && `${c.age} años`].filter(Boolean).join(' · '),
      thumb: <EntityThumb projectId={project.id} image={c.image} color={c.color} fallback={initials(c.name)} size={40} />,
      lines: lines([
        ['Apariencia', c.appearance],
        ['Personalidad', c.personality],
        ['Motivación', c.motivation]
      ])
    }
  }
  if (kind === 'lore') {
    const l = project.lore.find((x) => x.id === id)
    if (!l) return null
    const { icon: Icon, color, label } = loreCategoryInfo(l)
    return {
      name: l.title,
      subtitle: label,
      thumb: (
        <EntityThumb projectId={project.id} image={l.image} shape="rounded" color={`${color}33`} size={40} fallback={<Icon size={18} color={color} />} />
      ),
      lines: lines([['Resumen', l.summary || l.body]])
    }
  }
  if (kind === 'races') {
    const r = project.races.find((x) => x.id === id)
    if (!r) return null
    return {
      name: r.name,
      subtitle: ['Raza', r.lifespan].filter(Boolean).join(' · '),
      thumb: <EntityThumb projectId={project.id} image={r.image} color={r.color} shape="rounded" size={40} fallback={initials(r.name)} />,
      lines: lines([
        ['Apariencia', r.appearance],
        ['Cultura', r.culture],
        ['Habilidades', r.abilities]
      ])
    }
  }
  if (kind === 'lineages') {
    const l = project.lineages.find((x) => x.id === id)
    if (!l) return null
    const members = project.characters.filter((c) => c.lineageId === l.id).map((c) => c.name)
    return {
      name: l.name,
      subtitle: l.motto ? `«${l.motto}»` : 'Linaje',
      thumb: <EntityThumb projectId={project.id} image={l.image} color={l.color} shape="rounded" size={40} fallback={<Crown size={18} />} />,
      lines: lines([
        ['Miembros', members.join(', ')],
        ['Historia', l.description]
      ])
    }
  }
  if (kind === 'glossary') {
    const g = project.glossary.find((x) => x.id === id)
    if (!g) return null
    return {
      name: g.term,
      subtitle: g.category || 'Glosario',
      thumb: <EntityThumb projectId={project.id} image="" shape="rounded" size={40} fallback={<BookA size={18} />} />,
      lines: lines([['Definición', g.definition]])
    }
  }
  const c = project.creatures.find((x) => x.id === id)
  if (!c) return null
  return {
    name: c.name,
    subtitle: `${creatureTypeLabel(c)} · ${DANGER_LABELS[c.danger]}`,
    thumb: <EntityThumb projectId={project.id} image={c.image} shape="rounded" size={40} fallback={initials(c.name)} />,
    lines: lines([
      ['Hábitat', c.habitat],
      ['Habilidades', c.abilities],
      ['Debilidades', c.weaknesses]
    ])
  }
}
