/**
 * Acceso a los proyectos guardados en disco.
 *
 * Estructura de la biblioteca (una carpeta por proyecto, nombrada por su id):
 *
 *   <biblioteca>/
 *     <projectId>/
 *       project.json          metadatos, capítulos (sin texto), fichas, estadísticas
       project.schema-vN.json  copia de project.json anterior a convertirlo del esquema N
 *       chapters/
 *         <chapterId>.json    texto del capítulo (JSON de TipTap)
 *         .versions/
 *           <chapterId>/<marca de tiempo>.json   historial de versiones
 *       assets/
 *         <uuid>.<ext>        imágenes de las fichas (retratos, ilustraciones, mapas…)
 *
 * Se usan archivos JSON legibles a propósito: el usuario puede hacer copias
 * de seguridad copiando la carpeta, sincronizarla con OneDrive/Dropbox o
 * inspeccionarla a mano.
 *
 * Todas las modificaciones de `project.json` pasan por `mutate()`, que las
 * serializa por proyecto para que dos operaciones simultáneas (p. ej. el
 * autoguardado y editar un personaje) no se pisen.
 */
import { constants as fsConstants, promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { countWords } from '@shared/text'
import { todayKey } from '@shared/dates'
import { emptyDoc, toPlainText } from '@shared/richText'
import { assertValidAssetRefs, collectAssetRefs } from '@shared/assetRefs'
import { IMAGE_EXTENSIONS, isValidAssetFileName } from '@shared/assets'
import { DEFAULT_CALENDAR } from '@shared/calendar'
import { defaultCover } from '@shared/cover'
import { computeScenes, manuscriptChapters, manuscriptWordCount } from '@shared/manuscript'
import { createMentionMatcher, mentionTargets } from '@shared/mentions'
import {
  CURRENT_SCHEMA_VERSION,
  ENTITY_COLLECTIONS,
  RELATIONSHIP_KINDS,
  WORLD_COLLECTIONS,
  type AssetFileName,
  type ChapterMeta,
  type ChapterSearchResult,
  type ChapterVersion,
  type EntityCollection,
  type EntityInput,
  type EntityMap,
  type Id,
  type MentionIndex,
  type NewProjectInput,
  type Project,
  type ProjectPatch,
  type Point,
  type ProjectSummary,
  type RelationMapState,
  type RichTextNode,
  type Saga,
  type SearchOptions,
  type WorldCollection,
  type WritingSession
} from '@shared/types'
import { assertSafeId, pathExists, readJson, writeJsonAtomic } from './fsUtils'
import { withEntityDefaults } from './entityDefaults'
import { buildSearchPattern, findInDoc, replaceInDoc } from './manuscriptSearch'
import { migrateProject } from './migrations'

const PROJECT_FILE = 'project.json'
const CHAPTERS_DIR = 'chapters'
const ASSETS_DIR = 'assets'
const VERSIONS_DIR = '.versions'
const SAGAS_FILE = 'sagas.json'
/** Clave del candado de las sagas (no es un id de proyecto). */
const SAGAS_LOCK = 'sagas'

/** Se guarda una versión como mucho cada 10 minutos de escritura por capítulo. */
const VERSION_INTERVAL_MS = 10 * 60 * 1000
/** Versiones que se conservan por capítulo (las más antiguas se borran). */
const MAX_VERSIONS_PER_CHAPTER = 50
const VERSION_ID = /^\d{10,16}$/
/** Sesiones de escritura que se conservan en el proyecto. */
const MAX_SESSIONS = 500

export interface ProjectRepositoryOptions {
  /** Carpeta raíz donde viven todos los proyectos. */
  libraryRoot: string
  /**
   * Cómo eliminar la carpeta de un proyecto. Por defecto la aplicación la
   * envía a la Papelera de reciclaje (ver src/main/index.ts), de modo que un
   * borrado accidental se puede recuperar.
   */
  removeDirectory: (dir: string) => Promise<void>
  /** Se llama tras cada cambio guardado (lo usan las copias de seguridad). */
  onChange?: () => void
}

export class ProjectRepository {
  private readonly locks = new Map<Id, Promise<unknown>>()

  constructor(private readonly options: ProjectRepositoryOptions) {}

  get libraryRoot(): string {
    return this.options.libraryRoot
  }

  /* ------------------------------------------------------------------------ */
  /* Proyectos                                                                */
  /* ------------------------------------------------------------------------ */

  async listProjects(): Promise<ProjectSummary[]> {
    await fs.mkdir(this.libraryRoot, { recursive: true })
    const entries = await fs.readdir(this.libraryRoot, { withFileTypes: true })

    const sagaOf = new Map<Id, Id>()
    for (const saga of await this.listSagas()) for (const id of saga.projectIds) sagaOf.set(id, saga.id)

    const summaries: ProjectSummary[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const file = path.join(this.libraryRoot, entry.name, PROJECT_FILE)
      if (!(await pathExists(file))) continue
      try {
        const { project } = migrateProject(await readJson(file))
        summaries.push(toSummary(project, sagaOf.get(project.id) ?? null))
      } catch (error) {
        // Un proyecto dañado no debe impedir abrir la biblioteca entera.
        console.error(`No se pudo leer el proyecto en ${file}:`, error)
      }
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async createProject(input: NewProjectInput): Promise<Project> {
    const now = new Date().toISOString()
    const project: Project = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: randomUUID(),
      title: input.title.trim() || 'Sin título',
      description: input.description.trim(),
      genre: input.genre.trim(),
      wordGoal: 0,
      createdAt: now,
      updatedAt: now,
      chapters: [],
      characters: [],
      lore: [],
      creatures: [],
      relationships: [],
      relationGroups: [],
      events: [],
      maps: [],
      boards: [],
      calendar: structuredClone(DEFAULT_CALENDAR),
      relationLayout: {},
      dailyWords: {},
      dailyGoal: 0,
      sessions: [],
      races: [],
      glossary: [],
      lineages: [],
      plotlines: [],
      comments: [],
      cover: defaultCover(input.title.trim())
    }
    await this.writeProject(project)

    // Toda historia nueva empieza con un primer capítulo listo para escribir.
    const { project: withChapter } = await this.createChapter(project.id, 'Capítulo 1')
    return withChapter
  }

  async getProject(projectId: Id): Promise<Project> {
    assertSafeId(projectId, 'projectId')
    const file = this.projectFile(projectId)
    const raw = await readJson<{ schemaVersion?: number }>(file)
    const { project, migrated } = migrateProject(raw)
    if (migrated) {
      await keepPreMigrationCopy(file, raw.schemaVersion ?? 1)
      // Proyectos anteriores a las escenas: se calculan una vez a partir del texto.
      for (const chapter of project.chapters) {
        if (chapter.scenes.length === 0 && chapter.wordCount > 0) {
          const file = this.chapterFile(projectId, chapter.id)
          if (await pathExists(file)) chapter.scenes = computeScenes(await readJson<RichTextNode>(file))
        }
      }
      await this.writeProject(project)
    }
    return project
  }

  async updateProject(projectId: Id, patch: ProjectPatch): Promise<Project> {
    if (patch.cover !== undefined) assertValidAssetRefs(patch.cover)
    let unused: AssetFileName[] = []
    const updated = await this.mutate(projectId, (project) => {
      if (patch.title !== undefined) project.title = patch.title.trim() || 'Sin título'
      if (patch.description !== undefined) project.description = patch.description
      if (patch.genre !== undefined) project.genre = patch.genre
      if (patch.wordGoal !== undefined) project.wordGoal = Math.max(0, Math.floor(patch.wordGoal))
      if (patch.dailyGoal !== undefined) project.dailyGoal = Math.max(0, Math.floor(patch.dailyGoal))
      if (patch.calendar !== undefined) {
        const months = patch.calendar.months.filter((m) => m.name.trim())
        if (months.length === 0) throw new Error('El calendario necesita al menos un mes')
        project.calendar = {
          eraName: patch.calendar.eraName ?? '',
          months: months.map((m) => ({ name: m.name.trim(), days: Math.min(999, Math.max(1, Math.floor(m.days))) }))
        }
      }
      if (patch.relationLayout !== undefined) project.relationLayout = patch.relationLayout
      if (patch.cover !== undefined) {
        const before = collectAssetRefs(project.cover)
        project.cover = { ...project.cover, ...patch.cover }
        unused = unreferencedAssets(project, before)
      }
      return project
    })
    await Promise.all(unused.map((file) => this.deleteAsset(projectId, file)))
    return updated
  }

  async deleteProject(projectId: Id): Promise<void> {
    assertSafeId(projectId, 'projectId')
    await this.withLock(projectId, () => this.options.removeDirectory(this.projectDir(projectId)))
    await this.removeFromSaga(projectId)
    this.options.onChange?.()
  }

  /* ------------------------------------------------------------------------ */
  /* Capítulos                                                                */
  /* ------------------------------------------------------------------------ */

  async createChapter(projectId: Id, title: string, draft = false): Promise<{ project: Project; chapter: ChapterMeta }> {
    const now = new Date().toISOString()
    const chapter: ChapterMeta = {
      id: randomUUID(),
      title: title.trim() || (draft ? 'Borrador sin título' : 'Capítulo sin título'),
      wordCount: 0,
      draft: Boolean(draft),
      scenes: [],
      createdAt: now,
      updatedAt: now
    }
    await writeJsonAtomic(this.chapterFile(projectId, chapter.id), emptyDoc())
    const project = await this.mutate(projectId, (p) => {
      p.chapters.push(chapter)
      return p
    })
    return { project, chapter }
  }

  renameChapter(projectId: Id, chapterId: Id, title: string): Promise<Project> {
    return this.mutate(projectId, (project) => {
      const chapter = findOrThrow(project.chapters, chapterId, 'Capítulo')
      chapter.title = title.trim() || 'Capítulo sin título'
      chapter.updatedAt = new Date().toISOString()
      return project
    })
  }

  /** Pasa un capítulo a borradores (fuera del manuscrito) o de vuelta al manuscrito. */
  setChapterDraft(projectId: Id, chapterId: Id, draft: boolean): Promise<Project> {
    return this.mutate(projectId, (project) => {
      const chapter = findOrThrow(project.chapters, chapterId, 'Capítulo')
      chapter.draft = Boolean(draft)
      // Al moverlo, se coloca al final de su nueva lista.
      project.chapters = [...project.chapters.filter((c) => c.id !== chapterId), chapter]
      return project
    })
  }

  async deleteChapter(projectId: Id, chapterId: Id): Promise<Project> {
    assertSafeId(chapterId, 'chapterId')
    const project = await this.mutate(projectId, (p) => {
      findOrThrow(p.chapters, chapterId, 'Capítulo')
      p.chapters = p.chapters.filter((c) => c.id !== chapterId)
      for (const event of p.events) if (event.chapterId === chapterId) event.chapterId = null
      for (const plot of p.plotlines) delete plot.beats[chapterId]
      p.comments = p.comments.filter((c) => c.chapterId !== chapterId)
      return p
    })
    await fs.rm(this.chapterFile(projectId, chapterId), { force: true })
    await fs.rm(this.versionsDir(projectId, chapterId), { recursive: true, force: true })
    return project
  }

  reorderChapters(projectId: Id, orderedIds: Id[]): Promise<Project> {
    return this.mutate(projectId, (project) => {
      const byId = new Map(project.chapters.map((c) => [c.id, c]))
      const sameSet = orderedIds.length === byId.size && orderedIds.every((id) => byId.has(id))
      if (!sameSet) throw new Error('El nuevo orden no coincide con los capítulos existentes')
      project.chapters = orderedIds.map((id) => byId.get(id)!)
      return project
    })
  }

  /**
   * Lee el texto de un capítulo. Pasa por el candado del proyecto para
   * esperar a cualquier guardado en curso: si el usuario sale de un capítulo
   * y vuelve enseguida, siempre ve su última versión.
   */
  getChapterContent(projectId: Id, chapterId: Id): Promise<RichTextNode> {
    const file = this.chapterFile(projectId, chapterId)
    return this.withLock(projectId, async () => ((await pathExists(file)) ? readJson<RichTextNode>(file) : emptyDoc()))
  }

  /**
   * Guarda el texto de un capítulo y actualiza:
   *  - su recuento de palabras,
   *  - las palabras escritas hoy (solo si el capítulo ha crecido).
   */
  async saveChapterContent(projectId: Id, chapterId: Id, doc: RichTextNode): Promise<Project> {
    if (!doc || typeof doc !== 'object' || doc.type !== 'doc') {
      throw new Error('Contenido de capítulo no válido')
    }
    const wordCount = countWords(toPlainText(doc))

    return this.mutate(projectId, async (project) => {
      const chapter = findOrThrow(project.chapters, chapterId, 'Capítulo')
      await writeJsonAtomic(this.chapterFile(projectId, chapterId), doc)
      await this.maybeSnapshot(projectId, chapterId, doc, wordCount)

      const delta = wordCount - chapter.wordCount
      if (delta > 0) {
        const today = todayKey()
        project.dailyWords[today] = (project.dailyWords[today] ?? 0) + delta
      }
      chapter.wordCount = wordCount
      chapter.scenes = computeScenes(doc)
      chapter.updatedAt = new Date().toISOString()
      return project
    })
  }

  /* ------------------------------------------------------------------------ */
  /* Historial de versiones                                                   */
  /* ------------------------------------------------------------------------ */

  /** Versiones guardadas de un capítulo, de la más reciente a la más antigua. */
  async listVersions(projectId: Id, chapterId: Id): Promise<ChapterVersion[]> {
    const dir = this.versionsDir(projectId, chapterId)
    if (!(await pathExists(dir))) return []
    const files = (await fs.readdir(dir)).filter((f) => VERSION_ID.test(f.replace(/\.json$/, '')))
    const versions = await Promise.all(
      files.map(async (file) => {
        const data = await readJson<{ createdAt: string; wordCount: number }>(path.join(dir, file))
        return { id: file.replace(/\.json$/, ''), createdAt: data.createdAt, wordCount: data.wordCount }
      })
    )
    return versions.sort((a, b) => Number(b.id) - Number(a.id))
  }

  async getVersion(projectId: Id, chapterId: Id, versionId: string): Promise<RichTextNode> {
    const data = await readJson<{ doc: RichTextNode }>(this.versionFile(projectId, chapterId, versionId))
    return data.doc
  }

  /**
   * Restaura una versión. Antes guarda el estado actual como versión nueva,
   * así restaurar nunca hace perder nada.
   */
  async restoreVersion(projectId: Id, chapterId: Id, versionId: string): Promise<Project> {
    const doc = await this.getVersion(projectId, chapterId, versionId)
    const current = await this.getChapterContent(projectId, chapterId)
    await this.writeSnapshot(projectId, chapterId, current, countWords(toPlainText(current)))
    return this.saveChapterContent(projectId, chapterId, doc)
  }

  /** Guarda una versión si ha pasado suficiente tiempo desde la última. */
  private async maybeSnapshot(projectId: Id, chapterId: Id, doc: RichTextNode, wordCount: number): Promise<void> {
    const dir = this.versionsDir(projectId, chapterId)
    const existing = (await pathExists(dir)) ? await fs.readdir(dir) : []
    const latest = Math.max(0, ...existing.map((f) => Number(f.replace(/\.json$/, ''))).filter(Number.isFinite))
    if (Date.now() - latest < VERSION_INTERVAL_MS) return
    await this.writeSnapshot(projectId, chapterId, doc, wordCount)
  }

  private async writeSnapshot(projectId: Id, chapterId: Id, doc: RichTextNode, wordCount: number): Promise<void> {
    const id = String(Date.now())
    await writeJsonAtomic(this.versionFile(projectId, chapterId, id), {
      createdAt: new Date().toISOString(),
      wordCount,
      doc
    })
    // Poda: conserva solo las más recientes.
    const dir = this.versionsDir(projectId, chapterId)
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort((a, b) => Number(b.slice(0, -5)) - Number(a.slice(0, -5)))
    await Promise.all(files.slice(MAX_VERSIONS_PER_CHAPTER).map((f) => fs.rm(path.join(dir, f), { force: true })))
  }

  /* ------------------------------------------------------------------------ */
  /* Búsqueda en el manuscrito                                                */
  /* ------------------------------------------------------------------------ */

  async searchManuscript(projectId: Id, query: string, options: SearchOptions): Promise<ChapterSearchResult[]> {
    const pattern = buildSearchPattern(query, options)
    if (!pattern) return []
    const project = await this.getProject(projectId)
    const results: ChapterSearchResult[] = []
    for (const chapter of project.chapters) {
      const { matches } = findInDoc(await this.getChapterContent(projectId, chapter.id), pattern)
      if (matches.length > 0) results.push({ chapterId: chapter.id, title: chapter.title, matches })
    }
    return results
  }

  /**
   * Reemplaza en todos los capítulos. Guarda antes una versión de cada
   * capítulo afectado para poder deshacerlo desde el historial.
   */
  async replaceInManuscript(
    projectId: Id,
    query: string,
    replacement: string,
    options: SearchOptions
  ): Promise<{ project: Project; count: number }> {
    const pattern = buildSearchPattern(query, options)
    let project = await this.getProject(projectId)
    if (!pattern) return { project, count: 0 }

    let total = 0
    for (const chapter of project.chapters) {
      const doc = await this.getChapterContent(projectId, chapter.id)
      const result = replaceInDoc(doc, pattern, replacement)
      if (result.count === 0) continue
      await this.writeSnapshot(projectId, chapter.id, doc, chapter.wordCount)
      project = await this.saveChapterContent(projectId, chapter.id, result.doc)
      total += result.count
    }
    return { project, count: total }
  }

  /* ------------------------------------------------------------------------ */
  /* Menciones                                                                */
  /* ------------------------------------------------------------------------ */

  /** Cuántas veces se nombra cada personaje, entrada de lore y criatura en cada capítulo. */
  async analyzeMentions(projectId: Id): Promise<MentionIndex> {
    const project = await this.getProject(projectId)
    const matcher = createMentionMatcher(mentionTargets(project))
    const index: MentionIndex = {}
    for (const chapter of project.chapters) {
      const text = toPlainText(await this.getChapterContent(projectId, chapter.id))
      const counts = new Map<Id, number>()
      for (const match of matcher.find(text)) counts.set(match.target.id, (counts.get(match.target.id) ?? 0) + 1)
      for (const [id, count] of counts) (index[id] ??= []).push({ chapterId: chapter.id, count })
    }
    return index
  }

  /* ------------------------------------------------------------------------ */
  /* Sesiones de escritura                                                    */
  /* ------------------------------------------------------------------------ */

  addSession(projectId: Id, session: WritingSession): Promise<Project> {
    return this.mutate(projectId, (project) => {
      project.sessions.push({
        start: String(session.start),
        minutes: Math.max(0, Number(session.minutes) || 0),
        words: Math.max(0, Math.floor(Number(session.words) || 0))
      })
      project.sessions = project.sessions.slice(-MAX_SESSIONS)
      return project
    })
  }

  /* ------------------------------------------------------------------------ */
  /* Fichas (personajes, lore, criaturas, relaciones, eventos, mapas…)        */
  /* ------------------------------------------------------------------------ */

  async createEntity<C extends EntityCollection>(
    projectId: Id,
    collection: C,
    input: EntityInput<C>
  ): Promise<{ project: Project; entity: EntityMap[C] }> {
    assertCollection(collection)
    assertValidAssetRefs(input)
    const now = new Date().toISOString()
    const entity = {
      ...withEntityDefaults(collection, stripSystemFields(input)),
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    } as EntityMap[C]
    const project = await this.mutate(projectId, (p) => {
      entitiesOf(p, collection).push(entity)
      return p
    })
    await this.syncToSaga(projectId, collection, entity)
    return { project, entity }
  }

  /**
   * Actualiza campos de una ficha. Las imágenes que dejen de usarse (porque
   * se cambió el retrato, se quitó una foto de un tablero…) se borran del disco.
   */
  async updateEntity<C extends EntityCollection>(
    projectId: Id,
    collection: C,
    entityId: Id,
    input: Partial<EntityInput<C>>
  ): Promise<Project> {
    assertCollection(collection)
    assertValidAssetRefs(input)
    const changes = stripSystemFields(input)

    let unused: AssetFileName[] = []
    let updated: { id: Id } | undefined
    const project = await this.mutate(projectId, (p) => {
      const entity = findOrThrow(entitiesOf(p, collection), entityId, 'Ficha')
      const before = collectAssetRefs(entity)
      Object.assign(entity, changes, { updatedAt: new Date().toISOString() })
      updated = entity
      unused = unreferencedAssets(p, before)
      return p
    })
    await Promise.all(unused.map((file) => this.deleteAsset(projectId, file)))
    if (updated) await this.syncToSaga(projectId, collection, updated)
    return project
  }

  /**
   * Borra una ficha, sus imágenes y las referencias a ella en otras fichas
   * (relaciones de un personaje, chinchetas que apuntaban a un lugar…).
   */
  async deleteEntity(projectId: Id, collection: EntityCollection, entityId: Id): Promise<Project> {
    assertCollection(collection)
    let unused: AssetFileName[] = []
    const project = await this.mutate(projectId, (p) => {
      const list = entitiesOf(p, collection)
      const before = collectAssetRefs(findOrThrow(list, entityId, 'Ficha'))
      list.splice(
        list.findIndex((e) => e.id === entityId),
        1
      )
      removeReferences(p, collection, entityId)
      unused = unreferencedAssets(p, before)
      return p
    })
    await Promise.all(unused.map((file) => this.deleteAsset(projectId, file)))
    await this.syncDeleteToSaga(projectId, collection, entityId)
    return project
  }

  /**
   * Deja el mapa de relaciones (relaciones, grupos y posiciones) tal como
   * indica `state`. Lo usan deshacer/rehacer y "Agrupar", que cambian muchas
   * cosas a la vez en un solo paso. Los cambios se replican en la saga.
   */
  async applyRelationMap(projectId: Id, state: RelationMapState): Promise<Project> {
    const now = new Date().toISOString()
    const changed: { collection: 'relationships' | 'relationGroups'; entity: { id: Id } }[] = []
    const removed: { collection: 'relationships' | 'relationGroups'; id: Id }[] = []

    const project = await this.mutate(projectId, (p) => {
      const characters = new Set(p.characters.map((c) => c.id))
      const relationships = sanitizeList(state?.relationships, 'relationships').filter(
        (r) => characters.has(r.sourceId) && characters.has(r.targetId) && r.sourceId !== r.targetId
      )
      for (const r of relationships) if (!(RELATIONSHIP_KINDS as readonly string[]).includes(r.kind)) r.kind = 'otro'
      const relationGroups = sanitizeList(state?.relationGroups, 'relationGroups').map((g) => ({
        ...g,
        memberIds: [...new Set((Array.isArray(g.memberIds) ? g.memberIds : []).filter((id) => characters.has(id)))]
      }))

      for (const [collection, next] of [
        ['relationships', relationships],
        ['relationGroups', relationGroups]
      ] as const) {
        const before = new Map(entitiesOf(p, collection).map((e) => [e.id, e]))
        for (const entity of next as { id: Id; createdAt: string; updatedAt: string }[]) {
          const old = before.get(entity.id)
          if (old && sameEntity(old, entity)) {
            Object.assign(entity, { createdAt: (old as typeof entity).createdAt, updatedAt: (old as typeof entity).updatedAt })
            continue
          }
          // Una ficha recuperada al deshacer conserva su fecha de creación original.
          const createdAt = (old as typeof entity | undefined)?.createdAt ?? (typeof entity.createdAt === 'string' && entity.createdAt ? entity.createdAt : now)
          Object.assign(entity, { createdAt, updatedAt: now })
          changed.push({ collection, entity })
        }
        const kept = new Set(next.map((e) => e.id))
        for (const id of before.keys()) if (!kept.has(id)) removed.push({ collection, id })
      }

      p.relationships = relationships
      p.relationGroups = relationGroups
      const layout: Record<Id, Point> = {}
      for (const [id, point] of Object.entries(state?.relationLayout ?? {})) {
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) layout[id] = { x: Math.round(point.x), y: Math.round(point.y) }
      }
      p.relationLayout = layout
      return p
    })

    for (const { collection, entity } of changed) await this.syncToSaga(projectId, collection, entity)
    for (const { collection, id } of removed) await this.syncDeleteToSaga(projectId, collection, id)
    return project
  }

  /** Cambia el orden de una colección. `orderedIds` debe contener exactamente sus ids. */
  reorderEntities(projectId: Id, collection: EntityCollection, orderedIds: Id[]): Promise<Project> {
    assertCollection(collection)
    return this.mutate(projectId, (p) => {
      const list = entitiesOf(p, collection)
      const byId = new Map(list.map((e) => [e.id, e]))
      const sameSet =
        Array.isArray(orderedIds) && orderedIds.length === byId.size && new Set(orderedIds).size === byId.size && orderedIds.every((id) => byId.has(id))
      if (!sameSet) throw new Error('El nuevo orden no coincide con las fichas existentes')
      ;(p[collection] as unknown[]) = orderedIds.map((id) => byId.get(id)!)
      return p
    })
  }

  /**
   * Copia fichas de otra historia (para sagas que comparten mundo). Se crean
   * con ids nuevos y con copia de sus imágenes; las historias quedan
   * independientes a partir de ese momento.
   */
  async importEntities(
    projectId: Id,
    sourceProjectId: Id,
    collection: 'characters' | 'lore' | 'creatures' | 'races' | 'glossary' | 'lineages',
    entityIds: Id[]
  ): Promise<Project> {
    if (!['characters', 'lore', 'creatures', 'races', 'glossary', 'lineages'].includes(collection)) {
      throw new Error('Solo se pueden importar fichas')
    }
    if (projectId === sourceProjectId) throw new Error('Elige otra historia como origen')
    const source = await this.getProject(sourceProjectId)
    const selected = (source[collection] as { id: Id }[]).filter((e) => entityIds.includes(e.id))

    const now = new Date().toISOString()
    const copies: { id: Id; createdAt: string; updatedAt: string }[] = []
    for (const entity of selected) {
      const copy = structuredClone(entity) as { id: Id; image?: AssetFileName; fullImage?: AssetFileName; createdAt: string; updatedAt: string }
      if (copy.image) copy.image = await this.importAsset(projectId, this.assetPath(sourceProjectId, copy.image))
      if (copy.fullImage) copy.fullImage = await this.importAsset(projectId, this.assetPath(sourceProjectId, copy.fullImage))
      // Las referencias a otras fichas de la historia de origen no existen aquí.
      if (collection === 'characters') Object.assign(copy, { raceId: null, lineageId: null })
      if (collection === 'lineages') Object.assign(copy, { seatLoreId: null })
      copies.push({ ...copy, id: randomUUID(), createdAt: now, updatedAt: now })
    }
    return this.mutate(projectId, (p) => {
      ;(p[collection] as unknown[]).push(...copies)
      return p
    })
  }

  /* ------------------------------------------------------------------------ */
  /* Sagas: historias que comparten mundo                                     */
  /* ------------------------------------------------------------------------ */
  //
  // Las sagas se guardan en <biblioteca>/sagas.json. Cada historia de una
  // saga conserva su propia copia de las fichas del mundo (WORLD_COLLECTIONS),
  // pero cualquier cambio en una se replica al momento en las demás
  // (syncToSaga / syncDeleteToSaga). Así cada carpeta de historia sigue
  // siendo autocontenida (copias, exportación) y el mundo se ve "vivo" y
  // compartido desde cualquier libro.

  async listSagas(): Promise<Saga[]> {
    const file = path.join(this.libraryRoot, SAGAS_FILE)
    if (!(await pathExists(file))) return []
    try {
      return (await readJson<{ sagas: Saga[] }>(file)).sagas ?? []
    } catch (error) {
      console.error('sagas.json dañado:', error)
      return []
    }
  }

  /** Crea una saga con las historias indicadas y unifica su mundo. */
  async createSaga(name: string, projectIds: Id[]): Promise<Saga> {
    projectIds.forEach((id) => assertSafeId(id, 'projectId'))
    const saga: Saga = { id: randomUUID(), name: name.trim() || 'Saga sin nombre', projectIds: [...new Set(projectIds)] }
    await this.updateSagas((sagas) => [
      ...sagas.map((s) => ({ ...s, projectIds: s.projectIds.filter((id) => !saga.projectIds.includes(id)) })),
      saga
    ])
    await this.mergeWorld(saga.projectIds)
    return saga
  }

  /** Añade una historia a una saga: su mundo se une al de la saga. */
  async addToSaga(sagaId: Id, projectId: Id): Promise<Saga> {
    assertSafeId(projectId, 'projectId')
    let result: Saga | undefined
    await this.updateSagas((sagas) =>
      sagas.map((s) => {
        const without = s.projectIds.filter((id) => id !== projectId)
        const next = s.id === sagaId ? { ...s, projectIds: [...without, projectId] } : { ...s, projectIds: without }
        if (s.id === sagaId) result = next
        return next
      })
    )
    if (!result) throw new Error('Saga no encontrada')
    await this.mergeWorld(result.projectIds)
    return result
  }

  /** Saca una historia de su saga. Conserva su copia del mundo tal como está. */
  async removeFromSaga(projectId: Id): Promise<void> {
    await this.updateSagas((sagas) => sagas.map((s) => ({ ...s, projectIds: s.projectIds.filter((id) => id !== projectId) })))
  }

  async renameSaga(sagaId: Id, name: string): Promise<void> {
    await this.updateSagas((sagas) => sagas.map((s) => (s.id === sagaId ? { ...s, name: name.trim() || s.name } : s)))
  }

  /** Disuelve la saga. Las historias conservan sus fichas. */
  async deleteSaga(sagaId: Id): Promise<void> {
    await this.updateSagas((sagas) => sagas.filter((s) => s.id !== sagaId))
  }

  private updateSagas(change: (sagas: Saga[]) => Saga[]): Promise<void> {
    return this.withLock(SAGAS_LOCK, async () => {
      // Las sagas vacías o de una sola historia no tienen sentido: se eliminan.
      const next = change(await this.listSagas()).filter((s) => s.projectIds.length > 0)
      await writeJsonAtomic(path.join(this.libraryRoot, SAGAS_FILE), { sagas: next })
    })
  }

  private async sagaPartners(projectId: Id): Promise<Id[]> {
    const saga = (await this.listSagas()).find((s) => s.projectIds.includes(projectId))
    if (!saga) return []
    const partners: Id[] = []
    for (const id of saga.projectIds) {
      if (id !== projectId && (await pathExists(this.projectFile(id)))) partners.push(id)
    }
    return partners
  }

  /** Replica una ficha creada o modificada en el resto de la saga. */
  private async syncToSaga(projectId: Id, collection: EntityCollection, entity: { id: Id }): Promise<void> {
    if (!isWorldCollection(collection)) return
    for (const otherId of await this.sagaPartners(projectId)) {
      for (const file of collectAssetRefs(entity)) await this.copyAssetIfMissing(projectId, otherId, file)
      let unused: AssetFileName[] = []
      await this.mutate(otherId, (q) => {
        const list = entitiesOf(q, collection)
        const index = list.findIndex((e) => e.id === entity.id)
        const before = index >= 0 ? collectAssetRefs(list[index]) : new Set<AssetFileName>()
        if (index >= 0) list[index] = structuredClone(entity)
        else list.push(structuredClone(entity))
        unused = unreferencedAssets(q, before)
        return q
      })
      await Promise.all(unused.map((file) => this.deleteAsset(otherId, file)))
    }
  }

  /** Replica el borrado de una ficha en el resto de la saga. */
  private async syncDeleteToSaga(projectId: Id, collection: EntityCollection, entityId: Id): Promise<void> {
    if (!isWorldCollection(collection)) return
    for (const otherId of await this.sagaPartners(projectId)) {
      let unused: AssetFileName[] = []
      await this.mutate(otherId, (q) => {
        const list = entitiesOf(q, collection)
        const index = list.findIndex((e) => e.id === entityId)
        if (index < 0) return q
        const before = collectAssetRefs(list[index])
        list.splice(index, 1)
        removeReferences(q, collection, entityId)
        unused = unreferencedAssets(q, before)
        return q
      })
      await Promise.all(unused.map((file) => this.deleteAsset(otherId, file)))
    }
  }

  /**
   * Une el mundo de varias historias: cada ficha del mundo que exista en
   * alguna pasa a estar en todas. Si la misma ficha (mismo id) difiere, gana
   * la modificada más recientemente.
   */
  private async mergeWorld(projectIds: Id[]): Promise<void> {
    const projects: Project[] = []
    for (const id of projectIds) if (await pathExists(this.projectFile(id))) projects.push(await this.getProject(id))
    if (projects.length < 2) return

    for (const collection of WORLD_COLLECTIONS) {
      const union = new Map<Id, { entity: { id: Id; updatedAt?: string }; owner: Id }>()
      for (const project of projects) {
        for (const entity of project[collection] as { id: Id; updatedAt?: string }[]) {
          const current = union.get(entity.id)
          if (!current || (entity.updatedAt ?? '') > (current.entity.updatedAt ?? '')) union.set(entity.id, { entity, owner: project.id })
        }
      }
      for (const project of projects) {
        for (const { entity, owner } of union.values()) {
          if (owner === project.id) continue
          for (const file of collectAssetRefs(entity)) await this.copyAssetIfMissing(owner, project.id, file)
        }
        await this.mutate(project.id, (q) => {
          const list = entitiesOf(q, collection)
          for (const { entity } of union.values()) {
            const index = list.findIndex((e) => e.id === entity.id)
            if (index >= 0) list[index] = structuredClone(entity)
            else list.push(structuredClone(entity))
          }
          return q
        })
      }
    }
  }

  private async copyAssetIfMissing(fromProjectId: Id, toProjectId: Id, file: AssetFileName): Promise<void> {
    if (!isValidAssetFileName(file)) return
    const target = this.assetPath(toProjectId, file)
    const source = this.assetPath(fromProjectId, file)
    if ((await pathExists(target)) || !(await pathExists(source))) return
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(source, target)
  }

  /* ------------------------------------------------------------------------ */
  /* Imágenes                                                                 */
  /* ------------------------------------------------------------------------ */

  /** Copia una imagen externa a `assets/` y devuelve su nuevo nombre. */
  async importAsset(projectId: Id, sourcePath: string): Promise<AssetFileName> {
    const extension = path.extname(sourcePath).slice(1).toLowerCase()
    if (!(IMAGE_EXTENSIONS as readonly string[]).includes(extension)) {
      throw new Error(`Formato de imagen no admitido: .${extension}`)
    }
    const fileName = `${randomUUID()}.${extension}`
    await fs.mkdir(this.assetsDir(projectId), { recursive: true })
    await fs.copyFile(sourcePath, path.join(this.assetsDir(projectId), fileName))
    return fileName
  }

  /** Guarda una imagen PNG recibida como data URL (p. ej. un retrato recortado). */
  async saveImageData(projectId: Id, dataUrl: string): Promise<AssetFileName> {
    assertSafeId(projectId, 'projectId')
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
    if (!match) throw new Error('Imagen no válida')
    const fileName = `${randomUUID()}.png`
    await fs.mkdir(this.assetsDir(projectId), { recursive: true })
    await fs.writeFile(path.join(this.assetsDir(projectId), fileName), Buffer.from(match[1], 'base64'))
    return fileName
  }

  /**
   * Borra una imagen que se añadió pero no se llegó a usar (p. ej. el
   * original de un retrato recortado). Si alguna ficha la usa, no hace nada.
   */
  discardAsset(projectId: Id, fileName: AssetFileName): Promise<void> {
    assertSafeId(projectId, 'projectId')
    if (!isValidAssetFileName(fileName)) throw new Error(`Nombre de imagen no válido: ${fileName}`)
    return this.withLock(projectId, async () => {
      const project = await this.getProject(projectId)
      if (unreferencedAssets(project, new Set([fileName])).length > 0) await this.deleteAsset(projectId, fileName)
    })
  }

  /** Ruta absoluta de un asset, validando que no se salga de su carpeta. */
  assetPath(projectId: Id, fileName: AssetFileName): string {
    if (!isValidAssetFileName(fileName)) throw new Error(`Nombre de imagen no válido: ${fileName}`)
    return path.join(this.assetsDir(projectId), fileName)
  }

  private async deleteAsset(projectId: Id, fileName: AssetFileName): Promise<void> {
    if (!isValidAssetFileName(fileName)) return
    await fs.rm(this.assetPath(projectId, fileName), { force: true })
  }

  /* ------------------------------------------------------------------------ */
  /* Internos                                                                 */
  /* ------------------------------------------------------------------------ */

  /**
   * Lee el proyecto, aplica `change` y lo guarda, todo bajo el candado del
   * proyecto. `updatedAt` se actualiza automáticamente.
   */
  private mutate(projectId: Id, change: (project: Project) => Project | Promise<Project>): Promise<Project> {
    assertSafeId(projectId, 'projectId')
    return this.withLock(projectId, async () => {
      const project = await change(await this.getProject(projectId))
      project.updatedAt = new Date().toISOString()
      await this.writeProject(project)
      this.options.onChange?.()
      return project
    })
  }

  private withLock<T>(projectId: Id, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(projectId) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(task)
    this.locks.set(projectId, next)
    void next.finally(() => {
      if (this.locks.get(projectId) === next) this.locks.delete(projectId)
    }).catch(() => undefined)
    return next
  }

  private writeProject(project: Project): Promise<void> {
    return writeJsonAtomic(this.projectFile(project.id), project)
  }

  private projectDir(projectId: Id): string {
    assertSafeId(projectId, 'projectId')
    return path.join(this.libraryRoot, projectId)
  }

  private projectFile(projectId: Id): string {
    return path.join(this.projectDir(projectId), PROJECT_FILE)
  }

  private assetsDir(projectId: Id): string {
    return path.join(this.projectDir(projectId), ASSETS_DIR)
  }

  private versionsDir(projectId: Id, chapterId: Id): string {
    assertSafeId(chapterId, 'chapterId')
    return path.join(this.projectDir(projectId), CHAPTERS_DIR, VERSIONS_DIR, chapterId)
  }

  private versionFile(projectId: Id, chapterId: Id, versionId: string): string {
    if (!VERSION_ID.test(versionId)) throw new Error(`Versión no válida: ${versionId}`)
    return path.join(this.versionsDir(projectId, chapterId), `${versionId}.json`)
  }

  private chapterFile(projectId: Id, chapterId: Id): string {
    assertSafeId(chapterId, 'chapterId')
    return path.join(this.projectDir(projectId), CHAPTERS_DIR, `${chapterId}.json`)
  }
}

function findOrThrow<T extends { id: Id }>(items: T[], id: Id, label: string): T {
  const item = items.find((i) => i.id === id)
  if (!item) throw new Error(`${label} no encontrado: ${id}`)
  return item
}

/** Rechaza colecciones desconocidas que lleguen desde la interfaz. */
function assertCollection(collection: unknown): asserts collection is EntityCollection {
  if (!ENTITY_COLLECTIONS.includes(collection as EntityCollection)) {
    throw new Error(`Colección no válida: ${String(collection)}`)
  }
}

/** Lista de fichas de una colección, con un tipo común para las operaciones genéricas. */
function entitiesOf(project: Project, collection: EntityCollection): { id: Id }[] {
  return project[collection]
}

function isWorldCollection(collection: EntityCollection): collection is WorldCollection {
  return (WORLD_COLLECTIONS as readonly string[]).includes(collection)
}

/** De `candidates`, las imágenes que ya no usa ninguna ficha ni la portada. */
function unreferencedAssets(project: Project, candidates: Set<AssetFileName>): AssetFileName[] {
  if (candidates.size === 0) return []
  const inUse = collectAssetRefs([...ENTITY_COLLECTIONS.map((c) => project[c]), project.cover])
  return [...candidates].filter((file) => !inUse.has(file))
}

/** Quita las referencias a una ficha borrada desde el resto del proyecto. */
/** Fichas recibidas de la interfaz: con id válido, sin repetir y con todos sus campos. */
function sanitizeList<C extends 'relationships' | 'relationGroups'>(list: unknown, collection: C): EntityMap[C][] {
  if (!Array.isArray(list)) throw new Error('Datos del mapa de relaciones no válidos')
  const seen = new Set<Id>()
  const result: EntityMap[C][] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const id = (item as { id?: unknown }).id
    assertSafeId(id, 'id')
    if (seen.has(id)) continue
    seen.add(id)
    result.push({ ...withEntityDefaults(collection, structuredClone(item) as object), id } as unknown as EntityMap[C])
  }
  return result
}

