/**
 * Contrato de comunicación entre la interfaz (renderer) y el proceso
 * principal (main).
 *
 * La interfaz NO tiene acceso a Node ni al disco. Todo pasa por
 * `window.api`, que el preload expone con esta forma exacta.
 *
 * Para añadir una operación nueva:
 *  1. Añade el canal en `IPC`.
 *  2. Añade el método en `BlueFantasyApi`.
 *  3. Implementa el manejador en `src/main/ipc.ts`.
 *  4. Expónlo en `src/preload/index.ts`.
 */
import type {
  AppSettings,
  AssetFileName,
  BibleFormat,
  CloudFolder,
  ChapterMeta,
  ChapterSearchResult,
  ChapterVersion,
  EntityCollection,
  EntityInput,
  EntityMap,
  ExportFormat,
  ExportResult,
  Id,
  MentionIndex,
  NewProjectInput,
  Project,
  ProjectPatch,
  ProjectSummary,
  RestoreSummary,
  RichTextNode,
  Saga,
  SearchOptions,
  WritingSession
} from './types'

/** Nombres de los canales IPC. Un único sitio para evitar erratas. */
export const IPC = {
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectsGet: 'projects:get',
  projectsUpdate: 'projects:update',
  projectsDelete: 'projects:delete',
  projectsAddSession: 'projects:add-session',

  chaptersCreate: 'chapters:create',
  chaptersRename: 'chapters:rename',
  chaptersDelete: 'chapters:delete',
  chaptersReorder: 'chapters:reorder',
  chaptersGetContent: 'chapters:get-content',
  chaptersSaveContent: 'chapters:save-content',
  chaptersSetDraft: 'chapters:set-draft',
  chaptersListVersions: 'chapters:list-versions',
  chaptersGetVersion: 'chapters:get-version',
  chaptersRestoreVersion: 'chapters:restore-version',

  manuscriptSearch: 'manuscript:search',
  manuscriptReplace: 'manuscript:replace',
  manuscriptMentions: 'manuscript:mentions',

  entitiesCreate: 'entities:create',
  entitiesUpdate: 'entities:update',
  entitiesDelete: 'entities:delete',
  entitiesImport: 'entities:import',

  assetsPickImage: 'assets:pick-image',
  assetsPickImages: 'assets:pick-images',
  assetsImportFile: 'assets:import-file',

  filesSavePng: 'files:save-png',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',

  backupDetectClouds: 'backup:detect-clouds',
  backupUseFolder: 'backup:use-folder',
  backupChooseFolder: 'backup:choose-folder',
  backupRunNow: 'backup:run-now',
  backupRestore: 'backup:restore',

  exportProject: 'export:project',
  exportBible: 'export:bible',

  sagasList: 'sagas:list',
  sagasCreate: 'sagas:create',
  sagasAddProject: 'sagas:add-project',
  sagasRemoveProject: 'sagas:remove-project',
  sagasRename: 'sagas:rename',
  sagasDelete: 'sagas:delete',

  libraryGetPath: 'library:get-path',
  libraryOpenFolder: 'library:open-folder',

  /** main -> interfaz: "voy a cerrar, guarda lo pendiente". */
  appCloseRequested: 'app:close-requested',
  /** interfaz -> main: "ya he guardado, puedes cerrar". */
  appCloseReady: 'app:close-ready'
} as const

