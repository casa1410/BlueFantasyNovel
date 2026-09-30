/**
 * Sección "Lore": la enciclopedia del mundo (lugares, facciones, magia,
 * objetos, historia, religiones, culturas…), agrupada por categoría.
 */
import { ScrollText } from 'lucide-react'
import { LORE_CATEGORIES, type EntityInput, type Id, type LoreCategory, type Project } from '@shared/types'
import { EntityBrowser } from '@renderer/components/EntityBrowser'
import { EntityThumb } from '@renderer/components/EntityThumb'
import { LoreForm } from './LoreForm'
import { LORE_CATEGORY_INFO } from './loreOptions'

interface LoreViewProps {
  project: Project
  onProjectChange: (project: Project) => void
  onOpenChapter: (chapterId: Id) => void
}

export function LoreView({ project, onProjectChange, onOpenChapter }: LoreViewProps) {
  return (
    <EntityBrowser
      project={project}
      collection="lore"
      onProjectChange={onProjectChange}
      title="Lore"
      deleteNoun="la entrada"
      importable
      nameOf={(entry) => entry.title}
      searchTextOf={(entry) => `${entry.summary} ${entry.tags.join(' ')} ${entry.aliases.join(' ')} ${LORE_CATEGORY_INFO[entry.category].label}`}
      groups={{
        order: LORE_CATEGORIES,
        label: (key) => LORE_CATEGORY_INFO[key as LoreCategory].plural,
        keyOf: (entry) => entry.category
      }}
      newEntity={(): EntityInput<'lore'> => ({
        title: 'Nueva entrada',
        aliases: [],
        category: 'lugar',
        summary: '',
        body: '',
        tags: [],
        image: ''
      })}
      renderListItem={(entry) => {
        const { icon: Icon, color } = LORE_CATEGORY_INFO[entry.category]
        return (
          <>
            <EntityThumb
              projectId={project.id}
              image={entry.image}
              shape="rounded"
              color={`${color}33`}
              fallback={<Icon size={16} color={color} />}
            />
            <span className="entity-item-text">
              <strong>{entry.title || 'Sin título'}</strong>
              <small>{entry.summary || LORE_CATEGORY_INFO[entry.category].label}</small>
            </span>
          </>
        )
      }}
      renderDetail={(entry, { onDelete }) => (
        <LoreForm
          key={entry.id}
          projectId={project.id}
          entry={entry}
          chapters={project.chapters}
          onProjectChange={onProjectChange}
          onDelete={onDelete}
          onOpenChapter={onOpenChapter}
        />
      )}
      empty={{
        icon: ScrollText,
        title: 'Construye tu mundo',
        text: 'Anota lugares, facciones, sistemas de magia, objetos legendarios, religiones y episodios históricos. Todo quedará a mano desde el editor.',
        action: 'Crear primera entrada'
      }}
    />
  )
}
