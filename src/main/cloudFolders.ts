/**
 * Detección de carpetas sincronizadas con la nube en este equipo.
 *
 * Si el usuario tiene instalado Google Drive, OneDrive, Dropbox o iCloud, sus
 * archivos viven en una carpeta local que el programa del servicio sube
 * solo. Guardar las copias de seguridad ahí es la forma más sencilla y
 * fiable de tenerlas en la nube: no hace falta iniciar sesión en la app ni
 * gestionar credenciales.
 *
 * Todas las comprobaciones son "best effort": si algo falla, ese servicio
 * simplemente no aparece.
 */
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { CloudFolder } from '@shared/types'
import { pathExists, readJson } from './storage/fsUtils'

export async function detectCloudFolders(): Promise<CloudFolder[]> {
  const found: CloudFolder[] = []
  const add = async (service: CloudFolder['service'], label: string, folder: string | undefined) => {
    if (!folder || found.some((f) => path.resolve(f.path) === path.resolve(folder))) return
    if (await isDirectory(folder)) found.push({ service, label, path: folder })
  }

  const home = os.homedir()
  const env = process.env

  // Google Drive para ordenadores: una unidad virtual (G:\Mi unidad) o, en
  // modo "duplicar archivos", una carpeta dentro del perfil del usuario.
  for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
    for (const name of ['Mi unidad', 'My Drive']) await add('google-drive', 'Google Drive', `${letter}:\\${name}`)
  }
  for (const name of ['Mi unidad', 'My Drive', path.join('Google Drive', 'Mi unidad'), path.join('Google Drive', 'My Drive')]) {
    await add('google-drive', 'Google Drive', path.join(home, name))
  }

  // OneDrive: Windows expone su carpeta en variables de entorno.
  await add('onedrive', 'OneDrive', env.OneDriveConsumer)
  await add('onedrive', 'OneDrive (empresa o centro educativo)', env.OneDriveCommercial)
  await add('onedrive', 'OneDrive', env.OneDrive)

  // Dropbox guarda la ruta de su carpeta en info.json.
  for (const base of [env.APPDATA, env.LOCALAPPDATA]) {
    if (!base) continue
    try {
      const info = await readJson<Record<string, { path?: string }>>(path.join(base, 'Dropbox', 'info.json'))
      await add('dropbox', 'Dropbox', info.personal?.path)
      await add('dropbox', 'Dropbox (empresa)', info.business?.path)
    } catch {
      // Dropbox no instalado.
    }
  }

  // iCloud para Windows.
  await add('icloud', 'iCloud Drive', path.join(home, 'iCloudDrive'))

  return found
}

async function isDirectory(folder: string): Promise<boolean> {
  try {
    return (await pathExists(folder)) && (await fs.stat(folder)).isDirectory()
  } catch {
    return false
  }
}
