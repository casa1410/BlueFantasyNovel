/**
 * Portada del libro: valores por defecto, plantillas de color, tipografías y
 * medidas físicas (para la vista 3D y para dibujarla en PNG).
 */
import { COVER_FONTS, COVER_TEMPLATES, type CoverBook, type CoverDesign, type CoverFont, type CoverTemplate, type CoverVolume } from './types'

/** Diseño de un libro con los valores por defecto. */
export function defaultBook(title = ''): CoverBook {
  return {
    template: 'noche',
    front: { image: '', dim: 0.35 },
    spine: { image: '', dim: 0.35 },
    back: { image: '', dim: 0.5 },
    title,
    author: '',
    subtitle: '',
    backText: '',
    font: 'serif-clasica',
    titleSize: 0.11,
    titlePosition: 'top',
    pages: 0,
    volumeLabel: ''
  }
}

export function defaultCover(title = ''): CoverDesign {
  return { ...defaultBook(title), volumes: [], shelfPosition: 0 }
}

/** Tomos como máximo en la colección. */
export const MAX_VOLUMES = 30
export const MAX_PAGES = 3000

const clampInt = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
const text = (value: unknown, fallback: string, max = 2000) => (typeof value === 'string' ? value.slice(0, max) : fallback)

/** Un libro con todos sus campos válidos (lo que falte o no encaje, por defecto). */
function completeBook(raw: unknown, title: string): CoverBook {
  const base = defaultBook(title)
  const c = (raw && typeof raw === 'object' ? raw : {}) as Partial<CoverBook>
  const face = (key: 'front' | 'spine' | 'back') => {
    const f = (c[key] && typeof c[key] === 'object' ? c[key] : {}) as Partial<CoverBook['front']>
    return {
      image: typeof f.image === 'string' ? f.image : '',
      dim: typeof f.dim === 'number' && Number.isFinite(f.dim) ? Math.min(1, Math.max(0, f.dim)) : base[key].dim
    }
  }
  return {
    template: COVER_TEMPLATES.includes(c.template as CoverTemplate) ? (c.template as CoverTemplate) : base.template,
    front: face('front'),
    spine: face('spine'),
    back: face('back'),
    title: text(c.title, base.title, 300),
    author: text(c.author, '', 300),
    subtitle: text(c.subtitle, '', 300),
    backText: text(c.backText, '', 5000),
    font: COVER_FONTS.includes(c.font as CoverFont) ? (c.font as CoverFont) : base.font,
    titleSize: typeof c.titleSize === 'number' && Number.isFinite(c.titleSize) ? Math.min(0.16, Math.max(0.06, c.titleSize)) : base.titleSize,
    titlePosition: c.titlePosition === 'center' || c.titlePosition === 'bottom' ? c.titlePosition : 'top',
    pages: clampInt(c.pages, 0, MAX_PAGES, 0),
    volumeLabel: text(c.volumeLabel, '', 30)
  }
}

/** Cubierta completa y válida a partir de lo guardado o de lo que envía la interfaz. */
export function completeCover(raw: unknown, title = ''): CoverDesign {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Partial<CoverDesign>
  const seen = new Set<string>()
  const volumes: CoverVolume[] = []
  for (const v of Array.isArray(c.volumes) ? c.volumes : []) {
    const id = v && typeof v === 'object' && typeof v.id === 'string' ? v.id.slice(0, 64) : ''
    if (!id || seen.has(id) || volumes.length >= MAX_VOLUMES) continue
    seen.add(id)
    volumes.push({ ...completeBook(v, ''), id })
  }
  return { ...completeBook(c, title), volumes, shelfPosition: clampInt(c.shelfPosition, 0, volumes.length, 0) }
}

export interface CoverTemplateInfo {
  label: string
  /** Degradado de fondo (arriba → abajo). */
  background: [string, string]
  /** Color del texto. */
  text: string
  /** Color de acento: filetes y detalles. */
  accent: string
}

export const COVER_TEMPLATE_INFO: Record<CoverTemplate, CoverTemplateInfo> = {
  brasa: { label: 'Brasa', background: ['#3a140c', '#140604'], text: '#fbe9dc', accent: '#e8733a' },
  bosque: { label: 'Bosque', background: ['#10261c', '#06110c'], text: '#e8f5ec', accent: '#4fd1a5' },
  noche: { label: 'Noche azul', background: ['#10204a', '#050b1c'], text: '#e6ecff', accent: '#5bb0ff' },
  sangre: { label: 'Sangre', background: ['#3d0a12', '#150306'], text: '#ffe6ea', accent: '#e8475e' },
  pergamino: { label: 'Pergamino', background: ['#f1e2c0', '#d8bf8e'], text: '#3a2610', accent: '#8a5a1c' },
  arcano: { label: 'Arcano', background: ['#2a0d4a', '#0d0419'], text: '#f3e6ff', accent: '#e84fa8' }
}

/** Tipografías disponibles en cualquier Windows (la app funciona sin internet). */
export const COVER_FONT_INFO: Record<CoverFont, { label: string; family: string; weight: number; uppercase: boolean }> = {
  'serif-clasica': { label: 'Serif clásica', family: "'Palatino Linotype', Palatino, Georgia, serif", weight: 700, uppercase: true },
  'serif-elegante': { label: 'Serif elegante', family: "Constantia, 'Book Antiqua', Georgia, serif", weight: 400, uppercase: false },
  sans: { label: 'Sin serifa', family: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", weight: 700, uppercase: true },
  antigua: { label: 'Antigua', family: "'Book Antiqua', 'Palatino Linotype', serif", weight: 400, uppercase: true },
  moderna: { label: 'Moderna', family: "'Bahnschrift', 'Segoe UI', sans-serif", weight: 600, uppercase: true }
}

/** Formato físico: 15,24 × 22,86 cm (6 × 9 pulgadas), el habitual en novela. */
export const BOOK_WIDTH_CM = 15.24
export const BOOK_HEIGHT_CM = 22.86
const WORDS_PER_PAGE = 280
/** Grosor de una hoja de papel de 80 g (dos páginas), en cm. */
const SHEET_THICKNESS_CM = 0.01

/** Páginas aproximadas del libro impreso. */
export function estimatedPages(words: number): number {
  return Math.max(24, Math.ceil(words / WORDS_PER_PAGE / 2) * 2)
}

/** Páginas de un libro: las que se hayan escrito a mano o, si no, las estimadas. */
export function bookPages(book: Pick<CoverBook, 'pages'>, words: number): number {
  return book.pages > 0 ? book.pages : estimatedPages(words)
}

/** Grosor del lomo en cm según las páginas (con mínimo para que se vea). */
export function spineCmForPages(pages: number): number {
  return Math.max(0.4, (Math.max(0, pages) / 2) * SHEET_THICKNESS_CM + 0.2)
}

/** Grosor del lomo en cm, según las páginas estimadas por las palabras. */
export function spineThicknessCm(words: number): number {
  return Math.max(1, spineCmForPages(estimatedPages(words)))
}
