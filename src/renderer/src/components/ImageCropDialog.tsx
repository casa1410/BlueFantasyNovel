/**
 * Recorte cuadrado de una imagen: se arrastra para encuadrar y se acerca con
 * la barra (o la rueda del ratón). Devuelve el recorte como PNG (data URL).
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { assetUrl } from '@shared/assets'
import type { AssetFileName, Id } from '@shared/types'
import { Modal } from './Modal'
import './imageCropDialog.css'

/** Lado del marco de recorte en pantalla (px). */
const VIEW = 300
const MAX_ZOOM = 5
/** Lado máximo de la imagen recortada (px). Sobra para retratos y tarjetas. */
const MAX_OUTPUT = 1024

interface ImageCropDialogProps {
  projectId: Id
  image: AssetFileName
  /** circle: retratos de personaje · square: el resto. Solo cambia la guía visual. */
  shape: 'circle' | 'square'
  onCancel: () => void
  onConfirm: (pngDataUrl: string) => void | Promise<void>
}

interface View {
  zoom: number
  /** Posición de la esquina superior izquierda de la imagen dentro del marco (px). */
  x: number
  y: number
}

export function ImageCropDialog({ projectId, image, shape, onCancel, onConfirm }: ImageCropDialogProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = new Image()
    element.crossOrigin = 'anonymous' // para poder leer el <canvas> al recortar
    element.onload = () => {
      setImg(element)
      // Al empezar, la imagen entera cubre el marco y queda centrada.
      const scale = baseScale(element)
      setView({ zoom: 1, x: (VIEW - element.naturalWidth * scale) / 2, y: (VIEW - element.naturalHeight * scale) / 2 })
    }
    element.onerror = () => setFailed(true)
    element.src = assetUrl(projectId, image)
  }, [projectId, image])

  /** Aplica un cambio sin dejar huecos: la imagen siempre cubre todo el marco. */
  const clampView = (next: View): View => {
    if (!img) return next
    const zoom = Math.min(MAX_ZOOM, Math.max(1, next.zoom))
    const scale = baseScale(img) * zoom
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    return { zoom, x: Math.min(0, Math.max(VIEW - w, next.x)), y: Math.min(0, Math.max(VIEW - h, next.y)) }
  }

  /** Cambia el zoom manteniendo fijo el punto (cx, cy) del marco. */
  const zoomTo = (zoom: number, cx = VIEW / 2, cy = VIEW / 2) => {
    setView((current) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, zoom))
      const ratio = z / current.zoom
      return clampView({ zoom: z, x: cx - (cx - current.x) * ratio, y: cy - (cy - current.y) * ratio })
    })
  }

  // La rueda se registra a mano: React la añade como pasiva y no deja evitar el scroll.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !img) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = frame.getBoundingClientRect()
      setView((current) => {
        const z = Math.min(MAX_ZOOM, Math.max(1, current.zoom * Math.exp(-e.deltaY * 0.0015)))
        const ratio = z / current.zoom
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        return clampView({ zoom: z, x: cx - (cx - current.x) * ratio, y: cy - (cy - current.y) * ratio })
      })
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [img])

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const frame = e.currentTarget
    frame.setPointerCapture(e.pointerId)
    let last = { x: e.clientX, y: e.clientY }
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - last.x
      const dy = ev.clientY - last.y
      last = { x: ev.clientX, y: ev.clientY }
      setView((current) => clampView({ ...current, x: current.x + dx, y: current.y + dy }))
    }
    const onUp = () => {
      frame.removeEventListener('pointermove', onMove)
      frame.removeEventListener('pointerup', onUp)
    }
    frame.addEventListener('pointermove', onMove)
    frame.addEventListener('pointerup', onUp)
  }

  const confirm = async () => {
    if (!img) return
    const scale = baseScale(img) * view.zoom
    const side = VIEW / scale // lado del recorte en píxeles de la imagen original
    const output = Math.max(1, Math.round(Math.min(side, MAX_OUTPUT)))
    const canvas = document.createElement('canvas')
    canvas.width = output
    canvas.height = output
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, -view.x / scale, -view.y / scale, side, side, 0, 0, output, output)
    setSaving(true)
    try {
      await onConfirm(canvas.toDataURL('image/png'))
    } finally {
      setSaving(false)
    }
  }

  const scale = img ? baseScale(img) * view.zoom : 1

  return (
    <Modal
      title="Encuadrar imagen"
      description="Arrastra la imagen para elegir la parte que quieres y usa la barra o la rueda del ratón para acercarla."
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={confirm} disabled={!img || saving}>
            {saving ? 'Guardando…' : 'Usar este recorte'}
          </button>
        </>
      }
    >
      <div className="crop-stage">
        <div
          ref={frameRef}
          className={`crop-frame crop-frame-${shape}`}
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={img ? startDrag : undefined}
        >
          {img && (
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{
                width: img.naturalWidth * scale,
                height: img.naturalHeight * scale,
                transform: `translate(${view.x}px, ${view.y}px)`
              }}
            />
          )}
          {failed && <p className="crop-error">No se pudo cargar la imagen.</p>}
        </div>
        <div className="crop-zoom">
          <ZoomOut size={16} />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            onChange={(e) => zoomTo(Number(e.target.value))}
            disabled={!img}
            aria-label="Zoom"
          />
          <ZoomIn size={16} />
        </div>
      </div>
    </Modal>
  )
}

/** Escala a la que la imagen cubre justo el marco (zoom 1). */
function baseScale(img: HTMLImageElement): number {
  return Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight)
}
