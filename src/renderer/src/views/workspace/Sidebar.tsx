import { useState } from 'react'
import { ChevronDown, ChevronLeft, Search, Settings, Share2 } from 'lucide-react'
import { assetUrl } from '@shared/assets'
import type { Id, Project } from '@shared/types'
import { useLocalPreference } from '@renderer/hooks/useLocalPreference'
import { coverGradient, initials } from '@renderer/lib/covers'
import { ChapterList } from './ChapterList'
import { SECTION_GROUPS, type WorkspaceSection } from './sections'

interface SidebarProps {
  project: Project
  section: WorkspaceSection
  onSectionChange: (section: WorkspaceSection) => void
  activeChapterId: Id | null
  onSelectChapter: (id: Id) => void
  onJumpToScene: (chapterId: Id, separatorsBefore: number) => void
  onExit: () => void
  onRenameProject: (title: string) => void
  onCreateChapter: (draft: boolean) => void
  onRenameChapter: (id: Id, title: string) => void
  onDeleteChapter: (id: Id) => void
  onReorderChapters: (orderedIds: Id[]) => void
  onSetDraft: (id: Id, draft: boolean) => void
  onOpenSearch: () => void
  onOpenCards: () => void
  onOpenSettings: () => void
}

export function Sidebar(props: SidebarProps) {
  const { project, section, onSectionChange } = props
  const [editingTitle, setEditingTitle] = useState(false)
  // Grupos plegados (se recuerda entre sesiones).
  const [collapsed, setCollapsed] = useLocalPreference<string[]>('sidebar.collapsedGroups', [])
  const coverImage = project.cover.front.image

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="sidebar-back btn btn-ghost btn-sm" onClick={props.onExit}>
          <ChevronLeft size={16} />
          Biblioteca
        </button>
        <div className="spacer" />
        <button className="icon-btn" onClick={props.onOpenSearch} title="Buscar en el manuscrito (Ctrl+Mayús+F)">
          <Search size={16} />
        </button>
        <button className="icon-btn" onClick={props.onOpenCards} title="Tarjetas para redes sociales">
          <Share2 size={16} />
        </button>
        <button className="icon-btn" onClick={props.onOpenSettings} title="Ajustes">
          <Settings size={16} />
        </button>
      </div>

      <div className="sidebar-project">
        <button
          className="sidebar-project-cover"
          style={coverImage ? undefined : { background: coverGradient(project.id) }}
          onClick={() => onSectionChange('cover')}
          title="Diseño de cubierta"
        >
          {coverImage ? <img src={assetUrl(project.id, coverImage)} alt="" /> : initials(project.title)}
        </button>
        {editingTitle ? (
          <input
            className="input sidebar-title-input"
            defaultValue={project.title}
            autoFocus
            onBlur={(e) => {
              setEditingTitle(false)
              if (e.target.value.trim() && e.target.value !== project.title) props.onRenameProject(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditingTitle(false)
            }}
          />
        ) : (
          <h2 className="sidebar-title" onDoubleClick={() => setEditingTitle(true)} title="Doble clic para renombrar">
            {project.title}
          </h2>
        )}
      </div>

      <nav className="sidebar-nav">
        {SECTION_GROUPS.map((group) => {
          const isCollapsed = collapsed.includes(group.id) && !group.sections.some((s) => s.id === section)
          return (
            <div key={group.id} className="sidebar-group">
              <button
                className="sidebar-group-label"
                onClick={() => setCollapsed(isCollapsed ? collapsed.filter((g) => g !== group.id) : [...collapsed, group.id])}
                aria-expanded={!isCollapsed}
              >
                {group.label}
                <ChevronDown size={13} className={isCollapsed ? 'is-collapsed' : ''} />
              </button>
              {!isCollapsed &&
                group.sections.map(({ id, label, icon: Icon, collection }) => (
                  <button key={id} className={`sidebar-nav-item ${section === id ? 'is-active' : ''}`} onClick={() => onSectionChange(id)}>
                    <Icon size={16} />
                    {label}
                    {collection && project[collection].length > 0 && <span className="sidebar-count">{project[collection].length}</span>}
                  </button>
                ))}
            </div>
          )
        })}
      </nav>

      {section === 'manuscript' && (
        <ChapterList
          chapters={project.chapters}
          activeChapterId={props.activeChapterId}
          onSelect={props.onSelectChapter}
          onJumpToScene={props.onJumpToScene}
          onCreate={props.onCreateChapter}
          onRename={props.onRenameChapter}
          onDelete={props.onDeleteChapter}
          onReorder={props.onReorderChapters}
          onSetDraft={props.onSetDraft}
        />
      )}
    </aside>
  )
}
