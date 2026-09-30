/**
 * Portada del libro: valores por defecto, plantillas de color, tipografías y
 * medidas físicas (para la vista 3D y para dibujarla en PNG).
 */
import type { CoverDesign, CoverFont, CoverTemplate } from './types'

export function defaultCover(title = ''): CoverDesign {
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
    titlePosition: 'top'
  }
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

/** Grosor del lomo en cm, según las páginas (con mínimo para que se vea). */
export function spineThicknessCm(words: number): number {
  return Math.max(1, (estimatedPages(words) / 2) * SHEET_THICKNESS_CM + 0.2)
}
