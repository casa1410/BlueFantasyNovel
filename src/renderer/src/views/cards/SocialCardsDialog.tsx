/**
 * Tarjetas para redes sociales (Instagram, X, TikTok…). Se dibujan en un
 * <canvas> y se guardan como PNG, sin servicios externos.
 *
 * Tipos: Cita (fragmento del texto), Portada, Personaje, Mapa, Mundo (resumen
 * del worldbuilding) y Cifras (estadísticas de escritura).
 * Para añadir uno: su entrada en `CARD_TYPES` y su función en `PAINTERS`.
 */
import { useEffect, useRef, useState } from 'react'
import { BarChart3, BookImage, Download, Globe2, Map, Quote, User, type LucideIcon } from 'lucide-react'
import { COVER_TEMPLATE_INFO, estimatedPages } from '@shared/cover'
import { longestStreak } from '@shared/dates'
import { characterRoleLabel } from '@shared/labels'
import { manuscriptChapters, manuscriptWordCount } from '@shared/manuscript'
import { readingMinutes } from '@shared/text'
import type { Id, Project } from '@shared/types'
import { Modal } from '@renderer/components/Modal'
import { useToast } from '@renderer/components/Toasts'
import { api, errorMessage } from '@renderer/lib/api'
import { drawCover, loadAssetImage, paintFrontCover, wrapLines } from '@renderer/lib/coverRender'
import { initials } from '@renderer/lib/covers'
import './cards.css'

export type CardType = 'cita' | 'portada' | 'personaje' | 'mapa' | 'mundo' | 'cifras'

const CARD_TYPES: { id: CardType; label: string; icon: LucideIcon }[] = [
  { id: 'cita', label: 'Cita', icon: Quote },
  { id: 'portada', label: 'Cubierta', icon: BookImage },
  { id: 'personaje', label: 'Personaje', icon: User },
  { id: 'mapa', label: 'Mapa', icon: Map },
  { id: 'mundo', label: 'Mundo', icon: Globe2 },
  { id: 'cifras', label: 'Cifras', icon: BarChart3 }
]

interface CardStyle {
  label: string
  background: [string, string]
  text: string
  accent: string
}

const STYLES: Record<string, CardStyle> = {
  noche: { label: 'Noche azul', background: ['#0b1224', '#2a2f7a'], text: '#e6ecff', accent: '#86a9ff' },
  pergamino: { label: 'Pergamino', background: ['#f6ecd6', '#e3cfa4'], text: '#3b2a14', accent: '#8a5a1c' },
  aurora: { label: 'Aurora', background: ['#1b4d3e', '#5b2a86'], text: '#f2fff9', accent: '#7ff0c8' },
  brasa: { label: 'Brasa', background: ['#2a0f14', '#8a3060'], text: '#fff1ea', accent: '#ffb38a' }
}

const FORMATS = {
  cuadrado: { label: 'Cuadrado (feed)', width: 1080, height: 1080 },
  vertical: { label: 'Vertical (historias)', width: 1080, height: 1920 }
} as const

const SERIF = "'Palatino Linotype', Palatino, Georgia, serif"

interface CardOptions {
  text: string
  characterId: Id
  mapId: Id
  tagline: string
}

interface PaintContext {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  style: CardStyle
  project: Project
  options: CardOptions
}

interface SocialCardsDialogProps {
  project: Project
  initialType?: CardType
  initialText?: string
  onClose: () => void
}

