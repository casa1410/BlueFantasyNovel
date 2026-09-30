/**
 * Buscar (y reemplazar) en todo el manuscrito. Se abre con Ctrl+Mayús+F o
 * desde la barra lateral.
 */
import { useEffect, useRef, useState } from 'react'
import { Replace, Search } from 'lucide-react'
import type { ChapterSearchResult, Id, Project, SearchOptions } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toasts'
import { api, errorMessage } from '@renderer/lib/api'
import { flushAll } from '@renderer/lib/pendingSaves'
import { plural } from '@renderer/lib/format'

interface SearchDialogProps {
  projectId: Id
  onClose: () => void
  onOpenChapter: (chapterId: Id) => void
  /** Tras reemplazar: proyecto actualizado (el editor debe recargarse). */
  onReplaced: (project: Project) => void
}

export function SearchDialog({ projectId, onClose, onOpenChapter, onReplaced }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [options, setOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false })
  const [results, setResults] = useState<ChapterSearchResult[] | null>(null)
  const [confirming, setConfirming] = useState(false)
  const toast = useToast()
  const requestId = useRef(0)

  // Búsqueda en vivo con un pequeño retraso.
  useEffect(() => {
    if (!query.trim()) return setResults(null)
    const id = ++requestId.current
    const timer = setTimeout(async () => {
      await flushAll()
      const found = await api.manuscript.search(projectId, query, options)
      if (id === requestId.current) setResults(found)
    }, 250)
    return () => clearTimeout(timer)
  }, [projectId, query, options])

  const total = results?.reduce((sum, r) => sum + r.matches.length, 0) ?? 0

  const replaceAll = async () => {
    try {
      await flushAll()
      const { project, count } = await api.manuscript.replace(projectId, query, replacement, options)
      onReplaced(project)
      toast.success(`${plural(count, 'sustitución', 'sustituciones')} realizadas. Puedes deshacerlas desde el historial de cada capítulo.`)
      setConfirming(false)
      setResults(await api.manuscript.search(projectId, query, options))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Modal size="lg" title="Buscar en el manuscrito" onClose={onClose}>
      <div className="search-dialog">
        <label className="search-field">
          <Search size={15} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Palabra o frase…" />
        </label>
        {showReplace && (
          <label className="search-field">
            <Replace size={15} />
            <input value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="Reemplazar por…" />
          </label>
        )}
        <div className="search-options">
          <label className="settings-check">
            <input type="checkbox" checked={options.caseSensitive} onChange={(e) => setOptions({ ...options, caseSensitive: e.target.checked })} />
            Distinguir mayúsculas
          </label>
          <label className="settings-check">
            <input type="checkbox" checked={options.wholeWord} onChange={(e) => setOptions({ ...options, wholeWord: e.target.checked })} />
            Palabra completa
          </label>
          <div className="spacer" />
          {!showReplace ? (
            <button className="btn btn-sm btn-ghost" onClick={() => setShowReplace(true)}>
              <Replace size={14} /> Reemplazar…
            </button>
          ) : confirming ? (
            <>
              <span className="faint">¿Seguro?</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>
                No
              </button>
              <button className="btn btn-sm btn-danger" onClick={replaceAll}>
                Sí, reemplazar
              </button>
            </>
          ) : (
            <button className="btn btn-sm" disabled={!total} onClick={() => setConfirming(true)}>
              Reemplazar todo
            </button>
          )}
        </div>

        <div className="search-results">
          {results === null ? (
            <p className="faint">Escribe para buscar en todos los capítulos.</p>
          ) : results.length === 0 ? (
            <p className="faint">Sin coincidencias.</p>
          ) : (
            <>
              <p className="faint">
                {plural(total, 'coincidencia')} en {plural(results.length, 'capítulo')}
              </p>
              {results.map((r) => (
                <section key={r.chapterId} className="search-chapter">
                  <h4>
                    {r.title} <span className="faint">({r.matches.length})</span>
                  </h4>
                  {r.matches.map((m, i) => (
                    <button
                      key={i}
                      className="search-match"
                      onClick={() => {
                        onOpenChapter(r.chapterId)
                        onClose()
                      }}
                    >
                      …{m.before}
                      <mark>{m.match}</mark>
                      {m.after}…
                    </button>
                  ))}
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
