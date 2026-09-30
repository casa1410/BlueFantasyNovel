/**
 * Portadas generadas: cada proyecto recibe un degradado único y estable
 * calculado a partir de su id (el mismo proyecto siempre tiene el mismo
 * color). Los tonos se limitan a azules, violetas y turquesas para
 * mantener la estética de la aplicación.
 */
function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function coverGradient(seed: string): string {
  const hash = hashString(seed)
  const hue = 190 + (hash % 90) // entre 190 (turquesa) y 280 (violeta)
  const shift = 25 + ((hash >> 8) % 35)
  const angle = (hash >> 16) % 360
  return `linear-gradient(${angle}deg, hsl(${hue} 70% 32%), hsl(${hue + shift} 75% 18%))`
}

/** Palabras que no aportan inicial ("La Torre de Cristal" -> "TC"). */
const STOPWORDS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'y', 'en', 'the', 'of', 'a', 'an'])

/** Iniciales para portadas y avatares: "La Torre de Cristal" -> "TC". */
export function initials(text: string): string {
  const all = text.split(/\s+/).filter(Boolean)
  const meaningful = all.filter((w) => !STOPWORDS.has(w.toLowerCase()))
  const letters = (meaningful.length ? meaningful : all).slice(0, 2).map((w) => w[0])
  return letters.join('').toUpperCase() || '?'
}
