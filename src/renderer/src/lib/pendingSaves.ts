/**
 * Registro de guardados pendientes.
 *
 * Los formularios y el editor guardan con un pequeño retraso (debounce) para
 * no escribir en disco en cada pulsación. Cada uno registra aquí una función
 * `flush` que fuerza el guardado inmediato de lo que tenga pendiente.
 *
 * Antes de cerrar la ventana, el proceso principal pregunta a la interfaz y
 * esta llama a `flushAll()` (ver App.tsx). Así nunca se pierde el último
 * párrafo escrito.
 */
type Flusher = () => Promise<unknown> | void

const flushers = new Set<Flusher>()

/** Registra un flusher. Devuelve la función para darlo de baja. */
export function registerFlusher(flusher: Flusher): () => void {
  flushers.add(flusher)
  return () => flushers.delete(flusher)
}

export async function flushAll(): Promise<void> {
  await Promise.allSettled([...flushers].map((flush) => flush()))
}
