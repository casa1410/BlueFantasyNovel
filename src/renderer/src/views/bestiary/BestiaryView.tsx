/**
 * Sección "Bestiario": criaturas del mundo, agrupadas por tipo.
 */
import { PawPrint } from 'lucide-react'
import { customGroupKey } from '@shared/labels'
import { CREATURE_TYPES, type CreatureType, type EntityInput, type Id, type Project } from '@shared/types'
import { EntityBrowser } from '@renderer/components/EntityBrowser'
import { EntityThumb } from '@renderer/components/EntityThumb'
import { CreatureForm } from './CreatureForm'
import { CREATURE_TYPE_LABELS, DANGER_LABELS, creatureTypeLabel } from './bestiaryOptions'
import { DangerMeter } from './DangerMeter'

interface BestiaryViewProps {
  project: Project
  onProjectChange: (project: Project) => void
  onOpenChapter: (chapterId: Id) => void
}

export function BestiaryView({ project, onProjectChange, onOpenChapter }: BestiaryViewProps) {
  return (
    <EntityBrowser
      project={project}
      collection="creatures"
      onProjectChange={onProjectChange}
      title="Bestiario"
      deleteNoun="la criatura"
      importable
      nameOf={(c) => c.name}
      searchTextOf={(c) => `${creatureTypeLabel(c)} ${c.habitat} ${DANGER_LABELS[c.danger]} ${c.aliases.join(' ')}`}
      groups={{
        order: CREATURE_TYPES,
        label: (key, sample) => (key.startsWith('otro:') ? creatureTypeLabel(sample) : CREATURE_TYPE_LABELS[key as CreatureType]),
        keyOf: (c) => customGroupKey(c.type, c.typeCustom)
      }}
      newEntity={(): EntityInput<'creatures'> => ({
        name: 'Nueva criatura',
        aliases: [],
        type: 'bestia',
        typeCustom: '',
        danger: 2,
        habitat: '',
        size: '',
        appearance: '',
        behavior: '',
        abilities: '',
        weaknesses: '',
        notes: '',
        image: '',
        fullImage: ''
      })}
      renderListItem={(c) => (
        <>
          <EntityThumb projectId={project.id} image={c.image} shape="rounded" fallback={<PawPrint size={16} />} />
          <span className="entity-item-text">
            <strong>{c.name || 'Sin nombre'}</strong>
            <small>{c.habitat || creatureTypeLabel(c)}</small>
          </span>
          <DangerMeter level={c.danger} compact />
        </>
      )}
      renderDetail={(c, { onDelete }) => (
        <CreatureForm
          key={c.id}
          projectId={project.id}
          creature={c}
          chapters={project.chapters}
          onProjectChange={onProjectChange}
          onDelete={onDelete}
          onOpenChapter={onOpenChapter}
        />
      )}
      empty={{
        icon: PawPrint,
        title: 'Puebla tu mundo de criaturas',
        text: 'Registra bestias, dragones, espíritus y horrores: su hábitat, su comportamiento, de qué son capaces y cómo vencerlos.',
        action: 'Crear criatura'
      }}
    />
  )
}
