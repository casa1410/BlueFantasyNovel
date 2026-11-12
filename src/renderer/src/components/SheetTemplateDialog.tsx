/**
 * "Personalizar cuadros": cambia la plantilla de una sección para toda la
 * historia. Los cuadros de serie se ocultan (su texto se conserva); los
 * añadidos se borran (con su texto, tras avisar).
 */
import { useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { BUILTIN_FIELDS, CUSTOM_PREFIX, fieldValue, isCustomField, type SheetCollection, type SheetField } from '@shared/sheets'
import type { Project } from '@shared/types'
import { api, errorMessage } from '@renderer/lib/api'
import { plural } from '@renderer/lib/format'
import { flushAll } from '@renderer/lib/pendingSaves'
import { Modal } from './Modal'
import { useToast } from './Toasts'

const SECTION_NAMES: Record<SheetCollection, { title: string; noun: string }> = {
  characters: { title: 'Personajes', noun: 'personaje' },
  creatures: { title: 'Bestiario', noun: 'criatura' },
  races: { title: 'Razas', noun: 'raza' },
  lineages: { title: 'Linajes', noun: 'linaje' }
}

interface SheetTemplateDialogProps {
  project: Project
  collection: SheetCollection
  onClose: () => void
  onSaved: (project: Project) => void
}

export function SheetTemplateDialog({ project, collection, onClose, onSaved }: SheetTemplateDialogProps) {
  const [fields, setFields] = useState<SheetField[]>(() => project.sheetTemplates[collection].map((f) => ({ ...f })))
  const [newLabel, setNewLabel] = useState('')
  const [pendingDelete, setPendingDelete] = useState<SheetField | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const names = SECTION_NAMES[collection]
  const entities = project[collection] as object[]

  /** Cuántas fichas tienen texto en un cuadro. */
  const usedIn = (field: SheetField) => entities.filter((e) => fieldValue(e, field).trim()).length

  const change = (id: string, patch: Partial<SheetField>) => setFields((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const move = (index: number, step: number) =>
    setFields((list) => {
      const next = [...list]
      const target = index + step
      if (target < 0 || target >= next.length) return list
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  const add = () => {
    const label = newLabel.trim()
    if (!label) return
    setFields((list) => [...list, { id: `${CUSTOM_PREFIX}${crypto.randomUUID()}`, label, hint: '', hidden: false, wide: false }])
    setNewLabel('')
  }
  const remove = (field: SheetField) => {
    setFields((list) => list.filter((f) => f.id !== field.id))
    setPendingDelete(null)
  }

  const save = async () => {
    setSaving(true)
    try {
      await flushAll() // que no se pierda lo último escrito en la ficha abierta
      onSaved(await api.projects.update(project.id, { sheetTemplates: { ...project.sheetTemplates, [collection]: fields } }))
      onClose()
    } catch (error) {
      toast.error(`No se pudieron guardar los cuadros: ${errorMessage(error)}`)
      setSaving(false)
    }
  }

  // Cuadros añadidos que se van a borrar y fichas que perderán texto.
  const removed = project.sheetTemplates[collection].filter((f) => isCustomField(f.id) && !fields.some((x) => x.id === f.id))
  const lost = removed.reduce((sum, f) => sum + usedIn(f), 0)

  return (
    <Modal
      title={`Cuadros de ${names.title}`}
      description={`Los cambios se aplican a todas las fichas de ${names.title.toLowerCase()} de esta historia.`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {removed.length > 0 && lost > 0 && (
            <span className="sheet-template-warning">
              Se borrará el texto de {plural(removed.length, 'cuadro', 'cuadros')} en {plural(lost, 'ficha', 'fichas')}.
            </span>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => setFields(BUILTIN_FIELDS[collection].map((f) => ({ ...f, hidden: false })).concat(fields.filter((f) => isCustomField(f.id))))}
            title="Vuelve a mostrar los cuadros de serie con su nombre y orden originales (los añadidos se quedan al final)"
          >
            <RotateCcw size={14} /> Restablecer
          </button>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="sheet-template-list">
        {fields.map((field, index) => {
          const custom = isCustomField(field.id)
          const count = usedIn(field)
          return (
            <div key={field.id} className={`sheet-template-row ${field.hidden ? 'is-hidden' : ''}`}>
              <div className="sheet-template-move">
                <button className="icon-btn" onClick={() => move(index, -1)} disabled={index === 0} title="Subir">
                  <ArrowUp size={14} />
                </button>
                <button className="icon-btn" onClick={() => move(index, 1)} disabled={index === fields.length - 1} title="Bajar">
                  <ArrowDown size={14} />
                </button>
              </div>
              <div className="sheet-template-fields">
                <input
                  className="input"
                  value={field.label}
                  onChange={(e) => change(field.id, { label: e.target.value })}
                  placeholder="Nombre del cuadro"
                  aria-label="Nombre del cuadro"
                />
                <input
                  className="input sheet-template-hint"
                  value={field.hint}
                  onChange={(e) => change(field.id, { hint: e.target.value })}
                  placeholder="Texto de ayuda (opcional)"
                  aria-label="Texto de ayuda"
                />
              </div>
              <div className="sheet-template-meta">
                <span className="faint">
                  {custom ? 'Añadido' : 'De serie'} · {count ? `con texto en ${plural(count, names.noun)}` : 'vacío'}
                </span>
                <label className="sheet-template-wide" title="Ocupa todo el ancho de la ficha">
                  <input type="checkbox" checked={field.wide} onChange={(e) => change(field.id, { wide: e.target.checked })} /> Ancho
                </label>
              </div>
              {custom ? (
                <button
                  className="icon-btn sheet-template-delete"
                  onClick={() => (count > 0 ? setPendingDelete(field) : remove(field))}
                  title="Borrar este cuadro"
                >
                  <Trash2 size={15} />
                </button>
              ) : (
                <button
                  className={`icon-btn ${field.hidden ? 'is-active' : ''}`}
                  onClick={() => change(field.id, { hidden: !field.hidden })}
                  title={field.hidden ? 'Mostrar (su texto se conserva)' : 'Ocultar (su texto no se borra)'}
                >
                  {field.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              )}
              {pendingDelete?.id === field.id && (
                <div className="sheet-template-confirm">
                  <span>
                    «{field.label}» tiene texto en {plural(count, names.noun)}. Al guardar, ese texto se borrará.
                  </span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setPendingDelete(null)}>
                    No
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(field)}>
                    Borrar cuadro
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="sheet-template-add">
        <input
          className="input"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nombre del cuadro nuevo (p. ej. Habilidades, Pasado, Familia)"
          aria-label="Nombre del cuadro nuevo"
        />
        <button className="btn" onClick={add} disabled={!newLabel.trim()}>
          <Plus size={15} /> Añadir cuadro
        </button>
      </div>
      <p className="field-hint">
        Los cuadros de serie no se pueden borrar, pero sí ocultar: su texto se guarda y vuelve si los muestras otra vez. Los cuadros añadidos se
        borran con su texto.
      </p>
    </Modal>
  )
}
