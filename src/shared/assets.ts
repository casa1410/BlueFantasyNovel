/**
 * Imágenes de las fichas (retratos, ilustraciones de lore y criaturas).
 *
 * Al elegir una imagen, se COPIA a `<proyecto>/assets/<uuid>.<ext>`. Así el
 * proyecto es autocontenido: si se mueve o se sincroniza la carpeta, las
 * imágenes van con él.
 *
 * La interfaz no puede leer archivos del disco directamente, así que las
 * muestra a través de un protocolo propio que atiende el proceso principal
 * (ver `registerAssetProtocol` en src/main/assets.ts):
 *
 *   bfn-asset://project/<projectId>/<archivo>
 */
import type { AssetFileName, Id } from './types'

export const ASSET_PROTOCOL = 'bfn-asset'

/** Formatos de imagen aceptados. */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const

/** Nombre válido de asset: UUID + extensión permitida. Evita rutas maliciosas. */
export const ASSET_FILE_PATTERN = /^[a-f0-9-]{36}\.(png|jpe?g|webp|gif)$/

export function isValidAssetFileName(name: unknown): name is AssetFileName {
  return typeof name === 'string' && ASSET_FILE_PATTERN.test(name)
}

export function assetUrl(projectId: Id, fileName: AssetFileName): string {
  return `${ASSET_PROTOCOL}://project/${projectId}/${fileName}`
}
