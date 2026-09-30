import { useEditorState, type Editor } from '@tiptap/react'
import {
  AtSign,
  Bold,
  Heading2,
  Heading3,
  Highlighter,
  History,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Minus,
  PanelRight,
  Quote,
  Redo2,
  Share2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon
} from 'lucide-react'
import type { Id } from '@shared/types'
import { ExportMenu } from '@renderer/components/ExportMenu'
import { fillerWordsKey } from './FillerWords'
import { SprintButton, type Sprint } from './SprintButton'

interface EditorToolbarProps {
  editor: Editor | null
  projectId: Id
  showFillers: boolean
  onToggleFillers: () => void
  showMentions: boolean
  onToggleMentions: () => void
  showReference: boolean
  onToggleReference: () => void
  focusMode: boolean
  onToggleFocusMode: () => void
  onOpenHistory: () => void
  /** Hay texto seleccionado (para comentar o crear una tarjeta de cita). */
  hasSelection: boolean
  onCreateCard: () => void
  onComment: () => void
  sprint: Sprint | null
  onStartSprint: (minutes: number) => void
  onStopSprint: () => void
}

export function EditorToolbar(props: EditorToolbarProps) {
  const { editor } = props

  // Se vuelve a renderizar solo cuando cambia alguno de estos valores.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e && {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        quote: e.isActive('blockquote'),
        bullet: e.isActive('bulletList'),
        ordered: e.isActive('orderedList'),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        fillerCount: fillerWordsKey.getState(e.state)?.count ?? 0
      }
  })

  if (!editor || !state) return <div className="editor-toolbar" />
  const chain = () => editor.chain().focus()

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Formato">
      <ToolButton icon={Undo2} label="Deshacer (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton icon={Redo2} label="Rehacer (Ctrl+Y)" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
      <Divider />
      <ToolButton icon={Bold} label="Negrita (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()} />
      <ToolButton icon={Italic} label="Cursiva (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()} />
      <ToolButton icon={Underline} label="Subrayado (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()} />
      <ToolButton icon={Strikethrough} label="Tachado" active={state.strike} onClick={() => chain().toggleStrike().run()} />
      <Divider />
      <ToolButton icon={Heading2} label="Encabezado" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolButton icon={Heading3} label="Subencabezado" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <ToolButton icon={Quote} label="Cita" active={state.quote} onClick={() => chain().toggleBlockquote().run()} />
      <ToolButton icon={List} label="Lista" active={state.bullet} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label="Lista numerada" active={state.ordered} onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton icon={Minus} label="Separador de escena (* * *)" onClick={() => chain().setHorizontalRule().run()} />

      <div className="spacer" />

      <SprintButton sprint={props.sprint} onStart={props.onStartSprint} onStop={props.onStopSprint} />
      <ToolButton
        icon={AtSign}
        label="Resaltar menciones de personajes, lore y criaturas"
        active={props.showMentions}
        onClick={props.onToggleMentions}
      />
      <button
        className={`btn btn-sm btn-ghost filler-toggle ${props.showFillers ? 'is-active' : ''}`}
        onClick={props.onToggleFillers}
        title="Resaltar muletillas y palabras de relleno"
      >
        <Highlighter size={15} />
        Muletillas
        {props.showFillers && <span className="filler-badge">{state.fillerCount}</span>}
      </button>
      <ToolButton
        icon={MessageSquarePlus}
        label={props.hasSelection ? 'Comentar el fragmento seleccionado' : 'Selecciona un fragmento para comentarlo'}
        disabled={!props.hasSelection}
        onClick={props.onComment}
      />
      <ToolButton
        icon={Share2}
        label={props.hasSelection ? 'Crear tarjeta para redes (con la cita seleccionada)' : 'Tarjetas para redes sociales'}
        onClick={props.onCreateCard}
      />
      <ToolButton icon={History} label="Historial de versiones" onClick={props.onOpenHistory} />
      {!props.focusMode && (
        <ToolButton
          icon={PanelRight}
          label="Panel de referencia"
          active={props.showReference}
          onClick={props.onToggleReference}
        />
      )}
      <ToolButton
        icon={props.focusMode ? Minimize2 : Maximize2}
        label={props.focusMode ? 'Salir del modo enfoque (F11)' : 'Modo enfoque (F11)'}
        active={props.focusMode}
        onClick={props.onToggleFocusMode}
      />
      {!props.focusMode && <ExportMenu projectId={props.projectId} />}
    </div>
  )
}

interface ToolButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}

function ToolButton({ icon: Icon, label, onClick, active = false, disabled = false }: ToolButtonProps) {
  return (
    <button
      className={`icon-btn ${active ? 'is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // mousedown en vez de click: evita que el editor pierda la selección.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon size={17} />
    </button>
  )
}

function Divider() {
  return <span className="toolbar-divider" aria-hidden="true" />
}