export function SocialCardsDialog({ project, initialType, initialText = '', onClose }: SocialCardsDialogProps) {
  const [type, setType] = useState<CardType>(initialType ?? (initialText.trim() ? 'cita' : 'portada'))
  const [styleKey, setStyleKey] = useState('noche')
  const [formatKey, setFormatKey] = useState<keyof typeof FORMATS>('cuadrado')
  const [options, setOptions] = useState<CardOptions>({
    text: initialText.trim(),
    characterId: project.characters[0]?.id ?? '',
    mapId: project.maps.find((m) => m.image)?.id ?? '',
    tagline: 'Muy pronto'
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const toast = useToast()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const { width, height } = FORMATS[formatKey]
    // Se dibuja en un canvas aparte y se copia al final, para que un dibujo
    // anterior más lento (imágenes) no pise al actual.
    const buffer = document.createElement('canvas')
    buffer.width = width
    buffer.height = height
    const ctx = buffer.getContext('2d')!
    paintBackground(ctx, width, height, STYLES[styleKey])
    void PAINTERS[type]({ ctx, w: width, h: height, style: STYLES[styleKey], project, options }).then(() => {
      if (cancelled) return
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(buffer, 0, 0)
    })
    return () => {
      cancelled = true
    }
  }, [type, styleKey, formatKey, options, project])

  const save = async () => {
    try {
      const result = await api.files.savePng(canvasRef.current!.toDataURL('image/png'), `${project.title} - ${type}`)
      if (result.status === 'saved') toast.success(`Imagen guardada en ${result.filePath}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const set = (patch: Partial<CardOptions>) => setOptions({ ...options, ...patch })

  return (
    <Modal
      size="lg"
      title="Tarjetas para redes sociales"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Download size={15} /> Guardar imagen
          </button>
        </>
      }
    >
      <div className="card-types">
        {CARD_TYPES.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`card-type ${type === id ? 'is-active' : ''}`} onClick={() => setType(id)}>
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
      <div className="social-card">
        <canvas ref={canvasRef} className="social-card-preview" />
        <div className="social-card-options">
          {type === 'cita' && (
            <label className="field">
              <span className="field-label">Texto</span>
              <textarea className="textarea" rows={5} value={options.text} onChange={(e) => set({ text: e.target.value })} placeholder="Pega o escribe un fragmento de tu historia…" />
            </label>
          )}
          {type === 'portada' && (
            <label className="field">
              <span className="field-label">Frase</span>
              <input className="input" value={options.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="Muy pronto / Ya disponible…" />
              <span className="field-hint">Se usa el diseño de la sección «Cubierta».</span>
            </label>
          )}
          {type === 'personaje' && (
            <label className="field">
              <span className="field-label">Personaje</span>
              <select className="select" value={options.characterId} onChange={(e) => set({ characterId: e.target.value })}>
                {project.characters.length === 0 && <option value="">No hay personajes</option>}
                {project.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {type === 'mapa' && (
            <label className="field">
              <span className="field-label">Mapa</span>
              <select className="select" value={options.mapId} onChange={(e) => set({ mapId: e.target.value })}>
                {project.maps.length === 0 && <option value="">No hay mapas</option>}
                {project.maps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span className="field-label">Estilo</span>
            <select className="select" value={styleKey} onChange={(e) => setStyleKey(e.target.value)}>
              {Object.entries(STYLES).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Formato</span>
            <select className="select" value={formatKey} onChange={(e) => setFormatKey(e.target.value as keyof typeof FORMATS)}>
              {Object.entries(FORMATS).map(([key, f]) => (
                <option key={key} value={key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Dibujo                                                                     */
/* -------------------------------------------------------------------------- */

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, style: CardStyle): void {
  const gradient = ctx.createLinearGradient(0, 0, w, h)
  gradient.addColorStop(0, style.background[0])
  gradient.addColorStop(1, style.background[1])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
}

/** Pie común: filete de acento + título del libro. */
function paintFooter({ ctx, w, h, style, project }: PaintContext, y = h - h * 0.08): void {
  ctx.fillStyle = style.accent
  ctx.fillRect(w / 2 - 40, y - 40, 80, 4)
  ctx.font = `italic ${Math.round(w * 0.032)}px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(project.title, w / 2, y - 20)
}

function centeredText(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number): number {
  for (const line of lines) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
  return y
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

const PAINTERS: Record<CardType, (p: PaintContext) => Promise<void>> = {
  async cita(p) {
    const { ctx, w, h, style, options } = p
    const quote = options.text.replace(/\s+/g, ' ').trim()
    if (!quote) return paintMessage(p, 'Escribe o selecciona un fragmento para la cita')
    const margin = w * 0.12
    let size = 72
    let lines: string[] = []
    for (; size >= 28; size -= 2) {
      ctx.font = `${size}px ${SERIF}`
      lines = wrapLines(ctx, `«${quote}»`, w - margin * 2)
      if (lines.length * size * 1.4 <= h * 0.62) break
    }
    ctx.fillStyle = style.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const y = centeredText(ctx, lines, w / 2, (h - lines.length * size * 1.4) / 2 - h * 0.04, size * 1.4)
    paintFooter(p, Math.min(h - h * 0.06, y + h * 0.1))
  },

  async portada(p) {
    const { ctx, w, h, style, project, options } = p
    // Halo de la plantilla de la portada detrás del libro.
    const accent = COVER_TEMPLATE_INFO[project.cover.template].accent
    const halo = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, w * 0.6)
    halo.addColorStop(0, `${accent}55`)
    halo.addColorStop(1, 'transparent')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, w, h)
    const coverH = h * (h > w ? 0.55 : 0.68)
    const coverW = (coverH * 2) / 3
    const x = (w - coverW) / 2
    const y = h * (h > w ? 0.16 : 0.08)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 50
    ctx.shadowOffsetY = 20
    ctx.fillStyle = '#000'
    ctx.fillRect(x, y, coverW, coverH)
    ctx.restore()
    await paintFrontCover(ctx, { ...project.cover, title: project.cover.title || project.title }, project.id, x, y, coverW, coverH)
    if (options.tagline.trim()) {
      ctx.fillStyle = style.text
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.font = `600 ${Math.round(w * 0.05)}px ${SERIF}`
      ctx.fillText(options.tagline.trim().toLocaleUpperCase('es'), w / 2, y + coverH + h * 0.05)
    }
  },

  async personaje(p) {
    const { ctx, w, h, style, project, options } = p
    const c = project.characters.find((x) => x.id === options.characterId)
    if (!c) return paintMessage(p, 'Crea personajes para usar esta tarjeta')
    const r = w * 0.2
    const cy = h * (h > w ? 0.3 : 0.28)
    ctx.save()
    ctx.beginPath()
    ctx.arc(w / 2, cy, r, 0, Math.PI * 2)
    ctx.clip()
    const img = await loadAssetImage(project.id, c.image)
    if (img) drawCover(ctx, img, w / 2 - r, cy - r, r * 2, r * 2)
    else {
      ctx.fillStyle = c.color
      ctx.fillRect(w / 2 - r, cy - r, r * 2, r * 2)
      ctx.fillStyle = '#fff'
      ctx.font = `600 ${r * 0.8}px ${SERIF}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(initials(c.name), w / 2, cy)
    }
    ctx.restore()
    ctx.strokeStyle = style.accent
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(w / 2, cy, r + 6, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = style.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = `700 ${Math.round(w * 0.075)}px ${SERIF}`
    let y = cy + r + h * 0.05
    y = centeredText(ctx, wrapLines(ctx, c.name, w * 0.84), w / 2, y, w * 0.085)
    const race = project.races.find((x) => x.id === c.raceId)?.name
    const lineage = project.lineages.find((x) => x.id === c.lineageId)?.name
    ctx.fillStyle = style.accent
    const subtitle = [characterRoleLabel(c), race, lineage].filter(Boolean).join(' · ').toLocaleUpperCase('es')
    // Reduce la letra hasta que la línea quepa en el ancho de la tarjeta.
    let size = Math.round(w * 0.034)
    do ctx.font = `600 ${size--}px ${SERIF}`
    while (ctx.measureText(subtitle).width > w * 0.86 && size > 14)
    ctx.fillText(subtitle, w / 2, y + 6)
    const blurb = c.personality || c.motivation || c.appearance
    if (blurb) {
      ctx.fillStyle = style.text
      ctx.font = `italic ${Math.round(w * 0.036)}px ${SERIF}`
      centeredText(ctx, wrapLines(ctx, blurb, w * 0.76).slice(0, 4), w / 2, y + h * 0.06, w * 0.05)
    }
    paintFooter(p)
  },

  async mapa(p) {
    const { ctx, w, h, style, project, options } = p
    const map = project.maps.find((m) => m.id === options.mapId)
    const img = map ? await loadAssetImage(project.id, map.image) : null
    if (!map || !img) return paintMessage(p, 'Crea un mapa con imagen para usar esta tarjeta')
    const pad = w * 0.07
    const boxH = h * (h > w ? 0.62 : 0.66)
    ctx.save()
    roundedRect(ctx, pad, pad * 1.4, w - pad * 2, boxH, 24)
    ctx.clip()
    drawCover(ctx, img, pad, pad * 1.4, w - pad * 2, boxH)
    ctx.restore()
    ctx.strokeStyle = style.accent
    ctx.lineWidth = 4
    roundedRect(ctx, pad, pad * 1.4, w - pad * 2, boxH, 24)
    ctx.stroke()
    ctx.fillStyle = style.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = `700 ${Math.round(w * 0.06)}px ${SERIF}`
    ctx.fillText(map.name, w / 2, pad * 1.4 + boxH + h * 0.03)
    const places = map.pins.map((pin) => pin.label || project.lore.find((l) => l.id === pin.loreId)?.title).filter(Boolean)
    if (places.length) {
      ctx.font = `${Math.round(w * 0.03)}px ${SERIF}`
      ctx.fillStyle = style.accent
      centeredText(ctx, wrapLines(ctx, places.join(' · '), w * 0.84).slice(0, 2), w / 2, pad * 1.4 + boxH + h * 0.1, w * 0.042)
    }
    paintFooter(p)
  },

  async mundo(p) {
    const { project } = p
    const places = project.lore.filter((l) => l.category === 'lugar').length
    await paintStats(p, 'El mundo de', [
      [project.characters.length, 'personajes'],
      [places || project.lore.length, places ? 'lugares' : 'entradas de lore'],
      [project.creatures.length, 'criaturas'],
      [project.races.length, 'razas'],
      [project.lineages.length, 'linajes'],
      [project.events.length, 'eventos históricos']
    ])
  },

  async cifras(p) {
    const { project } = p
    const words = manuscriptWordCount(project.chapters)
    const days = Object.values(project.dailyWords).filter((x) => x > 0).length
    const minutes = readingMinutes(words)
    await paintStats(p, 'Escribiendo', [
      [words, 'palabras'],
      [manuscriptChapters(project.chapters).length, 'capítulos'],
      [estimatedPages(words), 'páginas'],
      [days, 'días escribiendo'],
      [longestStreak(project.dailyWords), 'días de racha máxima'],
      [minutes >= 60 ? Math.round(minutes / 60) : minutes, minutes >= 60 ? 'horas de lectura' : 'minutos de lectura']
    ])
  }
}

/** Cuadrícula de 6 cifras con un encabezado. */
async function paintStats(p: PaintContext, heading: string, stats: [number, string][]): Promise<void> {
  const { ctx, w, h, style, project } = p
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = style.accent
  ctx.font = `600 ${Math.round(w * 0.034)}px ${SERIF}`
  const top = h > w ? h * 0.14 : h * 0.08
  ctx.fillText(heading.toLocaleUpperCase('es'), w / 2, top)
  ctx.fillStyle = style.text
  ctx.font = `700 ${Math.round(w * 0.07)}px ${SERIF}`
  const titleEnd = centeredText(ctx, wrapLines(ctx, project.title, w * 0.84).slice(0, 2), w / 2, top + w * 0.06, w * 0.08)

  const cols = 2
  const cellW = (w * 0.8) / cols
  const cellH = h > w ? h * 0.17 : h * 0.19
  const startY = titleEnd + h * 0.05
  stats.forEach(([value, label], i) => {
    const cx = w * 0.1 + (i % cols) * cellW + cellW / 2
    const cy = startY + Math.floor(i / cols) * cellH
    ctx.fillStyle = style.text
    ctx.font = `700 ${Math.round(w * 0.085)}px ${SERIF}`
    ctx.fillText(value.toLocaleString('es-ES'), cx, cy)
    ctx.fillStyle = style.accent
    ctx.font = `${Math.round(w * 0.03)}px ${SERIF}`
    ctx.fillText(label, cx, cy + w * 0.1)
  })
  if (project.genre) {
    ctx.fillStyle = style.text
    ctx.font = `italic ${Math.round(w * 0.03)}px ${SERIF}`
    ctx.fillText(project.genre, w / 2, h - h * 0.08)
  }
}

function paintMessage({ ctx, w, h, style }: PaintContext, message: string): Promise<void> {
  ctx.fillStyle = style.text
  ctx.globalAlpha = 0.7
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `italic ${Math.round(w * 0.035)}px ${SERIF}`
  centeredText(ctx, wrapLines(ctx, message, w * 0.7), w / 2, h / 2, w * 0.05)
  ctx.globalAlpha = 1
  return Promise.resolve()
}
