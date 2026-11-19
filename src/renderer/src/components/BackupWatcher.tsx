/**
 * Escucha las copias de seguridad automáticas (al abrir, cada día con la app
 * abierta…) y avisa al momento, en cualquier pantalla:
 *  - si una copia falla, un aviso rojo con el motivo;
 *  - si vuelve a funcionar tras un fallo, un aviso de que ya está bien.
 * También actualiza los ajustes para que el banner de la Biblioteca aparezca
 * (o desaparezca) sin tener que reiniciar.
 */
import { useEffect, useRef } from 'react'
import { api } from '@renderer/lib/api'
import { useSettings } from '@renderer/lib/settings'
import { useToast } from './Toasts'

export function BackupWatcher() {
  const { settings, replace } = useSettings()
  const toast = useToast()
  /** Último error conocido ('' = la última copia salió bien; null = aún no se sabe). */
  const lastError = useRef<string | null>(null)

  useEffect(() => {
    if (settings && lastError.current === null) lastError.current = settings.backup.lastError
  }, [settings])

  useEffect(
    () =>
      api.backup.onFinished((next) => {
        replace(next)
        const error = next.backup.lastError
        const previous = lastError.current
        lastError.current = error
        if (error && error !== previous) toast.error(`No se pudo hacer la copia de seguridad: ${error.replace(/\.$/, '')}. Revísalo en la Biblioteca.`)
        else if (!error && previous) toast.success('La copia de seguridad vuelve a funcionar.')
      }),
    [replace, toast]
  )

  return null
}