/** ¿Misma ficha, sin contar las fechas? */
function sameEntity(a: object, b: object): boolean {
  const strip = ({ createdAt: _c, updatedAt: _u, ...rest }: Record<string, unknown>) => rest
  return JSON.stringify(strip(a as Record<string, unknown>)) === JSON.stringify(strip(b as Record<string, unknown>))
}

function removeReferences(project: Project, collection: EntityCollection, id: Id): void {
  if (collection === 'characters') {
    project.relationships = project.relationships.filter((r) => r.sourceId !== id && r.targetId !== id)
    for (const group of project.relationGroups) group.memberIds = group.memberIds.filter((m) => m !== id)
    for (const event of project.events) event.characterIds = event.characterIds.filter((c) => c !== id)
    delete project.relationLayout[id]
  }
  if (collection === 'relationGroups') delete project.relationLayout[id]
  if (collection === 'lore') {
    for (const event of project.events) event.loreIds = event.loreIds.filter((l) => l !== id)
    for (const map of project.maps) for (const pin of map.pins) if (pin.loreId === id) pin.loreId = null
    for (const lineage of project.lineages) if (lineage.seatLoreId === id) lineage.seatLoreId = null
  }
  if (collection === 'races') {
    for (const character of project.characters) if (character.raceId === id) character.raceId = null
  }
  if (collection === 'lineages') {
    for (const character of project.characters) if (character.lineageId === id) character.lineageId = null
  }
}

