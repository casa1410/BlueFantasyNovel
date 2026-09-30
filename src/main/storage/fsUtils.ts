/**
 * Utilidades de disco de bajo nivel.
 *
 * Toda escritura es ATÓMICA: se escribe en un archivo temporal y después se
 * renombra sobre el definitivo. Así, si la aplicación se cierra o el equipo
 * se apaga a mitad de guardado, el archivo anterior queda intacto en vez de
 * corrupto.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Cola de escrituras por archivo. Si el autoguardado lanza dos escrituras
 * seguidas sobre el mismo archivo, la segunda espera a la primera, de modo
 * que el resultado final siempre es la última versión.
 */
const writeQueues = new Map<string, Promise<void>>()

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined) // un fallo anterior no debe bloquear las siguientes escrituras
    .then(() => writeNow(filePath, JSON.stringify(data, null, 2)))

  writeQueues.set(filePath, next)
  try {
    await next
  } finally {
    // Limpia la cola si nadie más ha encolado detrás de nosotros.
    if (writeQueues.get(filePath) === next) writeQueues.delete(filePath)
  }
}

async function writeNow(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.tmp`
  await fs.writeFile(tempPath, contents, 'utf8')
  await renameWithRetry(tempPath, filePath)
}

/**
 * En Windows, un antivirus o el indexador pueden bloquear un archivo unos
 * milisegundos justo después de escribirlo (error EPERM/EBUSY). Reintentamos
 * unas pocas veces antes de rendirnos.
 */
async function renameWithRetry(from: string, to: string, attempts = 5): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await fs.rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (i >= attempts || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw error
      await new Promise((resolve) => setTimeout(resolve, 50 * i))
    }
  }
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as T
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

const SAFE_ID = /^[a-zA-Z0-9-]{1,64}$/

/**
 * Los ids llegan desde la interfaz y se usan para construir rutas de disco.
 * Validarlos impide que un id como "../../Windows" se salga de la biblioteca.
 */
export function assertSafeId(id: unknown, label = 'id'): asserts id is string {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) {
    throw new Error(`${label} no válido: ${String(id)}`)
  }
}
