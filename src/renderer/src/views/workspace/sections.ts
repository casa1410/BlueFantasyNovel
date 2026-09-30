import {
  BarChart3,
  BookA,
  BookImage,
  Clock,
  Crown,
  Dna,
  Feather,
  Images,
  Map,
  Network,
  PawPrint,
  Route,
  ScrollText,
  Users,
  type LucideIcon
} from 'lucide-react'
import type { EntityCollection } from '@shared/types'

/** Secciones de un proyecto. */
export type WorkspaceSection =
  | 'manuscript'
  | 'plots'
  | 'cover'
  | 'stats'
  | 'characters'
  | 'relations'
  | 'lineages'
  | 'races'
  | 'lore'
  | 'glossary'
  | 'bestiary'
  | 'timeline'
  | 'maps'
  | 'boards'

export interface SectionDefinition {
  id: WorkspaceSection
  label: string
  icon: LucideIcon
  /** Si la sección muestra fichas, de qué colección (para el contador). */
  collection?: EntityCollection
}

export interface SectionGroup {
  id: string
  label: string
  sections: SectionDefinition[]
}

/**
 * Barra lateral, agrupada. Para añadir una sección: añade su id a
 * `WorkspaceSection`, su entrada en el grupo que toque y su vista en el
 * objeto `views` de ProjectWorkspace.tsx.
 */
export const SECTION_GROUPS: SectionGroup[] = [
  {
    id: 'write',
    label: 'Escribir',
    sections: [
      { id: 'manuscript', label: 'Manuscrito', icon: Feather },
      { id: 'plots', label: 'Tramas', icon: Route, collection: 'plotlines' },
      { id: 'cover', label: 'Cubierta', icon: BookImage },
      { id: 'stats', label: 'Estadísticas', icon: BarChart3 }
    ]
  },
  {
    id: 'people',
    label: 'Personajes',
    sections: [
      { id: 'characters', label: 'Personajes', icon: Users, collection: 'characters' },
      { id: 'relations', label: 'Relaciones', icon: Network, collection: 'relationships' },
      { id: 'lineages', label: 'Linajes', icon: Crown, collection: 'lineages' },
      { id: 'races', label: 'Razas', icon: Dna, collection: 'races' }
    ]
  },
  {
    id: 'world',
    label: 'Mundo',
    sections: [
      { id: 'lore', label: 'Lore', icon: ScrollText, collection: 'lore' },
      { id: 'glossary', label: 'Glosario', icon: BookA, collection: 'glossary' },
      { id: 'bestiary', label: 'Bestiario', icon: PawPrint, collection: 'creatures' },
      { id: 'timeline', label: 'Línea temporal', icon: Clock, collection: 'events' },
      { id: 'maps', label: 'Mapas', icon: Map, collection: 'maps' },
      { id: 'boards', label: 'Inspiración', icon: Images, collection: 'boards' }
    ]
  }
]
