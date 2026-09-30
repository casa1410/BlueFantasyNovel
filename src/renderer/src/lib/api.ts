/**
 * Acceso centralizado al puente con el proceso principal.
 * Importa `api` desde aquí en vez de usar `window.api` directamente: así es
 * fácil sustituirlo por un doble de pruebas en el futuro.
 */
export const api = window.api

/**
 * Convierte un error de IPC en un mensaje legible. Electron antepone
 * "Error invoking remote method 'canal': Error: " al mensaje original.
 */
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
