/**
 * "Cambiar el nombre en toda la historia": sustituye un nombre en todos los
 * capítulos y en la ficha (nombre y alias). Lo usan personajes y criaturas. Antes de hacerlo muestra cuántas
 * veces aparece y en qué capítulos.
 *
 * Se busca la palabra completa y con las mismas mayúsculas ("Luna" no cambia
 * "luna" ni "Lunares"). Cada capítulo afectado guarda antes una versión en su
 * historial, así que se puede deshacer capítulo a capítulo.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { buildSearchPattern } from '@shared/search'
import type { ChapterSearchResult, Project, SearchOptions } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toasts'
import { api, errorMessage } from '@renderer/lib/api'
import { plural } from '@renderer/lib/format'
import { flushAll } from '@renderer/lib/pendingSaves'

const OPTIONS: SearchOptions = { caseSensitive: true, wholeWord: true }

interface RenameDialogProps {
  projectId: string
  /** Nombre y alias actuales de la ficha. */
  entity: { name: string; aliases: string[] }
  onClose: () => void
  /** Tras cambiar el texto: proyecto actualizado y nuevo nombre y alias de la ficha. */
  onRenamed: (project: Project, card: { name: string; aliases: string[] }) => void
}

/** Sustituye `from` por `to` como palabra completa (sin interpretar `$` en `to`). */
function replaceName(text: string, from: string, to: string): string {
  const pattern = buildSearchPattern(from, OPTIONS)
  return pattern ? text.replace(pattern, () => to) : text
}

export function RenameDialog({ projectId, entity, onClose, onRenamed }: RenameDialogProps) {
  const [from, setFrom] = useState(entity.name)
  const [to, setTo] = useState('')
  const [keepOldAsAlias, setKeepOldAsAlias] = useState(false)
  const [results, setResults] = useState<ChapterSearchResult[] | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const requestId = useRef(0)

  // Cuenta las apariciones en vivo (guardando antes lo último escrito).
  useEffect(() => {
    if (!from.trim()) return setResults([])
    setResults(null)
    const id = ++requestId.current
    const timer = setTimeout(async () => {
      await flushAll()
      const found = await api.manuscript.search(projectId, from, OPTIONS)
      if (id === requestId.current) setResults(found)
    }, 250)
    return () => clearTimeout(timer)
  }, [projectId, from])

  const total = results?.reduce((sum, r) => sum + r.total, 0) ?? 0
  const oldName = from.trim()
  const newName = to.trim()

  // Cómo quedará la ficha.
  const card = useMemo(() => {
    const name = replaceName(entity.name, oldName, newName)
    let aliases = entity.aliases.map((a) => replaceName(a, oldName, newName))
    if (keepOldAsAlias && oldName && !aliases.includes(oldName)) aliases = [...aliases, oldName]
    aliases = [...new Set(aliases)].filter((a) => a && a !== name)
    return { name, aliases }
  }, [entity, oldName, newName, keepOldAsAlias])

  const ready = Boolean(oldName && newName && oldName !== newName)

  const apply = async () => {
    setSaving(true)
    try {
      await flushAll()
      const { project, count } = await api.manuscript.replace(projectId, oldName, newName, OPTIONS)
      onRenamed(project, card)
      toast.success(
        count > 0
          ? `«${oldName}» → «${newName}»: ${plural(count, 'cambio', 'cambios')}. Cada capítulo guardó antes una versión en su historial.`
          : `Ficha renombrada a «${card.name}».`
      )
      onClose()
    } catch (error) {
      toast.error(`No se pudo cambiar el nombre: ${errorMessage(error)}`)
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Cambiar el nombre en toda la historia"
      description="Sustituye el nombre en todos los capítulos (también en los borradores) y en la ficha."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={apply} disabled={!ready || results === null || saving}>
            {saving ? 'Cambiando…' : total > 0 ? `Cambiar ${plural(total, 'vez', 'veces')}` : 'Cambiar solo la ficha'}
          </button>
        </>
      }
    >
      <div className="rename-fields">
        <label className="field">
          <span className="field-label">Buscar en el texto</span>
          <input className="input" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Nombre actual" />
        </label>
        <label className="field">
          <span className="field-label">Cambiar por</span>
          <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Nombre nuevo" autoFocus />
        </label>
      </div>
      <p className="field-hint">
        Se busca la palabra completa y con las mismas mayúsculas: «{oldName || 'Luna'}» no cambia «{(oldName || 'Luna').toLowerCase()}» ni palabras
        que la contengan. Puedes cambiar solo una parte del nombre (p. ej. el nombre de pila).
      </p>

      {oldName && (
        <div className={`rename-summary ${total > 0 ? 'is-warning' : ''}`}>
          {results === null ? (
            <span className="faint">Contando apariciones…</span>
          ) : total === 0 ? (
            <span>«{oldName}» no aparece en ningún capítulo. Solo se cambiará la ficha.</span>
          ) : (
            <>
              <AlertTriangle size={18} />
              <div>
                <strong>
                  «{oldName}» se cambiará {plural(total, 'vez', 'veces')} en {plural(results.length, 'capítulo', 'capítulos')}.
                </strong>
                <ul className="rename-chapters">
                  {results.map((r) => (
                    <li key={r.chapterId}>
                      <span>{r.title}</span>
                      <span className="faint">{plural(r.total, 'vez', 'veces')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {ready && (
        <div className="rename-card">
          <span className="field-label">La ficha quedará así</span>
          <p>
            <strong>{card.name}</strong>
            {card.aliases.length > 0 && <span className="faint"> · alias: {card.aliases.join(', ')}</span>}
          </p>
          <label className="rename-check">
            <input type="checkbox" checked={keepOldAsAlias} onChange={(e) => setKeepOldAsAlias(e.target.checked)} />
            Guardar «{oldName}» como alias (para seguir reconociéndolo en notas o textos antiguos)
          </label>
        </div>
      )}
    </Modal>
  )
}
