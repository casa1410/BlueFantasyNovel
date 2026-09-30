import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import type { SaveStatus } from '@renderer/hooks/useDebouncedSave'

/** Indicador compacto "Guardado / Guardando… / Error" para formularios. */
export function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === 'error') {
    return (
      <span className="save-indicator is-error">
        <AlertTriangle size={14} /> Error al guardar
      </span>
    )
  }
  const saved = status === 'saved'
  return (
    <span className={`save-indicator ${saved ? 'is-saved' : ''}`}>
      {saved ? <Check size={14} /> : <Loader2 size={14} className="spin" />}
      {saved ? 'Guardado' : 'Guardando…'}
    </span>
  )
}
