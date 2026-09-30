/**
 * Dibuja la portada (cara delantera) en un <canvas>. Se usa para descargarla
 * como PNG y para la tarjeta de redes "Portada".
 *
 * La maquetación imita a la de la vista 3D (views/cover/Book3D.tsx): si
 * cambias una, revisa la otra.
 */
import { assetUrl } from '@shared/assets'
import { COVER_FONT_INFO, COVER_TEMPLATE_INFO } from '@shared/cover'
import type { CoverDesign, Id } from '@shared/types'

/** Posición vertical del título según `titlePosition` (fracción de la altura). */
export const TITLE_Y = { top: 0.14, center: 0.42, bottom: 0.66 } as const

/** Carga una imagen del proyecto lista para dibujar en canvas. */
export function loadAssetImage(projectId: Id, file: string): Promise<HTMLImageElement | null> {
  if (!file) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // permite exportar el canvas (ver main/assets.ts)
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = assetUrl(projectId, file)
  })
}

/** Dibuja `img` cubriendo el rectángulo (como object-fit: cover). */
export function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = candidate
  }
  if (line) lines.push(line)
  return lines
}

/** Dibuja la portada en el rectángulo (x, y, w, h) de un contexto existente. */
export async function paintFrontCover(
  ctx: CanvasRenderingContext2D,
  cover: CoverDesign,
  projectId: Id,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<void> {
  const template = COVER_TEMPLATE_INFO[cover.template]
  const font = COVER_FONT_INFO[cover.font]
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  // Fondo: degradado de la plantilla y, encima, la imagen oscurecida.
  const gradient = ctx.createLinearGradient(x, y, x, y + h)
  gradient.addColorStop(0, template.background[0])
  gradient.addColorStop(1, template.background[1])
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, w, h)
  const img = await loadAssetImage(projectId, cover.front.image)
  if (img) {
    drawCover(ctx, img, x, y, w, h)
    ctx.fillStyle = `rgba(0, 0, 0, ${cover.front.dim * 0.55})`
    ctx.fillRect(x, y, w, h)
    const shade = ctx.createLinearGradient(x, y + h * 0.55, x, y + h)
    shade.addColorStop(0, 'rgba(0,0,0,0)')
    shade.addColorStop(1, `rgba(0,0,0,${0.35 + cover.front.dim * 0.5})`)
    ctx.fillStyle = shade
    ctx.fillRect(x, y, w, h)
  }

  // Marco fino.
  ctx.strokeStyle = hexToRgba(template.accent, 0.55)
  ctx.lineWidth = Math.max(1, w * 0.004)
  const inset = w * 0.045
  ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2)

  // Título.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = template.text
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = w * 0.02
  const titleSize = w * cover.titleSize
  ctx.font = `${font.weight} ${titleSize}px ${font.family}`
  const title = font.uppercase ? cover.title.toLocaleUpperCase('es') : cover.title
  const lines = wrapLines(ctx, title, w * 0.78)
  let cursor = y + h * TITLE_Y[cover.titlePosition]
  for (const line of lines) {
    ctx.fillText(line, x + w / 2, cursor)
    cursor += titleSize * 1.08
  }
  ctx.shadowBlur = 0

  // Filete de acento bajo el título.
  ctx.fillStyle = template.accent
  ctx.fillRect(x + w / 2 - w * 0.08, cursor + titleSize * 0.2, w * 0.16, Math.max(2, w * 0.006))
  cursor += titleSize * 0.2 + w * 0.03

  if (cover.subtitle) {
    ctx.fillStyle = template.text
    ctx.font = `italic ${w * 0.042}px ${font.family}`
    for (const line of wrapLines(ctx, cover.subtitle, w * 0.72)) {
      ctx.fillText(line, x + w / 2, cursor)
      cursor += w * 0.052
    }
  }

  if (cover.author) {
    ctx.fillStyle = template.text
    ctx.font = `600 ${w * 0.045}px ${font.family}`
    ctx.fillText(cover.author.toLocaleUpperCase('es'), x + w / 2, y + h * 0.88)
  }
  ctx.restore()
}

/** Genera la portada como PNG (data URL) de 1600 × 2400 px. */
export async function renderFrontCoverPng(cover: CoverDesign, projectId: Id): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 2400
  await paintFrontCover(canvas.getContext('2d')!, cover, projectId, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
