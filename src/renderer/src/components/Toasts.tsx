/**
 * Avisos breves en la esquina inferior derecha ("Exportado", "Error al
 * guardar"...). Uso:
 *
 *   const toast = useToast()
 *   toast.success('Manuscrito exportado')
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

type ToastKind = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  info(message: string): void
  success(message: string): void
  error(message: string): void
}

const ToastContext = createContext<ToastApi | null>(null)

const DURATION_MS = { info: 3500, success: 3500, error: 6000 } as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, kind, message }])
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), DURATION_MS[kind])
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      info: (m) => push('info', m),
      success: (m) => push('success', m),
      error: (m) => push('error', m)
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast is-${toast.kind}`}>
            {toast.kind === 'error' ? (
              <AlertTriangle size={16} color="var(--danger)" />
            ) : toast.kind === 'success' ? (
              <CheckCircle2 size={16} color="var(--success)" />
            ) : (
              <Info size={16} color="var(--accent)" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return context
}
