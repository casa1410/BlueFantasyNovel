/**
 * Nombres visibles (en español) de los valores guardados en los datos.
 * Los usan la interfaz y las exportaciones (Biblia del Mundo).
 */
import type { Character, CharacterRole, Creature, CreatureType, DangerLevel, LoreCategory, LoreEntry, Relationship, RelationshipKind } from './types'

export const ROLE_LABELS: Record<CharacterRole, string> = {
  protagonista: 'Protagonista',
  antagonista: 'Antagonista',
  secundario: 'Secundario',
  terciario: 'Terciario',
  mentor: 'Mentor',
  aliado: 'Aliado',
  otro: 'Otro'
}

/* -------------------------------------------------------------------------- */
/* Opción "Otro" con texto propio                                             */
/* -------------------------------------------------------------------------- */
//
// En las listas con "Otro" (rol, categoría de lore, tipo de criatura, tipo de
// relación) el usuario puede escribir lo que quiera. Estas funciones dan el
// texto visible: el escrito a mano si lo hay, o el de la lista.

/** Texto escrito a mano para la opción 'otro' ('' si no hay o no es 'otro'). */
function customText(value: string, custom: string | undefined): string {
  return value === 'otro' ? (custom ?? '').trim() : ''
}

export function characterRoleLabel(c: Pick<Character, 'role' | 'roleCustom'>): string {
  return customText(c.role, c.roleCustom) || ROLE_LABELS[c.role] || ROLE_LABELS.otro
}

export function loreCategoryLabel(l: Pick<LoreEntry, 'category' | 'categoryCustom'>): string {
  return customText(l.category, l.categoryCustom) || (LORE_CATEGORY_LABELS[l.category] ?? LORE_CATEGORY_LABELS.otro).label
}

export function creatureTypeLabel(c: Pick<Creature, 'type' | 'typeCustom'>): string {
  return customText(c.type, c.typeCustom) || CREATURE_TYPE_LABELS[c.type] || CREATURE_TYPE_LABELS.otro
}

/** Texto de una relación: su etiqueta, o el nombre de su tipo. */
export function relationLabel(r: Pick<Relationship, 'kind' | 'label'>): string {
  return r.label.trim() || (RELATION_LABELS[r.kind] ?? RELATION_LABELS.otro).label
}

/**
 * Clave para agrupar por categoría: la categoría fija, o `otro:<texto>` para
 * cada texto escrito a mano (sin distinguir mayúsculas).
 */
export function customGroupKey(value: string, custom: string | undefined): string {
  const text = customText(value, custom)
  return text ? `otro:${text.toLocaleLowerCase('es')}` : value
}

/**
 * Grupos en orden: los fijos de `order` (sin 'otro'), después los escritos a
 * mano por orden alfabético y al final 'otro'. `label` recibe la clave y un
 * elemento del grupo, para poder mostrar el texto tal como se escribió.
 */
export function groupWithCustom<T>(
  items: T[],
  order: readonly string[],
  keyOf: (item: T) => string,
  label: (key: string, sample: T) => string
): { key: string; label: string; items: T[] }[] {
  const byKey = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    byKey.set(key, [...(byKey.get(key) ?? []), item])
  }
  const custom = [...byKey.keys()].filter((k) => k.startsWith('otro:')).sort((a, b) => a.localeCompare(b, 'es'))
  return [...order.filter((k) => k !== 'otro'), ...custom, 'otro']
    .filter((key) => byKey.has(key))
    .map((key) => ({ key, label: label(key, byKey.get(key)![0]), items: byKey.get(key)! }))
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
