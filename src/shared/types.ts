/**
 * Modelo de datos de BlueFantasyNovel.
 *
 * Estos tipos describen exactamente lo que se guarda en disco (ver
 * docs/ARQUITECTURA.md > "Formato de datos"). Si cambias la forma de un
 * objeto persistido, sube `CURRENT_SCHEMA_VERSION` y añade una migración en
 * `src/main/storage/migrations.ts`.
 */

export const CURRENT_SCHEMA_VERSION = 4

/** Identificador único (UUID v4). */
export type Id = string

/** Fecha y hora en formato ISO 8601, p. ej. "2026-09-29T18:04:00.000Z". */
export type IsoDateTime = string

/** Día local en formato "AAAA-MM-DD". Se usa como clave de estadísticas. */
export type DayKey = string

/* -------------------------------------------------------------------------- */
/* Texto enriquecido                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Nodo de texto enriquecido en el formato JSON de ProseMirror/TipTap.
 * Un capítulo es un árbol cuya raíz tiene `type: "doc"`.
 */
export interface RichTextNode {
  type: string
  attrs?: Record<string, unknown>
  content?: RichTextNode[]
  text?: string
  marks?: RichTextMark[]
}

export interface RichTextMark {
  type: string
  attrs?: Record<string, unknown>
}

/* -------------------------------------------------------------------------- */
/* Proyecto (historia)                                                        */
/* -------------------------------------------------------------------------- */

