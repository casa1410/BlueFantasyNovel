/**
 * Preload: expone `window.api` a la interfaz de forma segura.
 *
 * Cada método es un simple `ipcRenderer.invoke` hacia un canal de `IPC`.
 * El objeto está tipado con `BlueFantasyApi`, así que si el contrato cambia
 * y olvidas actualizar este archivo, TypeScript dará error.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC, type BlueFantasyApi } from '@shared/api'

const invoke = ipcRenderer.invoke.bind(ipcRenderer)

const api: BlueFantasyApi = {
  projects: {
    list: () => invoke(IPC.projectsList),
    create: (input) => invoke(IPC.projectsCreate, input),
    get: (projectId) => invoke(IPC.projectsGet, projectId),
    update: (projectId, patch) => invoke(IPC.projectsUpdate, projectId, patch),
    delete: (projectId) => invoke(IPC.projectsDelete, projectId),
    addSession: (projectId, session) => invoke(IPC.projectsAddSession, projectId, session)
  },
  chapters: {
    create: (projectId, title, draft) => invoke(IPC.chaptersCreate, projectId, title, draft),
    setDraft: (projectId, chapterId, draft) => invoke(IPC.chaptersSetDraft, projectId, chapterId, draft),
    rename: (projectId, chapterId, title) => invoke(IPC.chaptersRename, projectId, chapterId, title),
    delete: (projectId, chapterId) => invoke(IPC.chaptersDelete, projectId, chapterId),
    reorder: (projectId, orderedIds) => invoke(IPC.chaptersReorder, projectId, orderedIds),
    getContent: (projectId, chapterId) => invoke(IPC.chaptersGetContent, projectId, chapterId),
    saveContent: (projectId, chapterId, doc) => invoke(IPC.chaptersSaveContent, projectId, chapterId, doc),
    listVersions: (projectId, chapterId) => invoke(IPC.chaptersListVersions, projectId, chapterId),
    getVersion: (projectId, chapterId, versionId) => invoke(IPC.chaptersGetVersion, projectId, chapterId, versionId),
    restoreVersion: (projectId, chapterId, versionId) =>
      invoke(IPC.chaptersRestoreVersion, projectId, chapterId, versionId)
  },
  manuscript: {
    search: (projectId, query, options) => invoke(IPC.manuscriptSearch, projectId, query, options),
    replace: (projectId, query, replacement, options) =>
      invoke(IPC.manuscriptReplace, projectId, query, replacement, options),
    mentions: (projectId) => invoke(IPC.manuscriptMentions, projectId)
  },
  entities: {
    create: (projectId, collection, input) => invoke(IPC.entitiesCreate, projectId, collection, input),
    update: (projectId, collection, entityId, input) =>
      invoke(IPC.entitiesUpdate, projectId, collection, entityId, input),
    delete: (projectId, collection, entityId) => invoke(IPC.entitiesDelete, projectId, collection, entityId),
    import: (projectId, sourceProjectId, collection, entityIds) =>
      invoke(IPC.entitiesImport, projectId, sourceProjectId, collection, entityIds)
  },
  assets: {
    pickImage: (projectId) => invoke(IPC.assetsPickImage, projectId),
    pickImages: (projectId) => invoke(IPC.assetsPickImages, projectId),
    importFile: (projectId, filePath) => invoke(IPC.assetsImportFile, projectId, filePath)
  },
  files: {
    pathOf: (file) => webUtils.getPathForFile(file),
    savePng: (dataUrl, suggestedName) => invoke(IPC.filesSavePng, dataUrl, suggestedName)
  },
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (patch) => invoke(IPC.settingsUpdate, patch)
  },
  backup: {
    detectClouds: () => invoke(IPC.backupDetectClouds),
    useFolder: (folder) => invoke(IPC.backupUseFolder, folder),
    chooseFolder: () => invoke(IPC.backupChooseFolder),
    runNow: () => invoke(IPC.backupRunNow),
    restore: () => invoke(IPC.backupRestore)
  },
  exporter: {
    exportProject: (projectId, format) => invoke(IPC.exportProject, projectId, format),
    exportBible: (projectId, format) => invoke(IPC.exportBible, projectId, format)
  },
  sagas: {
    list: () => invoke(IPC.sagasList),
    create: (name, projectIds) => invoke(IPC.sagasCreate, name, projectIds),
    addProject: (sagaId, projectId) => invoke(IPC.sagasAddProject, sagaId, projectId),
    removeProject: (projectId) => invoke(IPC.sagasRemoveProject, projectId),
    rename: (sagaId, name) => invoke(IPC.sagasRename, sagaId, name),
    delete: (sagaId) => invoke(IPC.sagasDelete, sagaId)
  },
  library: {
    getPath: () => invoke(IPC.libraryGetPath),
    openFolder: () => invoke(IPC.libraryOpenFolder)
  },
  app: {
    onCloseRequested: (callback) => {
      const listener = () => callback()
      ipcRenderer.on(IPC.appCloseRequested, listener)
      return () => ipcRenderer.removeListener(IPC.appCloseRequested, listener)
    },
    confirmClose: () => ipcRenderer.send(IPC.appCloseReady)
  }
}

contextBridge.exposeInMainWorld('api', api)
