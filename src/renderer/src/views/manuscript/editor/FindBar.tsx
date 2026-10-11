/**
 * Barra de Ctrl+F: buscar (y reemplazar) dentro del capítulo abierto.
 *
 * - Enter / F3: siguiente · Mayús+Enter / Mayús+F3: anterior · Escape: cerrar.
 * - Al cerrar, la coincidencia actual queda seleccionada en el texto.
 * - Los reemplazos se deshacen con Ctrl+Z en el texto, como cualquier edición.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { CaseSensitive, ChevronDown, ChevronUp, Replace, WholeWord, X } from 'lucide-react'
import type { SearchOptions } from '@shared/types'
import { findInChapterKey } from './FindInChapter'

interface FindBarProps {
  editor: Editor
  /** Texto con el que se abre (lo seleccionado al pulsar Ctrl+F). */
  initialQuery: string
  /** Cambia cada vez que se pulsa Ctrl+F: vuelve a poner el foco en el campo. */
  focusNonce: number
  onClose: () => void
  /** Posición (la barra flota sobre el texto, a la izquierda del panel de referencia). */
  style?: CSSProperties
}

export function FindBar({ editor, initialQuery, focusNonce, onClose, style }: FindBarProps) {
  const [query, setQuery] = useState(initialQuery)
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [options, setOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false })
  const inputRef = useRef<HTMLInputElement>(null)

  const { count, index } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const state = e ? findInChapterKey.getState(e.state) : undefined
      return { count: state?.results.length ?? 0, index: state?.index ?? -1 }
    }
  })

  // Ctrl+F con la barra ya abierta: foco al campo y, si había texto
  // seleccionado, buscarlo.
  useEffect(() => {
    if (initialQuery) setQuery(initialQuery)
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusNonce, initialQuery])

  useEffect(() => {
    editor.commands.setChapterSearch(query, options)
  }, [editor, query, options])

  // Al cerrar (desmontar), quitar el resaltado.
  useEffect(() => () => void editor.commands.setChapterSearch('', { caseSensitive: false, wholeWord: false }), [editor])

  // Llevar la coincidencia actual a la vista.
  useEffect(() => {
    if (index < 0) return
    requestAnimationFrame(() => {
      editor.view.dom.querySelector('.find-hit.is-current')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [editor, index, count])

  const go = (step: number) => editor.commands.setChapterSearchIndex(index + step)

  const close = () => {
    const match = findInChapterKey.getState(editor.state)?.results[index]
    onClose()
    if (match) editor.chain().focus().setTextSelection(match).run()
    else editor.commands.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, field: 'find' | 'replace') => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Enter' && field === 'find') {
      e.preventDefault()
      go(e.shiftKey ? -1 : 1)
    } else if (e.key === 'Enter' && field === 'replace') {
      e.preventDefault()
      replaceOne()
    }
  }

  /** Reemplaza la actual; si el texto nuevo también coincide, pasa a la siguiente (si no, se quedaría ahí). */
  const replaceOne = () => {
    if (!editor.commands.replaceCurrentMatch(replacement)) return
    if ((findInChapterKey.getState(editor.state)?.results.length ?? 0) === count) go(1)
  }

  const toggle = (key: keyof SearchOptions) => setOptions((o) => ({ ...o, [key]: !o[key] }))

  return (
    <div className="find-bar" role="search" style={style} onKeyDown={(e) => e.key === 'F3' && (e.preventDefault(), go(e.shiftKey ? -1 : 1))}>
      <div className="find-bar-row">
        <button
          className={`icon-btn find-bar-expand ${showReplace ? 'is-active' : ''}`}
          onClick={() => setShowReplace(!showReplace)}
          title={showReplace ? 'Ocultar reemplazar' : 'Reemplazar'}
          aria-expanded={showReplace}
        >
          <Replace size={15} />
        </button>
        <input
          ref={inputRef}
          className="input find-bar-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => onKeyDown(e, 'find')}
          placeholder="Buscar en el capítulo"
          aria-label="Buscar en el capítulo"
          spellCheck={false}
        />
        <span className={`find-bar-count ${query.trim() && count === 0 ? 'is-empty' : ''}`}>
          {query.trim() ? (count === 0 ? 'Sin resultados' : `${index + 1} de ${count}`) : ''}
        </span>
        <button
          className={`icon-btn ${options.caseSensitive ? 'is-active' : ''}`}
          onClick={() => toggle('caseSensitive')}
          title="Distinguir mayúsculas"
          aria-pressed={options.caseSensitive}
        >
          <CaseSensitive size={16} />
        </button>
        <button
          className={`icon-btn ${options.wholeWord ? 'is-active' : ''}`}
          onClick={() => toggle('wholeWord')}
          title="Solo palabras completas"
          aria-pressed={options.wholeWord}
        >
          <WholeWord size={16} />
        </button>
        <button className="icon-btn" onClick={() => go(-1)} disabled={count === 0} title="Anterior (Mayús+Enter)">
          <ChevronUp size={16} />
        </button>
        <button className="icon-btn" onClick={() => go(1)} disabled={count === 0} title="Siguiente (Enter)">
          <ChevronDown size={16} />
        </button>
        <button className="icon-btn" onClick={close} title="Cerrar (Esc)">
          <X size={16} />
        </button>
      </div>
      {showReplace && (
        <div className="find-bar-row find-bar-replace">
          <input
            className="input find-bar-input"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => onKeyDown(e, 'replace')}
            placeholder="Reemplazar por"
            aria-label="Reemplazar por"
          />
          <button className="btn btn-sm" onClick={replaceOne} disabled={count === 0}>
            Reemplazar
          </button>
          <button className="btn btn-sm" onClick={() => editor.commands.replaceAllMatches(replacement)} disabled={count === 0}>
            Todos ({count})
          </button>
        </div>
      )}
    </div>
  )
}
