/**
 * Cuadros de texto de una ficha según la plantilla de la historia (ver
 * shared/sheets.ts), con el botón "Personalizar cuadros" para cambiarla.
 * Lo usan Personajes, Bestiario, Razas y Linajes.
 */
import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { fieldValue, isCustomField, type SheetCollection } from '@shared/sheets'
import type { Project } from '@shared/types'
import { SheetTemplateDialog } from './SheetTemplateDialog'

interface SheetSectionsProps {
  project: Project
  collection: SheetCollection
  /** Borrador de la ficha (de `useEntityForm`). */
  draft: object & { extra: Record<string, string> }
  /** Cambia un campo de serie (`appearance`…) o `extra` entero. */
  onChange: (key: string, value: unknown) => void
  onProjectChange: (project: Project) => void
}

export function SheetSections({ project, collection, draft, onChange, onProjectChange }: SheetSectionsProps) {
  const [editing, setEditing] = useState(false)
  const fields = project.sheetTemplates[collection].filter((f) => !f.hidden)

  const set = (id: string, value: string) => {
    if (isCustomField(id)) onChange('extra', { ...draft.extra, [id]: value })
    else onChange(id, value)
  }

  return (
    <>
      <div className="sheet-sections-header">
        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(true)} title="Añadir, quitar, renombrar u ordenar los cuadros de esta sección">
          <Settings2 size={14} /> Personalizar cuadros
        </button>
      </div>
      <div className="entity-sections">
        {fields.map((field) => (
          <label key={field.id} className={`field ${field.wide ? 'entity-section-wide' : ''}`}>
            <span className="field-label">{field.label}</span>
            <textarea
              className="textarea"
              rows={4}
              value={fieldValue(draft, field)}
              onChange={(e) => set(field.id, e.target.value)}
              placeholder={field.hint}
            />
          </label>
        ))}
        {fields.length === 0 && <p className="faint">No hay cuadros visibles. Usa «Personalizar cuadros» para añadir o mostrar alguno.</p>}
      </div>

      {editing && <SheetTemplateDialog project={project} collection={collection} onClose={() => setEditing(false)} onSaved={onProjectChange} />}
    </>
  )
}
