/**
 * Ventana "Nuevo grupo": nombre, color y miembros. Si entre los miembros ya
 * hay relaciones (p. ej. "Amistad" entre todos), ofrece quitarlas: el grupo
 * ya las representa con una sola línea por personaje.
 */
import { useMemo, useState } from 'react'
import { groupWithCustom } from '@shared/labels'
import { RELATIONSHIP_KINDS, type Character, type Id, type Project, type RelationGroup, type Relationship } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { GroupColor } from './GroupPanel'
import { relationColor, relationLegendKey, relationLegendLabel } from './relationOptions'

interface GroupDialogProps {
  project: Project
  /** Miembros marcados al abrir (p. ej. los extremos de la relación seleccionada). */
  initialMembers: Id[]
  onClose: () => void
  /** Crea el grupo y quita las relaciones elegidas, en un solo paso. */
  onCreate: (group: Pick<RelationGroup, 'name' | 'color' | 'memberIds'>, removeRelationshipIds: Id[]) => Promise<void>
}

export function GroupDialog({ project, initialMembers, onClose, onCreate }: GroupDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#4fd1a5')
  const [members, setMembers] = useState<Id[]>(initialMembers)
  /** Tipos de relación (clave de leyenda) que el usuario NO quiere quitar. */
  const [keep, setKeep] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Relaciones entre miembros, por tipo, de la más numerosa a la menos (la
  // primera suele ser la que define el grupo y da nombre por defecto).
  const inside = useMemo(() => {
    const set = new Set(members)
    const list = project.relationships.filter((r) => set.has(r.sourceId) && set.has(r.targetId))
    return groupWithCustom(list, RELATIONSHIP_KINDS, relationLegendKey, relationLegendLabel).sort((a, b) => b.items.length - a.items.length)
  }, [members, project.relationships])

  const toRemove = inside.filter((g) => !keep.has(g.key)).flatMap((g) => g.items.map((r: Relationship) => r.id))

  const create = async () => {
    setSaving(true)
    try {
      await onCreate({ name: name.trim() || inside[0]?.label || 'Grupo', color, memberIds: members }, toRemove)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nuevo grupo"
      description="Un grupo se dibuja como un nodo con una línea a cada miembro, en lugar de una línea entre cada pareja de personajes."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={create} disabled={saving || members.length < 2}>
            {saving ? 'Creando…' : 'Crear grupo'}
          </button>
        </>
      }
    >
      <div className="group-dialog-row">
        <label className="field">
          <span className="field-label">Nombre</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={inside[0] ? inside[0].label : 'p. ej. Amigos de la infancia'}
            autoFocus
          />
        </label>
        <div className="field">
          <span className="field-label">Color</span>
          <GroupColor value={color} onChange={setColor} />
        </div>
      </div>

      <div className="field">
        <span className="field-label">Miembros ({members.length})</span>
        <MemberPicker characters={project.characters} value={members} onChange={setMembers} />
        {members.length < 2 && <p className="field-hint">Elige al menos dos personajes.</p>}
      </div>

      {inside.length > 0 && (
        <div className="field">
          <span className="field-label">Relaciones entre ellos que ya representa el grupo</span>
          <p className="field-hint">Las marcadas se quitarán del mapa. Puedes deshacerlo con Ctrl+Z.</p>
          <div className="group-dialog-kinds">
            {inside.map((g) => (
              <label key={g.key} className="group-dialog-kind">
                <input
                  type="checkbox"
                  checked={!keep.has(g.key)}
                  onChange={(e) => {
                    const next = new Set(keep)
                    if (e.target.checked) next.delete(g.key)
                    else next.add(g.key)
                    setKeep(next)
                  }}
                />
                <span className="group-dialog-swatch" style={{ background: relationColor(g.items[0]) }} />
                Quitar {g.items.length} {g.items.length === 1 ? 'relación' : 'relaciones'} de «{g.label}»
              </label>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

/** Lista de personajes con casilla para elegir miembros. */
export function MemberPicker({ characters, value, onChange }: { characters: Character[]; value: Id[]; onChange: (ids: Id[]) => void }) {
  const chosen = new Set(value)
  return (
    <div className="member-picker">
      {characters.map((c) => (
        <label key={c.id} className={`member-option ${chosen.has(c.id) ? 'is-on' : ''}`}>
          <input
            type="checkbox"
            checked={chosen.has(c.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((id) => id !== c.id))}
          />
          <span className="member-dot" style={{ background: c.color }} />
          {c.name || 'Sin nombre'}
        </label>
      ))}
    </div>
  )
}