export interface BlueFantasyApi {
  projects: {
    list(): Promise<ProjectSummary[]>
    create(input: NewProjectInput): Promise<Project>
    get(projectId: Id): Promise<Project>
    update(projectId: Id, patch: ProjectPatch): Promise<Project>
    delete(projectId: Id): Promise<void>
    /** Registra un sprint de escritura terminado. */
    addSession(projectId: Id, session: WritingSession): Promise<Project>
  }
  chapters: {
    /** `draft`: crearlo en Borradores (fuera del manuscrito). */
    create(projectId: Id, title: string, draft?: boolean): Promise<{ project: Project; chapter: ChapterMeta }>
    /** Pasa un capítulo a Borradores o lo devuelve al manuscrito. */
    setDraft(projectId: Id, chapterId: Id, draft: boolean): Promise<Project>
    rename(projectId: Id, chapterId: Id, title: string): Promise<Project>
    delete(projectId: Id, chapterId: Id): Promise<Project>
    /** Recibe la lista completa de ids en el nuevo orden. */
    reorder(projectId: Id, orderedIds: Id[]): Promise<Project>
    getContent(projectId: Id, chapterId: Id): Promise<RichTextNode>
    /** Guarda el contenido, recalcula palabras y actualiza estadísticas. */
    saveContent(projectId: Id, chapterId: Id, doc: RichTextNode): Promise<Project>
    /** Historial: versiones guardadas automáticamente (de la más reciente a la más antigua). */
    listVersions(projectId: Id, chapterId: Id): Promise<ChapterVersion[]>
    getVersion(projectId: Id, chapterId: Id, versionId: string): Promise<RichTextNode>
    /** Restaura una versión (guardando antes la actual, para poder volver). */
    restoreVersion(projectId: Id, chapterId: Id, versionId: string): Promise<Project>
  }
  manuscript: {
    search(projectId: Id, query: string, options: SearchOptions): Promise<ChapterSearchResult[]>
    /** Reemplaza en todos los capítulos; guarda antes una versión de los afectados. */
    replace(
      projectId: Id,
      query: string,
      replacement: string,
      options: SearchOptions
    ): Promise<{ project: Project; count: number }>
    /** En qué capítulos se nombra cada personaje, entrada de lore y criatura. */
    mentions(projectId: Id): Promise<MentionIndex>
  }
  /**
   * Fichas: personajes, lore y criaturas del bestiario. Todas funcionan igual;
   * `collection` indica de cuál se trata.
   */
  entities: {
    create<C extends EntityCollection>(
      projectId: Id,
      collection: C,
      input: EntityInput<C>
    ): Promise<{ project: Project; entity: EntityMap[C] }>
    update<C extends EntityCollection>(
      projectId: Id,
      collection: C,
      entityId: Id,
      input: Partial<EntityInput<C>>
    ): Promise<Project>
    /** Borra la ficha, sus imágenes y las referencias a ella en otras fichas. */
    delete(projectId: Id, collection: EntityCollection, entityId: Id): Promise<Project>
    /** Copia fichas desde otra historia (sagas que comparten mundo). */
    import(
      projectId: Id,
      sourceProjectId: Id,
      collection: 'characters' | 'lore' | 'creatures' | 'races' | 'glossary' | 'lineages',
      entityIds: Id[]
    ): Promise<Project>
  }
  assets: {
    /**
     * Abre el selector de archivos, copia la imagen elegida a la carpeta del
     * proyecto y devuelve su nombre (o null si se cancela). Después hay que
     * asignarla a la ficha con `entities.update(..., { image })`.
     */
    pickImage(projectId: Id): Promise<AssetFileName | null>
    /** Igual que `pickImage` pero permite elegir varias imágenes. */
    pickImages(projectId: Id): Promise<AssetFileName[]>
    /** Copia al proyecto una imagen soltada con arrastrar y soltar (ver `files.pathOf`). */
    importFile(projectId: Id, filePath: string): Promise<AssetFileName>
  }
  files: {
    /** Ruta en disco de un archivo soltado sobre la ventana (arrastrar y soltar). */
    pathOf(file: File): string
    /** Pide ruta y guarda una imagen PNG (data URL), p. ej. una tarjeta para redes. */
    savePng(dataUrl: string, suggestedName: string): Promise<ExportResult>
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  backup: {
    /** Google Drive, OneDrive, Dropbox o iCloud instalados en este equipo. */
    detectClouds(): Promise<CloudFolder[]>
    /**
     * Activa las copias en `<folder>/BlueFantasyNovel (copias)` y hace la
     * primera. Devuelve los ajustes actualizados (también si la copia falla:
     * el motivo queda en `backup.lastError`).
     */
    useFolder(folder: string): Promise<AppSettings>
    /** Igual que `useFolder`, eligiendo la carpeta en un diálogo. Null si se cancela. */
    chooseFolder(): Promise<AppSettings | null>
    /** Hace una copia ahora. Devuelve la carpeta creada. */
    runNow(): Promise<string>
    /** Elige una copia en un diálogo y restaura sus historias. Null si se cancela. */
    restore(): Promise<RestoreSummary | null>
  }
  exporter: {
    /** Abre el diálogo "Guardar como" y exporta el manuscrito completo. */
    exportProject(projectId: Id, format: ExportFormat): Promise<ExportResult>
    /** Exporta la Biblia del Mundo (todo el worldbuilding). */
    exportBible(projectId: Id, format: BibleFormat): Promise<ExportResult>
  }
  /**
   * Sagas: historias que comparten mundo. Al crear una saga o añadir una
   * historia, sus fichas del mundo se unen; después, cada cambio se replica.
   */
  sagas: {
    list(): Promise<Saga[]>
    create(name: string, projectIds: Id[]): Promise<Saga>
    addProject(sagaId: Id, projectId: Id): Promise<Saga>
    removeProject(projectId: Id): Promise<void>
    rename(sagaId: Id, name: string): Promise<void>
    delete(sagaId: Id): Promise<void>
  }
  library: {
    getPath(): Promise<string>
    /** Abre la carpeta de datos en el explorador de archivos. */
    openFolder(): Promise<void>
  }
  app: {
    /**
     * Se ejecuta cuando el usuario cierra la ventana. La interfaz debe guardar
     * lo pendiente y llamar a `confirmClose()`. Devuelve la función para
     * dejar de escuchar.
     */
    onCloseRequested(callback: () => void): () => void
    confirmClose(): void
  }
}
