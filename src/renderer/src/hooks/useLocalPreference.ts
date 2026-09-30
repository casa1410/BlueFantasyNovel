import { useCallback, useState } from 'react'

const PREFIX = 'bfn.pref.'

/**
 * Estado de React que se recuerda entre sesiones (en localStorage).
 * Solo para preferencias de vista sin importancia (paneles abiertos, etc.):
 * los datos de las historias se guardan SIEMPRE en disco vía `api`.
 */
export function useLocalPreference<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(PREFIX + key)
      return stored === null ? defaultValue : (JSON.parse(stored) as T)
    } catch {
      return defaultValue
    }
  })

  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(next))
      } catch {
        // Sin almacenamiento disponible: la preferencia dura hasta cerrar.
      }
    },
    [key]
  )

  return [value, update]
}
