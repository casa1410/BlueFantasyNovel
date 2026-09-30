/**
 * Detección de menciones: encuentra en un texto los nombres (y alias) de
 * personajes, linajes, razas, entradas de lore, criaturas y términos del
 * glosario.
 *
 * Lo usan el editor (para resaltarlas) y el proceso principal (para contar
 * en qué capítulos aparece cada ficha), así que ambos coinciden siempre.
 *
 * Reglas:
 *  - Nombres propios (personajes, linajes, lore, criaturas): distinguen
 *    mayúsculas, así "Mira" (personaje) no coincide con "mira" (verbo).
 *    Excepción: un alias escrito en minúscula ("la cartógrafa") también
 *    coincide con la inicial en mayúscula, por si abre una frase.
 *  - Razas y glosario: NO distinguen mayúsculas, porque en el texto suelen ir
 *    en minúscula ("los elfos", "un ojo de sal").
 *  - Solo palabras completas: "Doran" no coincide dentro de "Dorantes".
 *  - Gana el nombre más largo: "Capitán Doran" antes que "Doran".
 */
import type { Id, MentionableCollection, Project } from './types'

export interface MentionTarget {
  id: Id
  kind: MentionableCollection
  /** Nombre principal y alias. */
  names: string[]
}

export interface MentionMatch {
  index: number
  length: number
  target: MentionTarget
}

/** Nombres de menos de 2 letras generarían demasiados falsos positivos. */
const MIN_NAME_LENGTH = 2

/** Colecciones de nombres comunes: se detectan sin distinguir mayúsculas. */
const CASE_INSENSITIVE_KINDS: MentionableCollection[] = ['races', 'glossary']

/**
 * Lista de fichas mencionables de un proyecto. El orden importa: si dos
 * fichas comparten nombre, gana la que aparece antes aquí.
 */
export function mentionTargets(
  project: Pick<Project, 'characters' | 'lore' | 'creatures' | 'races' | 'glossary' | 'lineages'>
): MentionTarget[] {
  const clean = (names: string[]) => names.map((n) => n.trim()).filter((n) => n.length >= MIN_NAME_LENGTH)
  const from = <T extends { id: Id; aliases?: string[] }>(kind: MentionableCollection, list: T[], name: (item: T) => string) =>
    list.map((item) => ({ id: item.id, kind, names: clean([name(item), ...(item.aliases ?? [])]) }))
  return [
    ...from('characters', project.characters, (c) => c.name),
    ...from('lineages', project.lineages ?? [], (l) => l.name),
    ...from('races', project.races ?? [], (r) => r.name),
    ...from('lore', project.lore, (l) => l.title),
    ...from('creatures', project.creatures, (c) => c.name),
    ...from('glossary', project.glossary ?? [], (g) => g.term)
  ].filter((t) => t.names.length > 0)
}

export interface MentionMatcher {
  /** Todas las menciones de `text`, en orden y sin solaparse. */
  find(text: string): MentionMatch[]
}

/** Clave para buscar un nombre encontrado (espacios normalizados). */
const normalize = (name: string, insensitive: boolean) => {
  const spaced = name.replace(/\s+/g, ' ')
  return insensitive ? spaced.toLocaleLowerCase('es') : spaced
}

/** Una expresión regular con todos los nombres, del más largo al más corto. */
function buildPattern(names: string[], flags: string): RegExp | null {
  if (names.length === 0) return null
  const alternatives = [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
    .join('|')
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, flags)
}

export function createMentionMatcher(targets: MentionTarget[]): MentionMatcher {
  // Si dos fichas comparten nombre, gana la primera (personajes antes que lore).
  const exact = new Map<string, MentionTarget>()
  const loose = new Map<string, MentionTarget>()
  for (const target of targets) {
    const insensitive = CASE_INSENSITIVE_KINDS.includes(target.kind)
    for (const name of target.names) {
      if (insensitive) {
        const key = normalize(name, true)
        if (!loose.has(key)) loose.set(key, target)
        continue
      }
      // Un alias en minúscula ("la cartógrafa") también vale a principio de
      // frase ("La cartógrafa…"). Al revés no: "Mira" no debe casar con "mira".
      const capitalized = name.charAt(0).toLocaleUpperCase('es') + name.slice(1)
      for (const variant of new Set([name, capitalized])) {
        const key = normalize(variant, false)
        if (!exact.has(key)) exact.set(key, target)
      }
    }
  }
  const exactPattern = buildPattern([...exact.keys()], 'gu')
  const loosePattern = buildPattern([...loose.keys()], 'giu')
  if (!exactPattern && !loosePattern) return { find: () => [] }

  const collect = (text: string, pattern: RegExp | null, table: Map<string, MentionTarget>, insensitive: boolean) => {
    const found: MentionMatch[] = []
    if (!pattern) return found
    pattern.lastIndex = 0
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
      const target = table.get(normalize(m[0], insensitive))
      if (target) found.push({ index: m.index, length: m[0].length, target })
    }
    return found
  }

  return {
    find(text) {
      const all = [...collect(text, exactPattern, exact, false), ...collect(text, loosePattern, loose, true)]
      // Ordena por posición y, si dos coinciden en el mismo sitio, gana la más larga.
      all.sort((a, b) => a.index - b.index || b.length - a.length)
      const result: MentionMatch[] = []
      let end = -1
      for (const match of all) {
        if (match.index < end) continue // solapada con una anterior
        result.push(match)
        end = match.index + match.length
      }
      return result
    }
  }
}
