/**
 * Migraciones del formato de proyecto.
 *
 * Cuando cambie la forma de `Project` (ver src/shared/types.ts):
 *  1. Sube `CURRENT_SCHEMA_VERSION`.
 *  2. Añade aquí una función `vN -> vN+1` en `MIGRATIONS`.
 * Los proyectos antiguos se actualizan al abrirse y se guardan ya migrados.
 */
import { DEFAULT_CALENDAR } from '@shared/calendar'
import { defaultCover } from '@shared/cover'
import { CURRENT_SCHEMA_VERSION, type EntityCollection, type Project } from '@shared/types'
import { withEntityDefaults } from './entityDefaults'

type RawProject = Record<string, unknown> & { schemaVersion?: number }
type RawList = Record<string, unknown>[] | undefined

/** Añade `aliases: []` a cada elemento de una lista que no lo tenga. */
const withAliases = (list: unknown) => ((list as RawList) ?? []).map((item) => ({ aliases: [], ...item }))

/** MIGRATIONS[n] transforma un proyecto de la versión n a la n + 1. */
const MIGRATIONS: Record<number, (project: RawProject) => RawProject> = {
  /** v1 -> v2: aparecen el lore, el bestiario y las imágenes de las fichas. */
  1: (p) => ({
    ...p,
    schemaVersion: 2,
    lore: [],
    creatures: [],
    characters: ((p.characters as RawList) ?? []).map((c) => ({ image: '', ...c }))
  }),
  /**
   * v2 -> v3: alias en las fichas; relaciones, línea temporal con calendario,
   * mapas, tableros de inspiración, objetivo diario y sprints de escritura.
   */
  2: (p) => ({
    ...p,
    schemaVersion: 3,
    characters: withAliases(p.characters),
    lore: withAliases(p.lore),
    creatures: withAliases(p.creatures),
    relationships: [],
    events: [],
    maps: [],
    boards: [],
    calendar: structuredClone(DEFAULT_CALENDAR),
    relationLayout: {},
    dailyGoal: 0,
    sessions: []
  }),
  /**
   * v3 -> v4: borradores y escenas en los capítulos; razas, glosario,
   * linajes, tramas, comentarios al margen y portada.
   * (Las escenas se calculan al abrir el proyecto; ver ProjectRepository.getProject.)
   */
  3: (p) => ({
    ...p,
    schemaVersion: 4,
    chapters: ((p.chapters as RawList) ?? []).map((c) => ({ draft: false, scenes: [], ...c })),
    characters: ((p.characters as RawList) ?? []).map((c) => ({ raceId: null, lineageId: null, ...c })),
    races: [],
    glossary: [],
    lineages: [],
    plotlines: [],
    comments: [],
    cover: defaultCover(String(p.title ?? ''))
  })
}

export function migrateProject(raw: RawProject): { project: Project; migrated: boolean } {
  let current = raw
  let version = current.schemaVersion ?? 1
  const startVersion = version

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Este proyecto se creó con una versión más nueva de BlueFantasyNovel (esquema ${version}). Actualiza la aplicación para abrirlo.`
    )
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) throw new Error(`Falta la migración del esquema ${version} al ${version + 1}`)
    current = step(current)
    version = current.schemaVersion ?? version + 1
  }

  return { project: withDefaults(current), migrated: version !== startVersion }
}

/**
 * Rellena campos ausentes con valores por defecto. Protege frente a archivos
 * editados a mano o creados por versiones de desarrollo.
 */
function withDefaults(raw: RawProject): Project {
  const p = raw as Partial<Project>
  const now = new Date().toISOString()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: String(p.id),
    title: p.title ?? 'Sin título',
    description: p.description ?? '',
    genre: p.genre ?? '',
    wordGoal: p.wordGoal ?? 0,
    createdAt: p.createdAt ?? now,
    updatedAt: p.updatedAt ?? now,
    chapters: (p.chapters ?? []).map((c) => ({ ...c, draft: c.draft ?? false, scenes: c.scenes ?? [] })),
    characters: complete('characters', p.characters),
    lore: complete('lore', p.lore),
    creatures: complete('creatures', p.creatures),
    relationships: complete('relationships', p.relationships),
    events: complete('events', p.events),
    maps: complete('maps', p.maps),
    boards: complete('boards', p.boards),
    calendar: p.calendar ?? structuredClone(DEFAULT_CALENDAR),
    relationLayout: p.relationLayout ?? {},
    dailyWords: p.dailyWords ?? {},
    dailyGoal: p.dailyGoal ?? 0,
    sessions: p.sessions ?? [],
    races: complete('races', p.races),
    glossary: complete('glossary', p.glossary),
    lineages: complete('lineages', p.lineages),
    plotlines: complete('plotlines', p.plotlines),
    comments: complete('comments', p.comments),
    cover: completeCover(p.cover, p.title)
  }
}

/** Lista de fichas con todos sus campos (los que falten, con su valor por defecto). */
function complete<C extends EntityCollection, T>(collection: C, list: T[] | undefined): T[] {
  return (list ?? []).map((entity) => withEntityDefaults(collection, entity as object) as T)
}

/** Portada con todos sus campos (y sus tres caras completas). */
function completeCover(cover: Project['cover'] | undefined, title: string | undefined): Project['cover'] {
  const base = defaultCover(title ?? '')
  if (!cover) return base
  return {
    ...base,
    ...cover,
    front: { ...base.front, ...cover.front },
    spine: { ...base.spine, ...cover.spine },
    back: { ...base.back, ...cover.back }
  }
}
