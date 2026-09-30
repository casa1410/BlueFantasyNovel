/**
 * Libro en 3D hecho solo con CSS (transform-style: preserve-3d): seis caras
 * (portada, contraportada, lomo, cantos de las páginas) colocadas en el
 * espacio. Se gira arrastrando con el ratón.
 *
 * Las medidas son las de un libro real de 15,24 × 22,86 cm; el grosor del lomo
 * se calcula a partir de las palabras del manuscrito (ver shared/cover.ts).
 */
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { assetUrl } from '@shared/assets'
import { BOOK_HEIGHT_CM, BOOK_WIDTH_CM, COVER_FONT_INFO, COVER_TEMPLATE_INFO } from '@shared/cover'
import type { CoverDesign, CoverFace, Id } from '@shared/types'
import { hexToRgba, TITLE_Y } from '@renderer/lib/coverRender'

export interface BookRotation {
  x: number
  y: number
}

export const VIEWS: Record<'front' | 'spine' | 'back', BookRotation> = {
  // Tres cuartos desde la izquierda: se ven la portada y el lomo.
  front: { x: -6, y: 26 },
  spine: { x: -6, y: 62 },
  back: { x: -6, y: 152 }
}

interface Book3DProps {
  cover: CoverDesign
  projectId: Id
  /** Grosor del lomo en cm. */
  spineCm: number
  rotation: BookRotation
  onRotationChange: (rotation: BookRotation) => void
  /** Altura del libro en píxeles de pantalla. */
  height?: number
}

export function Book3D({ cover, projectId, spineCm, rotation, onRotationChange, height = 440 }: Book3DProps) {
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; rotation: BookRotation } | null>(null)
  const W = Math.round((height * BOOK_WIDTH_CM) / BOOK_HEIGHT_CM)
  const H = height
  const D = Math.max(10, Math.round((height * spineCm) / BOOK_HEIGHT_CM))

  const onPointerDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY, rotation }
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    onRotationChange({
      y: start.current.rotation.y + dx * 0.5,
      x: Math.max(-35, Math.min(35, start.current.rotation.x - dy * 0.3))
    })
  }
  const onPointerUp = () => {
    start.current = null
    setDragging(false)
  }

  const face = (style: CSSProperties) => ({ position: 'absolute' as const, ...style })

  return (
    <div
      className={`book-stage ${dragging ? 'is-dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="book" style={{ width: W, height: H, transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
        {/* Portada */}
        <div className="book-face" style={face({ width: W, height: H, transform: `translateZ(${D / 2}px)` })}>
          <FrontFace cover={cover} projectId={projectId} width={W} />
        </div>
        {/* Contraportada */}
        <div className="book-face" style={face({ width: W, height: H, transform: `rotateY(180deg) translateZ(${D / 2}px)` })}>
          <BackFace cover={cover} projectId={projectId} width={W} />
        </div>
        {/* Lomo (lado izquierdo) */}
        <div className="book-face" style={face({ width: D, height: H, left: (W - D) / 2, transform: `rotateY(-90deg) translateZ(${W / 2}px)` })}>
          <SpineFace cover={cover} projectId={projectId} width={D} height={H} />
        </div>
        {/* Cantos de las páginas: derecha, arriba y abajo */}
        <div className="book-pages" style={face({ width: D - 2, height: H - 6, left: (W - D) / 2 + 1, top: 3, transform: `rotateY(90deg) translateZ(${W / 2 - 3}px)` })} />
        <div className="book-pages is-horizontal" style={face({ width: W - 6, height: D - 2, top: (H - D) / 2 + 1, left: 3, transform: `rotateX(90deg) translateZ(${H / 2 - 3}px)` })} />
        <div className="book-pages is-horizontal" style={face({ width: W - 6, height: D - 2, top: (H - D) / 2 + 1, left: 3, transform: `rotateX(-90deg) translateZ(${H / 2 - 3}px)` })} />
      </div>
      <div className="book-shadow" style={{ width: W * 1.1 }} />
    </div>
  )
}

/** Fondo común de una cara: degradado de plantilla + imagen + oscurecido. */
function faceBackground(cover: CoverDesign, face: CoverFace, projectId: Id): CSSProperties {
  const { background } = COVER_TEMPLATE_INFO[cover.template]
  const layers = [`linear-gradient(180deg, ${background[0]}, ${background[1]})`]
  if (face.image) {
    layers.unshift(
      `linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,${0.35 + face.dim * 0.5}) 100%)`,
      `linear-gradient(rgba(0,0,0,${face.dim * 0.55}), rgba(0,0,0,${face.dim * 0.55}))`,
      `url("${assetUrl(projectId, face.image)}") center / cover no-repeat`
    )
  }
  return { background: layers.join(', ') }
}

function FrontFace({ cover, projectId, width }: { cover: CoverDesign; projectId: Id; width: number }) {
  const template = COVER_TEMPLATE_INFO[cover.template]
  const font = COVER_FONT_INFO[cover.font]
  const inset = width * 0.045
  return (
    <div className="cover-face" style={{ ...faceBackground(cover, cover.front, projectId), color: template.text, fontFamily: font.family }}>
      <div className="cover-frame" style={{ inset, borderColor: hexToRgba(template.accent, 0.55) }} />
      <div className="cover-title-block" style={{ top: `${TITLE_Y[cover.titlePosition] * 100}%` }}>
        <div
          className="cover-title"
          style={{ fontSize: width * cover.titleSize, fontWeight: font.weight, textTransform: font.uppercase ? 'uppercase' : 'none' }}
        >
          {cover.title || 'Sin título'}
        </div>
        <div className="cover-rule" style={{ background: template.accent, height: Math.max(2, width * 0.006) }} />
        {cover.subtitle && (
          <div className="cover-subtitle" style={{ fontSize: width * 0.042 }}>
            {cover.subtitle}
          </div>
        )}
      </div>
      {cover.author && (
        <div className="cover-author" style={{ fontSize: width * 0.045 }}>
          {cover.author}
        </div>
      )}
    </div>
  )
}

function SpineFace({ cover, projectId, width, height }: { cover: CoverDesign; projectId: Id; width: number; height: number }) {
  const template = COVER_TEMPLATE_INFO[cover.template]
  const font = COVER_FONT_INFO[cover.font]
  const size = Math.min(width * 0.55, 20)
  return (
    <div className="cover-face spine" style={{ ...faceBackground(cover, cover.spine, projectId), color: template.text, fontFamily: font.family }}>
      <div className="spine-text" style={{ width: height, fontSize: size, fontWeight: font.weight, textTransform: font.uppercase ? 'uppercase' : 'none' }}>
        <span>{cover.title}</span>
        {cover.author && <small style={{ fontSize: size * 0.7 }}>{cover.author}</small>}
      </div>
    </div>
  )
}

function BackFace({ cover, projectId, width }: { cover: CoverDesign; projectId: Id; width: number }) {
  const template = COVER_TEMPLATE_INFO[cover.template]
  const font = COVER_FONT_INFO[cover.font]
  return (
    <div className="cover-face back" style={{ ...faceBackground(cover, cover.back, projectId), color: template.text, fontFamily: font.family }}>
      <div className="cover-frame" style={{ inset: width * 0.045, borderColor: hexToRgba(template.accent, 0.4) }} />
      <p className="cover-back-text" style={{ fontSize: width * 0.042 }}>
        {cover.backText || 'Escribe la sinopsis de la trasera en el panel «Textos».'}
      </p>
      <div className="cover-barcode" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} style={{ width: (i * 7) % 3 === 0 ? 3 : 1.5 }} />
        ))}
      </div>
    </div>
  )
}
