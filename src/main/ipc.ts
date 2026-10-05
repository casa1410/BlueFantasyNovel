/**
 * Manejadores IPC: traducen cada llamada de `window.api` (ver
 * src/shared/api.ts) a una operación del repositorio o del exportador.
 *
 * Regla: aquí no hay lógica de negocio, solo "cableado". La lógica vive en
 * ProjectRepository y en los módulos de exportación.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/api'
import { BIBLE_FORMATS, EXPORT_FORMATS, type BibleFormat, type ExportFormat } from '@shared/types'
import { pickImages } from './assets'
import type { BackupService } from './backup'
import { detectCloudFolders } from './cloudFolders'
import { exportBible, exportProject } from './export'
import type { SettingsStore } from './settings'
import { assertSafeId } from './storage/fsUtils'
import type { ProjectRepository } from './storage/ProjectRepository'

// Los argumentos llegan sin tipo desde la interfaz; el repositorio los valida.
type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown

function handle(channel: string, handler: Handler): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args)
    } catch (error) {
      console.error(`[ipc] ${channel} falló:`, error)
      throw error // Electron lo reenvía a la interfaz como Promise rechazada.
    }
  })
}

export function registerIpcHandlers(repository: ProjectRepository, settings: SettingsStore, backups: BackupService): void {
  const windowOf = (event: IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender)

  // Proyectos
  handle(IPC.projectsList, () => repository.listProjects())
  handle(IPC.projectsCreate, (_e, input) => repository.createProject(input))
  handle(IPC.projectsGet, (_e, projectId) => repository.getProject(projectId))
  handle(IPC.projectsUpdate, (_e, projectId, patch) => repository.updateProject(projectId, patch))
  handle(IPC.projectsDelete, (_e, projectId) => repository.deleteProject(projectId))
  handle(IPC.projectsAddSession, (_e, projectId, session) => repository.addSession(projectId, session))

  // Capítulos
  handle(IPC.chaptersCreate, (_e, projectId, title, draft) => repository.createChapter(projectId, title, Boolean(draft)))
  handle(IPC.chaptersSetDraft, (_e, projectId, chapterId, draft) => repository.setChapterDraft(projectId, chapterId, draft))
  handle(IPC.chaptersRename, (_e, projectId, chapterId, title) => repository.renameChapter(projectId, chapterId, title))
  handle(IPC.chaptersDelete, (_e, projectId, chapterId) => repository.deleteChapter(projectId, chapterId))
  handle(IPC.chaptersReorder, (_e, projectId, orderedIds) => repository.reorderChapters(projectId, orderedIds))
  handle(IPC.chaptersGetContent, (_e, projectId, chapterId) => repository.getChapterContent(projectId, chapterId))
  handle(IPC.chaptersSaveContent, (_e, projectId, chapterId, doc) =>
    repository.saveChapterContent(projectId, chapterId, doc)
  )
  handle(IPC.chaptersListVersions, (_e, projectId, chapterId) => repository.listVersions(projectId, chapterId))
  handle(IPC.chaptersGetVersion, (_e, projectId, chapterId, versionId) =>
    repository.getVersion(projectId, chapterId, versionId)
  )
  handle(IPC.chaptersRestoreVersion, (_e, projectId, chapterId, versionId) =>
    repository.restoreVersion(projectId, chapterId, versionId)
  )

  // Manuscrito completo
  handle(IPC.manuscriptSearch, (_e, projectId, query, options) => repository.searchManuscript(projectId, query, options))
  handle(IPC.manuscriptReplace, (_e, projectId, query, replacement, options) =>
    repository.replaceInManuscript(projectId, query, replacement, options)
  )
  handle(IPC.manuscriptMentions, (_e, projectId) => repository.analyzeMentions(projectId))

  // Fichas (personajes, lore, criaturas)
  handle(IPC.entitiesCreate, (_e, projectId, collection, input) => repository.createEntity(projectId, collection, input))
  handle(IPC.entitiesUpdate, (_e, projectId, collection, entityId, input) =>
    repository.updateEntity(projectId, collection, entityId, input)
  )
  handle(IPC.entitiesDelete, (_e, projectId, collection, entityId) =>
    repository.deleteEntity(projectId, collection, entityId)
  )
  handle(IPC.entitiesImport, (_e, projectId, sourceProjectId, collection, entityIds) =>
    repository.importEntities(projectId, sourceProjectId, collection, entityIds)
  )
  handle(IPC.entitiesReorder, (_e, projectId, collection, orderedIds) =>
    repository.reorderEntities(projectId, collection, orderedIds)
  )
  handle(IPC.relationsApply, (_e, projectId, state) => repository.applyRelationMap(projectId, state))

  // Imágenes
  handle(IPC.assetsPickImage, async (event, projectId) => (await pickImages(repository, projectId, windowOf(event), false))[0] ?? null)
  handle(IPC.assetsPickImages, (event, projectId) => pickImages(repository, projectId, windowOf(event), true))
  // Solo copia archivos de imagen (importAsset rechaza cualquier otra extensión).
  handle(IPC.assetsImportFile, (_e, projectId, filePath) => {
    assertSafeId(projectId, 'projectId')
    return repository.importAsset(projectId, String(filePath))
  })
  handle(IPC.assetsSaveImage, (_e, projectId, dataUrl) => repository.saveImageData(projectId, String(dataUrl)))
  handle(IPC.assetsDiscard, (_e, projectId, fileName) => repository.discardAsset(projectId, fileName))

  // Archivos sueltos
  handle(IPC.filesSavePng, async (event, dataUrl: string, suggestedName: string) => {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl))
    if (!match) throw new Error('Imagen no válida')
    const safeName = String(suggestedName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'imagen'
    const options = {
      title: 'Guardar imagen',
      defaultPath: path.join(app.getPath('pictures'), `${safeName}.png`),
      filters: [{ name: 'Imagen PNG', extensions: ['png'] }]
    }
    const win = windowOf(event)
    const { canceled, filePath } = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (canceled || !filePath) return { status: 'canceled' }
    await fs.writeFile(filePath, Buffer.from(match[1], 'base64'))
    return { status: 'saved', filePath }
  })

  // Ajustes
  handle(IPC.settingsGet, () => settings.get())
  handle(IPC.settingsUpdate, (_e, patch) => settings.update(patch))

  // Copias de seguridad
  const pickFolder = async (event: IpcMainInvokeEvent, title: string, defaultPath?: string) => {
    const options: Electron.OpenDialogOptions = { title, defaultPath, properties: ['openDirectory', 'createDirectory'] }
    const win = windowOf(event)
    const { canceled, filePaths } = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return canceled ? null : (filePaths[0] ?? null)
  }
  const activate = async (folder: string) => {
    // Un fallo en la primera copia no impide guardar la configuración: el
    // motivo queda en lastError y la interfaz lo muestra.
    await backups.useFolder(String(folder)).catch(() => undefined)
    return settings.get()
  }
  handle(IPC.backupDetectClouds, () => detectCloudFolders())
  handle(IPC.backupUseFolder, (_e, folder) => activate(folder))
  handle(IPC.backupChooseFolder, async (event) => {
    const folder = await pickFolder(event, 'Carpeta para las copias de seguridad')
    return folder ? activate(folder) : null
  })
  handle(IPC.backupRunNow, () => backups.createBackup())
  handle(IPC.backupRestore, async (event) => {
    const { backup } = await settings.get()
    const folder = await pickFolder(event, 'Elige la carpeta de copias (o una copia concreta)', backup.folder || undefined)
    return folder ? backups.restore(folder) : null
  })

  // Exportación
  handle(IPC.exportProject, (event, projectId, format: ExportFormat) => {
    if (!EXPORT_FORMATS.includes(format)) throw new Error(`Formato no soportado: ${format}`)
    return exportProject(repository, projectId, format, windowOf(event))
  })
  handle(IPC.exportBible, (event, projectId, format: BibleFormat) => {
    if (!BIBLE_FORMATS.includes(format)) throw new Error(`Formato no soportado: ${format}`)
    return exportBible(repository, projectId, format, windowOf(event))
  })

  // Sagas
  handle(IPC.sagasList, () => repository.listSagas())
  handle(IPC.sagasCreate, (_e, name, projectIds) => repository.createSaga(String(name), projectIds))
  handle(IPC.sagasAddProject, (_e, sagaId, projectId) => repository.addToSaga(sagaId, projectId))
  handle(IPC.sagasRemoveProject, (_e, projectId) => repository.removeFromSaga(projectId))
  handle(IPC.sagasRename, (_e, sagaId, name) => repository.renameSaga(sagaId, String(name)))
  handle(IPC.sagasDelete, (_e, sagaId) => repository.deleteSaga(sagaId))

  // Biblioteca
  handle(IPC.libraryGetPath, () => repository.libraryRoot)
  handle(IPC.libraryOpenFolder, async () => {
    const error = await shell.openPath(repository.libraryRoot)
    if (error) throw new Error(error)
  })
}
