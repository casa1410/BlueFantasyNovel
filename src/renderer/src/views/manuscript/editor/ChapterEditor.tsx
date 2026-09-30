/**
 * Editor de un capítulo.
 *
 * - Guarda solo (800 ms después de dejar de escribir), al cambiar de
 *   capítulo, al pulsar Ctrl+S y al cerrar la aplicación.
 * - Cuenta palabras en vivo.
 * - Resalta muletillas y menciones (nombres de fichas); al pasar el ratón
 *   por una mención muestra su ficha.
 * - Panel de referencia con comentarios al margen, historial de versiones,
 *   tarjetas para redes y sprints de escritura.
 *
 * Este componente se monta de nuevo en cada capítulo (`key={chapter.id}`),
 * así que su estado interno siempre corresponde a un único capítulo.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { mentionTargets } from '@shared/mentions'
import { countWords } from '@shared/text'
import type { ChapterMeta, Id, MentionableCollection, Project, RichTextNode } from '@shared/types'
import { api } from '@renderer/lib/api'
import { useDebouncedSave } from '@renderer/hooks/useDebouncedSave'
import { useLocalPreference } from '@renderer/hooks/useLocalPreference'
import { CommentMark } from './CommentMark'
import { EditorToolbar } from './EditorToolbar'
import { FillerWords } from './FillerWords'
import { MentionHoverCard, type HoveredMention } from './MentionHoverCard'
import { Mentions } from './Mentions'
import { ReferencePanel, type ReferenceTabId } from './ReferencePanel'
import type { Sprint } from './SprintButton'
import { StatusBar } from './StatusBar'
import { VersionHistoryDialog } from './VersionHistoryDialog'

interface ChapterEditorProps {
  project: Project
  chapter: ChapterMeta
  initialDoc: RichTextNode
  onProjectChange: (project: Project) => void
  onRename: (title: string) => void
  /** Vuelve a cargar el capítulo desde disco (p. ej. tras restaurar una versión). */
  onReload: () => void
  focusMode: boolean
  onToggleFocusMode: () => void
  sprint: Sprint | null
  onStartSprint: (minutes: number) => void
  onStopSprint: () => void
  /** Abre las tarjetas para redes (con el texto seleccionado, si lo hay). */
  onOpenCards: (selectedText: string) => void
  /** Petición de saltar a una escena (desde la barra lateral). */
  sceneJump: { chapterId: Id; separatorsBefore: number; nonce: number } | null
}

