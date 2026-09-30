import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  title: string
  description?: string
  onClose: () => void
  children?: ReactNode
  footer?: ReactNode
  /** md: formularios cortos (por defecto) · lg: listas y vistas previas. */
  size?: 'md' | 'lg'
}

/**
 * Ventana modal genérica. Se cierra con Escape o haciendo clic fuera.
 * Usa un portal para no heredar estilos ni `overflow` de su contenedor.
 */
export function Modal({ title, description, onClose, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {children && <div className="modal-body">{children}</div>}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