/** Quita id y fechas: nunca se aceptan desde la interfaz. */
function stripSystemFields<T extends object>(input: T): Omit<T, 'id' | 'createdAt' | 'updatedAt'> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = input as T & Record<'id' | 'createdAt' | 'updatedAt', unknown>
  return rest
}

function toSummary(project: Project, sagaId: Id | null): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    genre: project.genre,
    wordCount: manuscriptWordCount(project.chapters),
    wordGoal: project.wordGoal,
    chapterCount: manuscriptChapters(project.chapters).length,
    characterCount: project.characters.length,
    loreCount: project.lore.length,
    creatureCount: project.creatures.length,
    coverImage: project.cover.front.image,
    sagaId,
    updatedAt: project.updatedAt
  }
}

/**
 * Antes de guardar un proyecto convertido a un esquema nuevo, deja una copia
 * del archivo tal como estaba (`project.schema-v3.json`, por ejemplo). Si una
 * migración tuviera un fallo, el original sigue ahí. Nunca sobrescribe una
 * copia que ya exista.
 */
async function keepPreMigrationCopy(projectFile: string, fromVersion: number): Promise<void> {
  const copy = path.join(path.dirname(projectFile), `project.schema-v${fromVersion}.json`)
  try {
    await fs.copyFile(projectFile, copy, fsConstants.COPYFILE_EXCL)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
}
