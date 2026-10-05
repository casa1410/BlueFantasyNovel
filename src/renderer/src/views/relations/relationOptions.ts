import { RELATION_LABELS, customGroupKey, relationLabel } from '@shared/labels'
import type { Relationship, RelationshipKind } from '@shared/types'

const COLORS: Record<RelationshipKind, string> = {
  progenitor: '#5b8cff',
  pareja: '#e8577a',
  hermanos: '#3fb6d9',
  familia: '#8ea8ff',
  amistad: '#4fd1a5',
  amor: '#ff7eb6',
  alianza: '#e8c46a',
  mentor: '#b86bd9',
  rivalidad: '#f08a4b',
  enemistad: '#ff4d5e',
  otro: '#9aa8cf'
}

/**
 * Nombre, color y sentido de cada tipo de relación.
 * `directed`: se dibuja con flecha (origen → destino).
 * El nombre siempre se muestra junto al color para no depender solo de él.
 */
export const RELATION_INFO = Object.fromEntries(
  (Object.keys(COLORS) as RelationshipKind[]).map((kind) => [kind, { ...RELATION_LABELS[kind], color: COLORS[kind] }])
) as Record<RelationshipKind, { label: string; color: string; directed: boolean }>

/** Color de la línea de una relación: el elegido a mano o el de su tipo. */
export function relationColor(r: Pick<Relationship, 'kind' | 'color'>): string {
  return r.color || (RELATION_INFO[r.kind] ?? RELATION_INFO.otro).color
}

/**
 * Grupo de la leyenda del mapa: el tipo de relación, y cada tipo escrito a
 * mano en "Otra" por separado (`otro:<texto>`).
 */
export function relationLegendKey(r: Pick<Relationship, 'kind' | 'label'>): string {
  return customGroupKey(r.kind, r.label)
}

/** Nombre de un grupo de la leyenda. */
export function relationLegendLabel(key: string, sample: Pick<Relationship, 'kind' | 'label'>): string {
  return key.startsWith('otro:') ? relationLabel(sample) : RELATION_INFO[key as RelationshipKind].label
}
