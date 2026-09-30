/**
 * Sección "Mapas": mapas del mundo (imágenes propias) con chinchetas
 * vinculadas a entradas de lore.
 */
import { Map as MapIcon } from 'lucide-react'
import type { EntityInput, Project } from '@shared/types'
import { EntityBrowser } from '@renderer/components/EntityBrowser'
import { EntityThumb } from '@renderer/components/EntityThumb'
import { plural } from '@renderer/lib/format'
import { MapEditor } from './MapEditor'
import './maps.css'

interface MapsViewProps {
  project: Project
  onProjectChange: (project: Project) => void
}

export function MapsView({ project, onProjectChange }: MapsViewProps) {
  return (
    <EntityBrowser
      project={project}
      collection="maps"
      onProjectChange={onProjectChange}
      title="Mapas"
      deleteNoun="el mapa y sus chinchetas"
      nameOf={(m) => m.name}
      compare={(a, b) => a.createdAt.localeCompare(b.createdAt)}
      newEntity={(): EntityInput<'maps'> => ({ name: project.maps.length === 0 ? 'Mapa del mundo' : 'Nuevo mapa', image: '', pins: [] })}
      renderListItem={(m) => (
        <>
          <EntityThumb projectId={project.id} image={m.image} shape="rounded" fallback={<MapIcon size={16} />} />
          <span className="entity-item-text">
            <strong>{m.name || 'Sin nombre'}</strong>
            <small>{plural(m.pins.length, 'chincheta')}</small>
          </span>
        </>
      )}
      renderDetail={(m, { onDelete }) => (
        <MapEditor key={m.id} project={project} map={m} onProjectChange={onProjectChange} onDelete={onDelete} />
      )}
      empty={{
        icon: MapIcon,
        title: 'Dibuja tu mundo',
        text: 'Sube el mapa de tu mundo (una ilustración, un boceto escaneado o uno hecho con otra herramienta) y marca en él ciudades, ruinas y rutas.',
        action: 'Crear mapa'
      }}
    />
  )
}
