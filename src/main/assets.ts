/**
 * Servir y elegir imágenes de las fichas.
 *
 * - `registerAssetSchemePrivileges()` debe llamarse ANTES de `app.ready`.
 * - `registerAssetProtocol()` se llama después, cuando existe el repositorio.
 *
 * Ver src/shared/assets.ts para el formato de las URLs.
 */
import { pathToFileURL } from 'node:url'
import { BrowserWindow, dialog, net, protocol } from 'electron'
import { ASSET_PROTOCOL, IMAGE_EXTENSIONS } from '@shared/assets'
import type { AssetFileName, Id } from '@shared/types'
import { assertSafeId } from './storage/fsUtils'
import type { ProjectRepository } from './storage/ProjectRepository'

export function registerAssetSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    // corsEnabled: permite dibujar las imágenes en <canvas> (tarjetas, portada)
    // y exportar el resultado sin que el navegador lo bloquee.
    { scheme: ASSET_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
  ])
}

/**
 * Atiende `bfn-asset://project/<projectId>/<archivo>` leyendo el archivo de
 * la carpeta `assets/` del proyecto. Cualquier otra ruta devuelve 404.
 */
export function registerAssetProtocol(repository: ProjectRepository): void {
  protocol.handle(ASSET_PROTOCOL, async (request) => {
    try {
      const url = new URL(request.url)
      const [projectId, fileName] = url.pathname.split('/').filter(Boolean)
      if (url.hostname !== 'project') throw new Error('Ruta no válida')
      assertSafeId(projectId, 'projectId')
      const filePath = repository.assetPath(projectId, fileName)
      const file = await net.fetch(pathToFileURL(filePath).toString())
      return new Response(file.body, {
        status: file.status,
        headers: { 'Content-Type': file.headers.get('Content-Type') ?? 'application/octet-stream', 'Access-Control-Allow-Origin': '*' }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

/**
 * Diálogo "Abrir imagen" + copia al proyecto. Devuelve los nombres de los
 * archivos copiados (lista vacía si se cancela).
 */
export async function pickImages(
  repository: ProjectRepository,
  projectId: Id,
  parentWindow: BrowserWindow | null,
  multiple: boolean
): Promise<AssetFileName[]> {
  assertSafeId(projectId, 'projectId')
  const options: Electron.OpenDialogOptions = {
    title: multiple ? 'Elegir imágenes' : 'Elegir imagen',
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [{ name: 'Imágenes', extensions: [...IMAGE_EXTENSIONS] }]
  }
  const { canceled, filePaths } = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options)
  if (canceled) return []
  const imported: AssetFileName[] = []
  for (const file of filePaths) imported.push(await repository.importAsset(projectId, file))
  return imported
}
