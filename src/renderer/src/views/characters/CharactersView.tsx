/**
 * Sección "Personajes": fichas con retrato, rol, color y rasgos.
 */
import { Users } from 'lucide-react'
import type { EntityInput, Id, Project } from '@shared/types'
import { EntityBrowser } from '@renderer/components/EntityBrowser'
import { EntityThumb } from '@renderer/components/EntityThumb'
import { initials } from '@renderer/lib/covers'
import { CharacterForm } from './CharacterForm'
import { CHARACTER_COLORS, ROLE_LABELS } from './characterOptions'

interface CharactersViewProps {
  project: Project
  onProjectChange: (project: Project) => void
  onOpenChapter: (chapterId: Id) => void
}

export function CharactersView({ project, onProjectChange, onOpenChapter }: CharactersViewProps) {
  return (
    <EntityBrowser
      project={project}
      collection="characters"
      onProjectChange={onProjectChange}
      title="Personajes"
      deleteNoun="la ficha del personaje"
      importable
      nameOf={(c) => c.name}
      searchTextOf={(c) => `${ROLE_LABELS[c.role]} ${c.aliases.join(' ')}`}
      newEntity={(): EntityInput<'characters'> => ({
        name: 'Nuevo personaje',
        aliases: [],
        role: 'secundario',
        age: '',
        appearance: '',
        personality: '',
        motivation: '',
        fears: '',
        arc: '',
        notes: '',
        color: CHARACTER_COLORS[project.characters.length % CHARACTER_COLORS.length],
        raceId: null,
        lineageId: null,
        image: ''
      })}
      renderListItem={(c) => (
        <>
          <EntityThumb projectId={project.id} image={c.image} color={c.color} fallback={initials(c.name)} />
          <span className="entity-item-text">
            <strong>{c.name || 'Sin nombre'}</strong>
            <small>{[ROLE_LABELS[c.role], project.races.find((r) => r.id === c.raceId)?.name].filter(Boolean).join(' · ')}</small>
          </span>
        </>
      )}
      renderDetail={(c, { onDelete }) => (
        <CharacterForm
          key={c.id}
          projectId={project.id}
          character={c}
          chapters={project.chapters}
          races={project.races}
          lineages={project.lineages}
          onProjectChange={onProjectChange}
          onDelete={onDelete}
          onOpenChapter={onOpenChapter}
        />
      )}
      empty={{
        icon: Users,
        title: 'Da vida a tu reparto',
        text: 'Crea fichas con el retrato, la personalidad, las motivaciones y el arco de cada personaje. Las tendrás a mano en el panel de referencia mientras escribes.',
        action: 'Crear personaje'
      }}
    />
  )
}
