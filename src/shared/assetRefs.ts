/**
 * Localiza referencias a imágenes dentro de cualquier objeto (fichas, mapas
 * con chinchetas, tableros con varias imágenes…).
 *
 * Convención: toda propiedad llamada `image` o `fullImage` (el original sin
 * recortar) contiene un nombre de asset o ''. Así el almacenamiento puede validar y limpiar imágenes de forma
 * genérica sin conocer la forma de cada ficha.
 */
import { isValidAssetFileName } from './assets'
import type { AssetFileName } from './types'

/** Propiedades que guardan un nombre de asset. */
const IMAGE_KEYS = ['image', 'fullImage']

/** Todos los nombres de asset referenciados (en propiedades `image`/`fullImage`) dentro de `value`. */
export function collectAssetRefs(value: unknown, into = new Set<AssetFileName>()): Set<AssetFileName> {
  if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, into)
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (IMAGE_KEYS.includes(key) && typeof child === 'string' && child) into.add(child)
      else collectAssetRefs(child, into)
    }
  }
  return into
}

/** Lanza un error si alguna propiedad de imagen no es '' ni un nombre de asset válido. */
export function assertValidAssetRefs(value: unknown): void {
  for (const ref of collectAssetRefs(value)) {
    if (!isValidAssetFileName(ref)) throw new Error(`Nombre de imagen no válido: ${ref}`)
  }
}
