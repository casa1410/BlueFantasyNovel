import { useCallback, useRef, useState } from 'react'
import type { AssetFileName, EntityCollection, EntityInput, EntityMap, Project } from '@shared/types'
import { api } from '@renderer/lib/api'
import { useDebouncedSave } from './useDebouncedSave'

/**
 * Estado de un formulario de ficha (personaje, lore o criatura).
 *
 * Mantiene un borrador local para que escribir sea instantáneo y guarda en
 * disco 600 ms después del último cambio. El componente que lo use debe
 * montarse con `key={entity.id}` para que el borrador no mezcle fichas.
 *
 * @returns draft   valores actuales del formulario
 *          update  cambia un campo (y programa el guardado)
 *          setImage cambia la imagen y guarda al instante
 *          flush   guarda ya lo pendiente (p. ej. tras añadir imágenes)
 *          status  estado del guardado para mostrar al usuario
 */
export function useEntityForm<C extends EntityCollection>(
  projectId: string,
  collection: C,
  entity: EntityMap[C],
  onProjectChange: (project: Project) => void
) {
  const [draft, setDraft] = useState<EntityInput<C>>(() => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...editable } = entity
    return editable as EntityInput<C>
  })
  // Copia síncrona del borrador: permite encadenar varios `update` seguidos
  // sin perder cambios aunque React aún no haya re-renderizado.
  const draftRef = useRef(draft)

  const { schedule, flush, status } = useDebouncedSave(async (value: EntityInput<C>) => {
    onProjectChange(await api.entities.update(projectId, collection, entity.id, value))
  }, 600)

  const update = useCallback(
    <K extends keyof EntityInput<C>>(key: K, value: EntityInput<C>[K]) => {
      const next = { ...draftRef.current, [key]: value }
      draftRef.current = next
      setDraft(next)
      schedule(next)
    },
    [schedule]
  )

  const setImage = useCallback(
    (image: AssetFileName) => {
      update('image' as keyof EntityInput<C>, image as EntityInput<C>[keyof EntityInput<C>])
      void flush()
    },
    [update, flush]
  )

  return { draft, update, setImage, flush, status }
}
