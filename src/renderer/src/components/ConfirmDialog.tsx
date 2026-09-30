import { useState } from 'react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  /** Estilo rojo para acciones destructivas (borrar). */
  destructive?: boolean
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

/** Diálogo de confirmación. Se cierra solo cuando `onConfirm` termina. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  destructive = false,
  onConfirm,
  onClose
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      description={message}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className={destructive ? 'btn btn-danger' : 'btn btn-primary'} onClick={confirm} disabled={busy} autoFocus>
            {confirmLabel}
          </button>
        </>
      }
    />
  )
}
