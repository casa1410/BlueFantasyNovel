/**
 * Valores por defecto de cada tipo de ficha.
 *
 * Se aplican al crear una ficha y al leer un proyecto, de modo que una ficha
 * incompleta (creada por una versión antigua, por un script o editada a mano)
 * nunca rompa la interfaz: siempre tiene todos sus campos.
 *
 * Al añadir un campo a una ficha en src/shared/types.ts, añade aquí su valor
 * por defecto.
 */
import type { EntityCollection, EntityInput } from '@shared/types'

export const ENTITY_DEFAULTS: { [C in EntityCollection]: EntityInput<C> } = {
  characters: {
    name: '',
    aliases: [],
    role: 'otro',
    age: '',
    appearance: '',
    personality: '',
    motivation: '',
    fears: '',
    arc: '',
    notes: '',
    color: '#5b8cff',
    raceId: null,
    lineageId: null,
    image: ''
  },
  lore: { title: '', aliases: [], category: 'otro', summary: '', body: '', tags: [], image: '' },
  creatures: {
    name: '',
    aliases: [],
    type: 'otro',
    danger: 1,
    habitat: '',
    size: '',
    appearance: '',
    behavior: '',
    abilities: '',
    weaknesses: '',
    notes: '',
    image: ''
  },
  relationships: { sourceId: '', targetId: '', kind: 'otro', label: '', notes: '' },
  events: {
    title: '',
    description: '',
    year: 0,
    month: null,
    day: null,
    color: '#5b8cff',
    characterIds: [],
    loreIds: [],
    chapterId: null
  },
  maps: { name: '', image: '', pins: [] },
  boards: { name: '', description: '', items: [] },
  races: {
    name: '',
    aliases: [],
    appearance: '',
    lifespan: '',
    homeland: '',
    culture: '',
    abilities: '',
    notes: '',
    color: '#4fd1a5',
    image: ''
  },
  glossary: { term: '', aliases: [], definition: '', category: '' },
  lineages: { name: '', aliases: [], motto: '', description: '', seatLoreId: null, color: '#e8c46a', image: '' },
  plotlines: { name: '', description: '', color: '#5b8cff', beats: {} },
  comments: { chapterId: '', quote: '', text: '', resolved: false }
}

/** Completa los campos que falten con su valor por defecto. */
export function withEntityDefaults<C extends EntityCollection, T extends object>(collection: C, entity: T): T & EntityInput<C> {
  return { ...structuredClone(ENTITY_DEFAULTS[collection]), ...entity }
}
