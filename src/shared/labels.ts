/**
 * Nombres visibles (en español) de los valores guardados en los datos.
 * Los usan la interfaz y las exportaciones (Biblia del Mundo).
 */
import type { CharacterRole, CreatureType, DangerLevel, LoreCategory, RelationshipKind } from './types'

export const ROLE_LABELS: Record<CharacterRole, string> = {
  protagonista: 'Protagonista',
  antagonista: 'Antagonista',
  secundario: 'Secundario',
  mentor: 'Mentor',
  aliado: 'Aliado',
  otro: 'Otro'
}

export const LORE_CATEGORY_LABELS: Record<LoreCategory, { label: string; plural: string }> = {
  lugar: { label: 'Lugar', plural: 'Lugares' },
  faccion: { label: 'Facción', plural: 'Facciones' },
  magia: { label: 'Magia', plural: 'Magia' },
  objeto: { label: 'Objeto', plural: 'Objetos' },
  historia: { label: 'Historia', plural: 'Historia' },
  religion: { label: 'Religión', plural: 'Religiones' },
  cultura: { label: 'Cultura', plural: 'Culturas' },
  otro: { label: 'Otro', plural: 'Otros' }
}

export const CREATURE_TYPE_LABELS: Record<CreatureType, string> = {
  bestia: 'Bestia',
  dragon: 'Dragón',
  espiritu: 'Espíritu',
  'no-muerto': 'No muerto',
  humanoide: 'Humanoide',
  constructo: 'Constructo',
  planta: 'Planta',
  aberracion: 'Aberración',
  otro: 'Otro'
}

export const DANGER_LABELS: Record<DangerLevel, string> = {
  1: 'Inofensiva',
  2: 'Precaución',
  3: 'Peligrosa',
  4: 'Letal',
  5: 'Catastrófica'
}

/** `directed`: se lee de origen a destino ("A es mentor de B"). */
export const RELATION_LABELS: Record<RelationshipKind, { label: string; directed: boolean }> = {
  progenitor: { label: 'Progenitor de', directed: true },
  pareja: { label: 'Pareja', directed: false },
  hermanos: { label: 'Hermanos', directed: false },
  familia: { label: 'Familia', directed: false },
  amistad: { label: 'Amistad', directed: false },
  amor: { label: 'Amor', directed: true },
  alianza: { label: 'Alianza', directed: false },
  mentor: { label: 'Mentor de', directed: true },
  rivalidad: { label: 'Rivalidad', directed: false },
  enemistad: { label: 'Enemistad', directed: false },
  otro: { label: 'Otra', directed: false }
}
