import { RELATION_LABELS } from '@shared/labels'
import type { RelationshipKind } from '@shared/types'

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