/** Metadatos de un capítulo. El contenido va en un archivo aparte. */
export interface ChapterMeta {
  id: Id
  title: string
  /** Recuento de palabras calculado en el último guardado. */
  wordCount: number
  /**
   * Borrador: no forma parte del manuscrito (no se exporta ni cuenta para el
   * total ni el objetivo), pero sí para las palabras escritas cada día.
   */
  draft: boolean
  /**
   * Escenas del capítulo, calculadas al guardar a partir de los separadores
   * de escena (línea horizontal). Es una caché de solo lectura.
   */
  scenes: SceneMeta[]
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface SceneMeta {
  /** Título: el encabezado con el que empieza la escena o sus primeras palabras. */
  title: string
  wordCount: number
  /** Separadores de escena que hay antes (para saltar a ella en el editor). */
  separatorsBefore: number
}

export const CHARACTER_ROLES = [
  'protagonista',
  'antagonista',
  'secundario',
  'mentor',
  'aliado',
  'otro'
] as const

export type CharacterRole = (typeof CHARACTER_ROLES)[number]

export interface Character {
  id: Id
  name: string
  /** Otros nombres con los que aparece en el texto ("Aelis", "la cartógrafa"). */
  aliases: string[]
  role: CharacterRole
  /** Texto libre: "34", "unos 300 años", "desconocida"... */
  age: string
  appearance: string
  personality: string
  motivation: string
  fears: string
  /** Arco narrativo: de dónde parte el personaje y adónde llega. */
  arc: string
  notes: string
  /** Color identificativo en formato hex (#rrggbb). */
  color: string
  /** Raza (ficha de `races`) o null. */
  raceId: Id | null
  /** Linaje, casa o clan (ficha de `lineages`) o null. */
  lineageId: Id | null
  /** Retrato: nombre de archivo dentro de `assets/` ('' = sin imagen). */
  image: AssetFileName
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Lore                                                                       */
/* -------------------------------------------------------------------------- */

export const LORE_CATEGORIES = [
  'lugar',
  'faccion',
  'magia',
  'objeto',
  'historia',
  'religion',
  'cultura',
  'otro'
] as const

export type LoreCategory = (typeof LORE_CATEGORIES)[number]

/** Entrada de la enciclopedia del mundo: un lugar, una orden, un hechizo… */
export interface LoreEntry {
  id: Id
  title: string
  /** Otros nombres con los que aparece en el texto. */
  aliases: string[]
  category: LoreCategory
  /** Una línea que resume la entrada (se ve en listas y en el panel de referencia). */
  summary: string
  body: string
  tags: string[]
  /** Ilustración: nombre de archivo dentro de `assets/` ('' = sin imagen). */
  image: AssetFileName
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Bestiario                                                                  */
/* -------------------------------------------------------------------------- */

export const CREATURE_TYPES = [
  'bestia',
  'dragon',
  'espiritu',
  'no-muerto',
  'humanoide',
  'constructo',
  'planta',
  'aberracion',
  'otro'
] as const

export type CreatureType = (typeof CREATURE_TYPES)[number]

/** Peligrosidad de 1 (inofensiva) a 5 (catastrófica). */
export type DangerLevel = 1 | 2 | 3 | 4 | 5

export interface Creature {
  id: Id
  name: string
  /** Otros nombres con los que aparece en el texto. */
  aliases: string[]
  type: CreatureType
  danger: DangerLevel
  habitat: string
  size: string
  appearance: string
  behavior: string
  abilities: string
  weaknesses: string
  notes: string
  /** Ilustración: nombre de archivo dentro de `assets/` ('' = sin imagen). */
  image: AssetFileName
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Razas, glosario y linajes                                                  */
/* -------------------------------------------------------------------------- */

export interface Race {
  id: Id
  name: string
  aliases: string[]
  appearance: string
  /** Esperanza de vida, texto libre ("unos 300 años"). */
  lifespan: string
  /** Dónde viven (texto libre). */
  homeland: string
  culture: string
  abilities: string
  notes: string
  color: string
  image: AssetFileName
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/** Término del glosario del mundo: palabras inventadas, títulos, unidades… */
export interface GlossaryEntry {
  id: Id
  term: string
  aliases: string[]
  definition: string
  /** Categoría libre ("idioma élfico", "moneda"…). */
  category: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/** Linaje, casa noble, dinastía o clan. Sus miembros son personajes con `lineageId`. */
export interface Lineage {
  id: Id
  name: string
  aliases: string[]
  motto: string
  description: string
  /** Sede o territorio (entrada de lore) o null. */
  seatLoreId: Id | null
  color: string
  /** Emblema o escudo. */
  image: AssetFileName
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Tramas                                                                     */
/* -------------------------------------------------------------------------- */

/** Línea argumental. `beats` guarda qué ocurre en ella en cada capítulo. */
export interface Plotline {
  id: Id
  name: string
  description: string
  color: string
  /** Texto por capítulo (id del capítulo → qué pasa en esta trama). */
  beats: Record<Id, string>
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Comentarios al margen                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Comentario sobre un fragmento del texto. El fragmento se marca en el
 * documento del capítulo con la marca `comment` y el atributo `commentId`.
 */
export interface MarginComment {
  id: Id
  chapterId: Id
  /** Texto comentado en el momento de crear el comentario (para mostrarlo). */
  quote: string
  text: string
  resolved: boolean
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Relaciones entre personajes                                                */
/* -------------------------------------------------------------------------- */

/**
 * Tipos de relación. `progenitor` es DIRIGIDA (origen = padre/madre de
 * destino) y es la que construye el árbol genealógico junto con `pareja`.
 * El resto se leen en ambos sentidos.
 */
export const RELATIONSHIP_KINDS = [
  'progenitor',
  'pareja',
  'hermanos',
  'familia',
  'amistad',
  'amor',
  'alianza',
  'mentor',
  'rivalidad',
  'enemistad',
  'otro'
] as const

export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number]

export interface Relationship {
  id: Id
  /** Personaje de origen. */
  sourceId: Id
  /** Personaje de destino. */
  targetId: Id
  kind: RelationshipKind
  /** Texto libre opcional que se muestra sobre la línea ("prometidos en secreto"). */
  label: string
  notes: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/** Posición de un nodo en un diagrama. */
export interface Point {
  x: number
  y: number
}

/* -------------------------------------------------------------------------- */
/* Línea temporal y calendario del mundo                                      */
/* -------------------------------------------------------------------------- */

export interface CalendarMonth {
  name: string
  days: number
}

/** Calendario propio del mundo (meses con nombre y duración libres). */
export interface WorldCalendar {
  /** Sufijo de los años: "d.C.", "de la Era del Mar"… */
  eraName: string
  months: CalendarMonth[]
}

export interface TimelineEvent {
  id: Id
  title: string
  description: string
  /** Año (puede ser negativo para "antes de la era"). */
  year: number
  /** Índice del mes en `calendar.months` (null = solo el año). */
  month: number | null
  /** Día del mes, empezando en 1 (null = sin día). */
  day: number | null
  color: string
  characterIds: Id[]
  loreIds: Id[]
  /** Capítulo en el que ocurre o se narra (null = ninguno). */
  chapterId: Id | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Mapas del mundo                                                            */
/* -------------------------------------------------------------------------- */

export interface MapPin {
  id: Id
  /** Posición relativa a la imagen: 0 = borde izquierdo/superior, 1 = derecho/inferior. */
  x: number
  y: number
  label: string
  color: string
  /** Entrada de lore vinculada (normalmente un lugar). */
  loreId: Id | null
}

export interface WorldMap {
  id: Id
  name: string
  image: AssetFileName
  pins: MapPin[]
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Tableros de inspiración                                                    */
/* -------------------------------------------------------------------------- */

export interface BoardItem {
  id: Id
  image: AssetFileName
  caption: string
}

export interface Moodboard {
  id: Id
  name: string
  description: string
  items: BoardItem[]
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/* -------------------------------------------------------------------------- */
/* Sesiones de escritura                                                      */
/* -------------------------------------------------------------------------- */

/** Un sprint de escritura terminado. */
export interface WritingSession {
  start: IsoDateTime
  minutes: number
  words: number
}

/* -------------------------------------------------------------------------- */
/* Colecciones de fichas                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Colecciones de "fichas" del proyecto. Todas comparten el mismo ciclo de
 * vida (crear, editar, borrar, imagen opcional), así que el almacenamiento y
 * la API las tratan de forma genérica. Para añadir una nueva (p. ej.
 * "locations"), añádela aquí y en `Project`.
 */
export interface EntityMap {
  characters: Character
  lore: LoreEntry
  creatures: Creature
  relationships: Relationship
  events: TimelineEvent
  maps: WorldMap
  boards: Moodboard
  races: Race
  glossary: GlossaryEntry
  lineages: Lineage
  plotlines: Plotline
  comments: MarginComment
}

export type EntityCollection = keyof EntityMap
export const ENTITY_COLLECTIONS: EntityCollection[] = [
  'characters',
  'lore',
  'creatures',
  'relationships',
  'events',
  'maps',
  'boards',
  'races',
  'glossary',
  'lineages',
  'plotlines',
  'comments'
]

/** Colecciones que pueden mencionarse en el texto del manuscrito. */
export type MentionableCollection = 'characters' | 'lore' | 'creatures' | 'races' | 'glossary' | 'lineages'

/**
 * Colecciones del "mundo": en una saga, las comparten todas sus historias
 * (un cambio en un libro se aplica a todos).
 */
export const WORLD_COLLECTIONS = ['characters', 'lore', 'creatures', 'races', 'glossary', 'lineages', 'relationships'] as const
export type WorldCollection = (typeof WORLD_COLLECTIONS)[number]

/** Campos que gestiona el sistema y no se pueden editar. */
type SystemFields = 'id' | 'createdAt' | 'updatedAt'

/** Datos editables de una ficha de la colección `C`. */
export type EntityInput<C extends EntityCollection> = Omit<EntityMap[C], SystemFields>

/**
 * Nombre de un archivo de imagen guardado en `<proyecto>/assets/`, p. ej.
 * "3f2a…c1.png". Cadena vacía = sin imagen.
 */
export type AssetFileName = string

export interface Project {
  schemaVersion: number
  id: Id
  title: string
  description: string
  genre: string
  /** Objetivo de palabras del manuscrito completo (0 = sin objetivo). */
  wordGoal: number
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  /** Capítulos en orden de lectura. */
  chapters: ChapterMeta[]
  characters: Character[]
  lore: LoreEntry[]
  creatures: Creature[]
  relationships: Relationship[]
  events: TimelineEvent[]
  maps: WorldMap[]
  boards: Moodboard[]
  calendar: WorldCalendar
  /** Posición de cada personaje (por id) en el mapa de relaciones. */
  relationLayout: Record<Id, Point>
  /** Palabras nuevas escritas cada día. Solo suma, nunca resta. */
  dailyWords: Record<DayKey, number>
  /** Objetivo de palabras nuevas por día (0 = sin objetivo). */
  dailyGoal: number
  sessions: WritingSession[]
  races: Race[]
  glossary: GlossaryEntry[]
  lineages: Lineage[]
  plotlines: Plotline[]
  comments: MarginComment[]
  cover: CoverDesign
}

/* -------------------------------------------------------------------------- */
/* Portada                                                                    */
/* -------------------------------------------------------------------------- */

export const COVER_TEMPLATES = ['brasa', 'bosque', 'noche', 'sangre', 'pergamino', 'arcano'] as const
export type CoverTemplate = (typeof COVER_TEMPLATES)[number]

export const COVER_FONTS = ['serif-clasica', 'serif-elegante', 'sans', 'antigua', 'moderna'] as const
export type CoverFont = (typeof COVER_FONTS)[number]

/** Una cara del libro: imagen opcional y cuánto se oscurece para que el texto se lea. */
export interface CoverFace {
  image: AssetFileName
  /** 0 = imagen tal cual, 1 = negro. */
  dim: number
}

export interface CoverDesign {
  template: CoverTemplate
  front: CoverFace
  spine: CoverFace
  back: CoverFace
  title: string
  author: string
  subtitle: string
  backText: string
  font: CoverFont
  /** Tamaño del título relativo al ancho de la portada (0,06–0,16). */
  titleSize: number
  titlePosition: 'top' | 'center' | 'bottom'
}

/** Resumen ligero para la biblioteca (no incluye capítulos ni personajes). */
export interface ProjectSummary {
  id: Id
  title: string
  description: string
  genre: string
  wordCount: number
  wordGoal: number
  chapterCount: number
  characterCount: number
  loreCount: number
  creatureCount: number
  /** Ilustración del frente de la cubierta (sección «Cubierta») o ''. */
  coverImage: AssetFileName
  /** Saga a la que pertenece o null. */
  sagaId: Id | null
  updatedAt: IsoDateTime
}

/** Saga: varias historias que comparten mundo (ver WORLD_COLLECTIONS). */
export interface Saga {
  id: Id
  name: string
  projectIds: Id[]
}

/** Campos editables de un proyecto desde la interfaz. */
export type ProjectPatch = Partial<
  Pick<Project, 'title' | 'description' | 'genre' | 'wordGoal' | 'dailyGoal' | 'calendar' | 'relationLayout' | 'cover'>
>

/** Datos para crear un proyecto nuevo. */
export type NewProjectInput = Pick<Project, 'title' | 'description' | 'genre'>

/** Datos editables de un personaje (lo demás lo gestiona el sistema). */
export type CharacterInput = EntityInput<'characters'>

/* -------------------------------------------------------------------------- */
/* Exportación                                                                */
/* -------------------------------------------------------------------------- */

export const EXPORT_FORMATS = ['docx', 'pdf', 'epub', 'html', 'md', 'txt'] as const

/** Formatos de la Biblia del Mundo. */
export const BIBLE_FORMATS = ['pdf', 'docx', 'html'] as const
export type BibleFormat = (typeof BIBLE_FORMATS)[number]
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export type ExportResult = { status: 'saved'; filePath: string } | { status: 'canceled' }

/* -------------------------------------------------------------------------- */
/* Historial de versiones                                                     */
/* -------------------------------------------------------------------------- */

/** Instantánea guardada de un capítulo. */
export interface ChapterVersion {
  /** Marca de tiempo en milisegundos, como texto (también es el nombre del archivo). */
  id: string
  createdAt: IsoDateTime
  wordCount: number
}

/* -------------------------------------------------------------------------- */
/* Búsqueda                                                                   */
/* -------------------------------------------------------------------------- */

export interface SearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
}

export interface SearchMatch {
  /** Texto antes, coincidencia y texto después, para mostrarla en contexto. */
  before: string
  match: string
  after: string
}

export interface ChapterSearchResult {
  chapterId: Id
  title: string
  matches: SearchMatch[]
}

/* -------------------------------------------------------------------------- */
/* Menciones                                                                  */
/* -------------------------------------------------------------------------- */

/** Apariciones de cada ficha (por id): veces que se nombra en cada capítulo. */
export type MentionIndex = Record<Id, { chapterId: Id; count: number }[]>

/* -------------------------------------------------------------------------- */
/* Ajustes de la aplicación                                                   */
/* -------------------------------------------------------------------------- */

export type ThemePreference = 'dark' | 'light' | 'system'

export interface AppSettings {
  theme: ThemePreference
  editorFont: 'serif' | 'sans' | 'mono'
  /** Tamaño de letra del editor en px. */
  editorFontSize: number
  /** Ancho máximo de la columna de texto en px. */
  editorWidth: number
  backup: {
    enabled: boolean
    /** Carpeta de destino ('' = sin configurar). */
    folder: string
    /** Días de los que se conserva copia (la más reciente de cada día). */
    keep: number
    /** Última copia realizada (ISO) o '' si nunca. */
    lastBackupAt: string
    /** Motivo del último fallo ('' si la última copia salió bien). */
    lastError: string
  }
}

/** Carpeta sincronizada con un servicio en la nube, detectada en este equipo. */
export interface CloudFolder {
  service: 'google-drive' | 'onedrive' | 'dropbox' | 'icloud'
  label: string
  path: string
}

/** Resultado de restaurar una copia de seguridad. */
export interface RestoreSummary {
  /** Copia de la que se ha restaurado. */
  from: string
  /** Historias que no existían y se han añadido. */
  added: number
  /** Historias sustituidas por una versión más reciente de la copia. */
  updated: number
  /** Historias que ya estaban igual o más actualizadas en este equipo. */
  skipped: number
}
