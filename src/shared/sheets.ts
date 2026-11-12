/**
 * Cuadros de texto de las fichas (Apariencia, Personalidad, Habilidades…).
 *
 * Cada historia guarda una plantilla por sección (`project.sheetTemplates`):
 * qué cuadros se ven, en qué orden y con qué nombre. Hay dos clases:
 *
 *  - Cuadros de serie: su texto vive en un campo propio de la ficha
 *    (`character.appearance`…). Se pueden renombrar, reordenar y ocultar,
 *    pero no borrar: ocultarlo no borra su texto.
 *  - Cuadros añadidos: su texto vive en `ficha.extra[id]` (id `custom:…`).
 *    Se pueden borrar; al borrarlos se borra también su texto.
 *
 * Las fichas, la Biblia del Mundo y el panel de referencia leen la misma
 * plantilla, así que todos muestran lo mismo.
 */
import type { Character, Creature, Lineage, Race } from './types'

/** Secciones con cuadros configurables. */
export const SHEET_COLLECTIONS = ['characters', 'creatures', 'races', 'lineages'] as const
export type SheetCollection = (typeof SHEET_COLLECTIONS)[number]

export interface SheetField {
  /** Campo de la ficha (cuadros de serie) o `custom:<uuid>` (añadidos). */
  id: string
  label: string
  /** Texto de ayuda dentro del cuadro vacío. */
  hint: string
  /** Oculto en la ficha y en las exportaciones (solo cuadros de serie). */
  hidden: boolean
  /** Ocupa todo el ancho (texto largo). */
  wide: boolean
}

export type SheetTemplates = Record<SheetCollection, SheetField[]>

type Builtin = Omit<SheetField, 'hidden'>

/** Cuadros de serie de cada sección, en su orden original. */
export const BUILTIN_FIELDS: Record<SheetCollection, Builtin[]> = {
  characters: [
    { id: 'appearance', label: 'Apariencia', hint: 'Rasgos físicos, forma de vestir, gestos reconocibles.', wide: false },
    { id: 'personality', label: 'Personalidad', hint: 'Carácter, virtudes, defectos, cómo habla.', wide: false },
    { id: 'motivation', label: 'Motivación', hint: '¿Qué quiere? ¿Qué necesita de verdad (aunque no lo sepa)?', wide: false },
    { id: 'fears', label: 'Miedos y heridas', hint: '¿Qué le aterra? ¿Qué pasado le pesa?', wide: false },
    { id: 'arc', label: 'Arco narrativo', hint: 'Cómo empieza, qué le cambia y cómo termina.', wide: false },
    { id: 'notes', label: 'Notas', hint: 'Cualquier otra cosa: relaciones, secretos, frases típicas…', wide: false }
  ],
  creatures: [
    { id: 'appearance', label: 'Apariencia', hint: 'Forma, color, olor, sonidos que emite…', wide: false },
    { id: 'behavior', label: 'Comportamiento', hint: '¿Caza en manada? ¿Es territorial? ¿Cuándo aparece?', wide: false },
    { id: 'abilities', label: 'Habilidades', hint: 'Poderes, ataques, sentidos especiales.', wide: false },
    { id: 'weaknesses', label: 'Debilidades', hint: 'Qué la hiere, qué teme, cómo evitarla.', wide: false },
    { id: 'notes', label: 'Leyendas y notas', hint: 'Mitos, avistamientos, relación con otras especies o pueblos…', wide: true }
  ],
  races: [
    { id: 'appearance', label: 'Apariencia', hint: 'Rasgos físicos, altura, color de piel, ojos…', wide: false },
    { id: 'culture', label: 'Cultura y sociedad', hint: 'Costumbres, gobierno, creencias, relación con otros pueblos.', wide: false },
    { id: 'abilities', label: 'Habilidades', hint: 'Dones, magia innata, debilidades.', wide: false },
    { id: 'notes', label: 'Notas', hint: 'Historia, idioma, secretos…', wide: false }
  ],
  lineages: [
    { id: 'description', label: 'Historia del linaje', hint: 'Origen, alianzas, enemistades, momentos de gloria y de caída…', wide: true }
  ]
}

export const CUSTOM_PREFIX = 'custom:'
export const isCustomField = (id: string) => id.startsWith(CUSTOM_PREFIX)

export function defaultSheetTemplates(): SheetTemplates {
  return Object.fromEntries(
    SHEET_COLLECTIONS.map((c) => [c, BUILTIN_FIELDS[c].map((f) => ({ ...f, hidden: false }))])
  ) as SheetTemplates
}

/**
 * Plantillas válidas a partir de lo guardado (o de lo que envía la interfaz):
 * descarta lo que no encaja, no repite cuadros y añade al final los cuadros
 * de serie que falten (p. ej. uno nuevo de una versión posterior).
 */
export function completeSheetTemplates(raw: unknown): SheetTemplates {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<SheetCollection, unknown>>
  const result = {} as SheetTemplates
  for (const collection of SHEET_COLLECTIONS) {
    const builtins = new Map(BUILTIN_FIELDS[collection].map((f) => [f.id, f]))
    const seen = new Set<string>()
    const fields: SheetField[] = []
    const list = Array.isArray(source[collection]) ? (source[collection] as Partial<SheetField>[]) : []
    for (const item of list) {
      const id = typeof item?.id === 'string' ? item.id : ''
      if (!id || seen.has(id)) continue
      const builtin = builtins.get(id)
      if (!builtin && !/^custom:[a-zA-Z0-9-]{1,64}$/.test(id)) continue
      seen.add(id)
      const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim().slice(0, 80) : (builtin?.label ?? 'Sin nombre')
      fields.push({
        id,
        label,
        hint: typeof item.hint === 'string' ? item.hint.slice(0, 200) : (builtin?.hint ?? ''),
        // Solo los de serie se ocultan; los añadidos se borran.
        hidden: Boolean(builtin && item.hidden),
        wide: typeof item.wide === 'boolean' ? item.wide : (builtin?.wide ?? false)
      })
    }
    for (const builtin of BUILTIN_FIELDS[collection]) if (!seen.has(builtin.id)) fields.push({ ...builtin, hidden: false })
    result[collection] = fields
  }
  return result
}

/** Texto de un cuadro en una ficha. */
export function fieldValue(entity: object, field: Pick<SheetField, 'id'>): string {
  const value = isCustomField(field.id)
    ? (entity as { extra?: Record<string, string> }).extra?.[field.id]
    : (entity as Record<string, unknown>)[field.id]
  return typeof value === 'string' ? value : ''
}

/** Cuadros visibles de una sección, con su texto en esta ficha. */
export function sheetEntries(
  templates: SheetTemplates,
  collection: SheetCollection,
  entity: Character | Creature | Race | Lineage
): { field: SheetField; value: string }[] {
  return templates[collection].filter((f) => !f.hidden).map((field) => ({ field, value: fieldValue(entity, field) }))
}