export function ChapterEditor(props: ChapterEditorProps) {
  const { project, chapter, onProjectChange, focusMode, onToggleFocusMode } = props
  const [words, setWords] = useState(chapter.wordCount)
  const [hovered, setHovered] = useState<HoveredMention | null>(null)
  const [dialog, setDialog] = useState<'history' | null>(null)
  const [activeCommentId, setActiveCommentId] = useState<Id | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selectedText, setSelectedText] = useState('')
  // Preferencias de vista que se recuerdan entre sesiones.
  const [showReference, setShowReference] = useLocalPreference('editor.showReference', true)
  const [showFillers, setShowFillers] = useLocalPreference('editor.showFillers', false)
  const [showMentions, setShowMentions] = useLocalPreference('editor.showMentions', true)
  const [refTab, setRefTab] = useLocalPreference<ReferenceTabId>('reference.tab', 'characters')

  const { schedule, flush, status } = useDebouncedSave(async (doc: RichTextNode) => {
    onProjectChange(await api.chapters.saveContent(project.id, chapter.id, doc))
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
        heading: { levels: [2, 3] }
      }),
      Placeholder.configure({ placeholder: 'Érase una vez…' }),
      FillerWords,
      Mentions,
      CommentMark
    ],
    content: props.initialDoc,
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'prose', spellcheck: 'true', lang: 'es' }
    },
    onUpdate: ({ editor }) => {
      setWords(countWords(editor.getText()))
      schedule(editor.getJSON() as RichTextNode)
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      setSelectedText(editor.state.doc.textBetween(from, to, ' '))
    }
  })

  useEffect(() => {
    editor?.commands.setFillerHighlight(showFillers)
  }, [editor, showFillers])

  // Los nombres a detectar cambian si se crea o renombra una ficha.
  const targets = useMemo(() => mentionTargets(project), [project])
  useEffect(() => {
    editor?.commands.setMentionTargets(targets, showMentions)
  }, [editor, targets, showMentions])

  // Atajos de teclado globales del editor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void flush()
      }
      if (event.key === 'F11') {
        event.preventDefault()
        onToggleFocusMode()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [flush, onToggleFocusMode])

  const openDialog = (which: 'history') => {
    setHovered(null)
    setDialog(which)
  }

  /** Crea un comentario sobre la selección y lo abre en el panel. */
  const addComment = async () => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const quote = editor.state.doc.textBetween(from, to, ' ').trim()
    if (!quote) return
    const { project: updated, entity } = await api.entities.create(project.id, 'comments', {
      chapterId: chapter.id,
      quote: quote.length > 160 ? `${quote.slice(0, 160)}…` : quote,
      text: '',
      resolved: false
    })
    editor.chain().focus().setComment(entity.id).run()
    onProjectChange(updated)
    setShowReference(true)
    setRefTab('comments')
    setActiveCommentId(entity.id)
  }

  /** Clic en un fragmento comentado: abre su comentario en el panel. */
  const onEditorClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) editor?.commands.focus('end')
    const marked = (event.target as HTMLElement).closest<HTMLElement>('[data-comment-id]')
    if (!marked) return
    setShowReference(true)
    setRefTab('comments')
    setActiveCommentId(marked.dataset.commentId ?? null)
  }

  // Saltar a una escena pedida desde la barra lateral.
  useEffect(() => {
    const jump = props.sceneJump
    if (!jump || jump.chapterId !== chapter.id || !editor) return
    const box = scrollRef.current
    if (jump.separatorsBefore === 0) box?.scrollTo({ top: 0, behavior: 'smooth' })
    else box?.querySelectorAll('.ProseMirror hr')[jump.separatorsBefore - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [props.sceneJump, chapter.id, editor])

  /** Detecta si el ratón está sobre una mención (delegación de eventos). */
  const onMouseOver = (event: MouseEvent) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-mention-id]')
    if (!element) return hovered && setHovered(null)
    const id = element.dataset.mentionId as Id
    if (hovered?.id === id) return
    setHovered({ id, kind: element.dataset.mentionKind as MentionableCollection, rect: element.getBoundingClientRect() })
  }

  return (
    <div className={`editor-shell ${focusMode ? 'is-focus' : ''}`}>
      <EditorToolbar
        editor={editor}
        projectId={project.id}
        showFillers={showFillers}
        onToggleFillers={() => setShowFillers(!showFillers)}
        showMentions={showMentions}
        onToggleMentions={() => setShowMentions(!showMentions)}
        showReference={showReference}
        onToggleReference={() => setShowReference(!showReference)}
        focusMode={focusMode}
        onToggleFocusMode={onToggleFocusMode}
        onOpenHistory={() => openDialog('history')}
        hasSelection={selectedText.trim().length > 0}
        onCreateCard={() => {
          setHovered(null)
          props.onOpenCards(selectedText)
        }}
        onComment={() => void addComment()}
        sprint={props.sprint}
        onStartSprint={props.onStartSprint}
        onStopSprint={props.onStopSprint}
      />

      <div className="editor-body">
        <div
          ref={scrollRef}
          className="editor-scroll"
          onClick={onEditorClick}
          onMouseOver={onMouseOver}
          onMouseLeave={() => setHovered(null)}
          onKeyDown={() => hovered && setHovered(null)}
          onScroll={() => hovered && setHovered(null)}
        >
          <article className="editor-page">
            <input
              // La key hace que se refresque si se renombra desde la barra lateral.
              key={chapter.title}
              className="editor-chapter-title"
              defaultValue={chapter.title}
              aria-label="Título del capítulo"
              onBlur={(e) => {
                const value = e.target.value.trim()
                if (value && value !== chapter.title) props.onRename(value)
                else e.target.value = chapter.title
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  editor?.commands.focus('start')
                }
              }}
            />
            <EditorContent editor={editor} />
          </article>
        </div>

        {showReference && !focusMode && (
          <ReferencePanel
            project={project}
            chapterId={chapter.id}
            tab={refTab}
            onTabChange={setRefTab}
            onInsertName={(name) => editor?.chain().focus().insertContent(name).run()}
            onClose={() => setShowReference(false)}
            onProjectChange={onProjectChange}
            activeCommentId={activeCommentId}
            onSelectComment={(id) => {
              setActiveCommentId(id)
              editor?.commands.selectComment(id)
            }}
            onRemoveCommentMark={(id) => editor?.commands.unsetComment(id)}
          />
        )}
      </div>

      <StatusBar project={project} chapter={chapter} liveWords={words} saveStatus={status} sprint={props.sprint} />

      {hovered && <MentionHoverCard project={project} mention={hovered} />}

      {dialog === 'history' && (
        <VersionHistoryDialog
          projectId={project.id}
          chapter={chapter}
          onClose={() => setDialog(null)}
          onRestored={(updated) => {
            onProjectChange(updated)
            props.onReload()
          }}
        />
      )}
    </div>
  )
}
