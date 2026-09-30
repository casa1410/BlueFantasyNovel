/**
 * Sección "Inspiración": tableros de imágenes (moodboards) para ambientes,
 * vestuario, arquitectura, paletas de color…
 */
import { Images } from 'lucide-react'
import type { EntityInput, Project } from '@shared/types'
import { EntityBrowser } from '@renderer/components/EntityBrowser'
import { EntityThumb } from '@renderer/components/EntityThumb'
import { plural } from '@renderer/lib/format'
import { BoardEditor } from './BoardEditor'
import './boards.css'

interface BoardsViewProps {
  project: Project
  onProjectChange: (project: Project) => void
}

export function BoardsView({ project, onProjectChange }: BoardsViewProps) {
  return (
    <EntityBrowser
      project={project}
      collection="boards"
      onProjectChange={onProjectChange}
      title="Inspiración"
      deleteNoun="el tablero y todas sus imágenes"
      nameOf={(b) => b.name}
      compare={(a, b) => a.createdAt.localeCompare(b.createdAt)}
      newEntity={(): EntityInput<'boards'> => ({ name: 'Nuevo tablero', description: '', items: [] })}
      renderListItem={(b) => (
        <>
          <EntityThumb projectId={project.id} image={b.items[0]?.image ?? ''} shape="rounded" fallback={<Images size={16} />} />
          <span className="entity-item-text">
            <strong>{b.name || 'Sin nombre'}</strong>
            <small>{plural(b.items.length, 'imagen', 'imágenes')}</small>
          </span>
        </>
      )}
      renderDetail={(b, { onDelete }) => (
        <BoardEditor key={b.id} project={project} board={b} onProjectChange={onProjectChange} onDelete={onDelete} />
      )}
      empty={{
        icon: Images,
        title: 'Reúne tu inspiración',
        text: 'Crea tableros con imágenes de referencia: paisajes, rostros, armaduras, ciudades, paletas de color… Todo queda guardado dentro de la historia.',
        action: 'Crear tablero'
      }}
    />
  )
}
