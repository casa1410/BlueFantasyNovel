import { Trash2 } from 'lucide-react'
import { assetUrl } from '@shared/assets'
import type { ProjectSummary } from '@shared/types'
import { coverGradient, initials } from '@renderer/lib/covers'
import { plural, relativeTime } from '@renderer/lib/format'

interface ProjectCardProps {
  project: ProjectSummary
  /** Nombre de la saga a la que pertenece, si pertenece a alguna. */
  sagaName?: string
  onOpen: () => void
  onDelete: () => void
}

export function ProjectCard({ project, sagaName, onOpen, onDelete }: ProjectCardProps) {
  const progress = project.wordGoal > 0 ? Math.min(1, project.wordCount / project.wordGoal) : null

  return (
    <article
      className="project-card"
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      tabIndex={0}
      role="button"
      aria-label={`Abrir ${project.title}`}
    >
      <div className={`project-cover ${project.coverImage ? 'has-image' : ''}`} style={{ background: coverGradient(project.id) }}>
        {project.coverImage ? (
          <img className="project-cover-image" src={assetUrl(project.id, project.coverImage)} alt="" />
        ) : (
          <span className="project-cover-initials">{initials(project.title)}</span>
        )}
        {sagaName && <span className="project-saga">Saga: {sagaName}</span>}
        {project.genre && <span className="project-genre">{project.genre}</span>}
        <button
          className="icon-btn project-delete"
          title="Eliminar historia"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="project-body">
        <h3>{project.title}</h3>
        <p className="project-description">{project.description || 'Sin sinopsis todavía.'}</p>

        <div className="project-meta">
          <span>{plural(project.wordCount, 'palabra')}</span>
          <span>·</span>
          <span>{plural(project.chapterCount, 'capítulo')}</span>
          <span>·</span>
          <span>{plural(project.characterCount, 'personaje')}</span>
          {project.loreCount > 0 && (
            <>
              <span>·</span>
              <span>{plural(project.loreCount, 'entrada', 'entradas')} de lore</span>
            </>
          )}
          {project.creatureCount > 0 && (
            <>
              <span>·</span>
              <span>{plural(project.creatureCount, 'criatura')}</span>
            </>
          )}
        </div>

        {progress !== null && (
          <div className="project-progress" title={`${Math.round(progress * 100)} % del objetivo`}>
            <div style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        <div className="project-updated faint">Editado {relativeTime(project.updatedAt)}</div>
      </div>
    </article>
  )
}
