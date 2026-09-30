import { useCallback, useEffect, useRef, useState } from 'react'
import { registerFlusher } from '@renderer/lib/pendingSaves'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

/**
 * Guardado automático con retraso.
 *
 * - `schedule(value)` programa un guardado; si llega otro antes de `delayMs`,
 *   se descarta el anterior y solo se guarda el último.
 * - `flush()` guarda inmediatamente lo pendiente.
 * - Al desmontar el componente, o al cerrar la app, se guarda lo pendiente.
 *
 * @param save función que persiste el valor (normalmente una llamada a `api`).
 */
export function useDebouncedSave<T>(save: (value: T) => Promise<unknown>, delayMs = 800) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const pending = useRef<{ value: T } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Referencia siempre actualizada a `save`, para no reiniciar temporizadores
  // cada vez que el componente padre crea una función nueva.
  const saveRef = useRef(save)
  saveRef.current = save
  const mounted = useRef(true)

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const job = pending.current
    if (!job) return
    pending.current = null

    if (mounted.current) setStatus('saving')
    try {
      await saveRef.current(job.value)
      if (mounted.current) setStatus(pending.current ? 'pending' : 'saved')
    } catch (error) {
      console.error('Error al guardar:', error)
      if (mounted.current) setStatus('error')
    }
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value }
      setStatus('pending')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), delayMs)
    },
    [delayMs, flush]
  )

  useEffect(() => {
    mounted.current = true
    const unregister = registerFlusher(flush)
    return () => {
      mounted.current = false
      unregister()
      void flush()
    }
  }, [flush])

  return { schedule, flush, status }
}
