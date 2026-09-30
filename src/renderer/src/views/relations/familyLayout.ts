/**
 * Colocación automática del árbol genealógico a partir de las relaciones
 * `progenitor` (padre/madre → hijo/a) y `pareja`.
 *
 * Algoritmo (sencillo y predecible, pensado para familias de novela):
 *  1. Generación de cada persona = la de su progenitor más joven + 1
 *     (las parejas se igualan a la mayor de las dos).
 *  2. Dentro de cada generación, se ordena por la posición media de los
 *     progenitores (así los hijos quedan debajo de sus padres) y se colocan
 *     juntas las parejas.
 *  3. Cada fila se centra horizontalmente.
 */
import type { Id, Point, Relationship } from '@shared/types'

export const FAMILY_NODE_WIDTH = 180
const H_GAP = 40
const V_GAP = 150

export interface FamilyLayout {
  positions: Map<Id, Point>
  /** Personajes que forman parte del árbol. */
  members: Set<Id>
}

export function layoutFamily(relationships: Relationship[]): FamilyLayout {
  const parentsOf = new Map<Id, Id[]>()
  const partnersOf = new Map<Id, Set<Id>>()
  const members = new Set<Id>()

  for (const r of relationships) {
    if (r.kind === 'progenitor') {
      parentsOf.set(r.targetId, [...(parentsOf.get(r.targetId) ?? []), r.sourceId])
    } else if (r.kind === 'pareja') {
      if (!partnersOf.has(r.sourceId)) partnersOf.set(r.sourceId, new Set())
      if (!partnersOf.has(r.targetId)) partnersOf.set(r.targetId, new Set())
      partnersOf.get(r.sourceId)!.add(r.targetId)
      partnersOf.get(r.targetId)!.add(r.sourceId)
    } else continue
    members.add(r.sourceId)
    members.add(r.targetId)
  }

  // 1. Generaciones (con protección frente a ciclos imposibles).
  const generation = new Map<Id, number>()
  const computing = new Set<Id>()
  const genOf = (id: Id): number => {
    if (generation.has(id)) return generation.get(id)!
    if (computing.has(id)) return 0
    computing.add(id)
    const parents = parentsOf.get(id) ?? []
    const value = parents.length ? Math.max(...parents.map(genOf)) + 1 : 0
    computing.delete(id)
    generation.set(id, value)
    return value
  }
  members.forEach(genOf)
  // Igualar parejas y volver a propagar a los hijos, unas cuantas pasadas.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    for (const [id, partners] of partnersOf) {
      for (const partner of partners) {
        const g = Math.max(generation.get(id)!, generation.get(partner)!)
        if (generation.get(id) !== g || generation.get(partner) !== g) changed = true
        generation.set(id, g)
        generation.set(partner, g)
      }
    }
    for (const id of members) {
      const parents = parentsOf.get(id) ?? []
      if (parents.length) {
        const g = Math.max(...parents.map((p) => generation.get(p)!)) + 1
        if (g > generation.get(id)!) {
          generation.set(id, g)
          changed = true
        }
      }
    }
    if (!changed) break
  }

  // 2. Orden dentro de cada fila.
  const rows = new Map<number, Id[]>()
  for (const id of members) {
    const g = generation.get(id)!
    rows.set(g, [...(rows.get(g) ?? []), id])
  }
  const order = new Map<Id, number>()
  const sortedGens = [...rows.keys()].sort((a, b) => a - b)
  for (const g of sortedGens) {
    const row = rows.get(g)!
    const score = (id: Id) => {
      const parents = (parentsOf.get(id) ?? []).filter((p) => order.has(p))
      return parents.length ? parents.reduce((s, p) => s + order.get(p)!, 0) / parents.length : Number.MAX_SAFE_INTEGER
    }
    row.sort((a, b) => score(a) - score(b))
    // Coloca cada pareja inmediatamente a continuación de su compañero/a.
    const arranged: Id[] = []
    for (const id of row) {
      if (arranged.includes(id)) continue
      arranged.push(id)
      for (const partner of partnersOf.get(id) ?? []) {
        if (row.includes(partner) && !arranged.includes(partner)) arranged.push(partner)
      }
    }
    arranged.forEach((id, i) => order.set(id, i))
    rows.set(g, arranged)
  }

  // 3. Coordenadas, con cada fila centrada.
  const widest = Math.max(1, ...[...rows.values()].map((r) => r.length))
  const positions = new Map<Id, Point>()
  for (const [g, row] of rows) {
    const offset = ((widest - row.length) * (FAMILY_NODE_WIDTH + H_GAP)) / 2
    row.forEach((id, i) => positions.set(id, { x: offset + i * (FAMILY_NODE_WIDTH + H_GAP), y: g * V_GAP }))
  }
  return { positions, members }
}

/** Posiciones en círculo para el mapa de relaciones (colocación inicial). */
export function circleLayout(ids: Id[]): Map<Id, Point> {
  const radius = Math.max(180, ids.length * 45)
  const positions = new Map<Id, Point>()
  ids.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, ids.length) - Math.PI / 2
    positions.set(id, { x: Math.round(radius + radius * Math.cos(angle)), y: Math.round(radius + radius * Math.sin(angle)) })
  })
  return positions
}
