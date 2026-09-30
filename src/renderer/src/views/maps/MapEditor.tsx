/**
 * Visor/editor de un mapa.
 *
 *  - Rueda: acercar/alejar (centrado en el cursor). Arrastrar: desplazar.
 *  - Modo "Añadir chincheta": clic en el mapa para colocar una.
 *  - Las chinchetas se pueden arrastrar; clic para editarlas en el panel.
 *
 * Las posiciones se guardan RELATIVAS a la imagen (0–1), así no dependen
 * del zoom ni del tamaño de la ventana.
 */
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { ImagePlus, Maximize, MapPin, MousePointer2, Trash2, X } from 'lucide-react'
import { assetUrl } from '@shared/assets'
import type { Id, MapPin as Pin, Project, WorldMap } from '@shared/types'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useToast } from '@renderer/components/Toasts'
import { useEntityForm } from '@renderer/hooks/useEntityForm'
import { api, errorMessage } from '@renderer/lib/api'

const PIN_COLORS = ['#e8577a', '#5b8cff', '#4fd1a5', '#e8c46a', '#8e5bff', '#f08a4b', '#ffffff']
/** Píxeles que hay que mover el ratón para que un clic cuente como arrastre. */
const DRAG_THRESHOLD = 4

interface View {
  x: number
  y: number
  zoom: number
}

interface MapEditorProps {
  project: Project
  map: WorldMap
  onProjectChange: (project: Project) => void
  onDelete: () => void
}

export function MapEditor({ project, map, onProjectChange, onDelete }: MapEditorProps) {
  const { draft, update, setImage, flush, status } = useEntityForm(project.id, 'maps', map, onProjectChange)
  const [addMode, setAddMode] = useState(false)
  const [selectedPinId, setSelectedPinId] = useState<Id | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  const pins = draft.pins
  const setPins = (next: Pin[]) => update('pins', next)
  const selectedPin = pins.find((p) => p.id === selectedPinId) ?? null

  const chooseImage = async () => {
    try {
      const file = await api.assets.pickImage(project.id)
      if (file) {
        setNatural(null)
        setImage(file)
      }
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  /** Encaja el mapa completo en la ventana. */
  const fit = useCallback(() => {
    const box = viewportRef.current
    if (!box || !natural) return
    const zoom = Math.min(box.clientWidth / natural.w, box.clientHeight / natural.h) * 0.95
    setView({ zoom, x: (box.clientWidth - natural.w * zoom) / 2, y: (box.clientHeight - natural.h * zoom) / 2 })
  }, [natural])
  useEffect(fit, [fit])

  // Zoom con la rueda (listener nativo no pasivo para poder cancelar el scroll).
  useEffect(() => {
    const box = viewportRef.current
    if (!box) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = box.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setView((v) => {
        const zoom = Math.min(8, Math.max(0.05, v.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
        const k = zoom / v.zoom
        return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
      })
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [draft.image])

  /** Posición del ratón relativa a la imagen (0–1). */
  const relativePoint = (clientX: number, clientY: number) => {
    const rect = viewportRef.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left - view.x) / (view.zoom * natural!.w))),
      y: Math.min(1, Math.max(0, (clientY - rect.top - view.y) / (view.zoom * natural!.h)))
    }
  }

  /** Arrastrar el fondo: desplazar el mapa (o colocar una chincheta si fue un clic). */
  const onBackgroundDown = (e: ReactMouseEvent) => {
    if (e.button !== 0 || !natural) return
    const start = { x: e.clientX, y: e.clientY, view }
    let moved = false
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      moved = true
      setView({ ...start.view, x: start.view.x + dx, y: start.view.y + dy })
    }
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (moved) return
      if (addMode) {
        const point = relativePoint(ev.clientX, ev.clientY)
        const pin: Pin = { id: crypto.randomUUID(), ...point, label: '', color: PIN_COLORS[0], loreId: null }
        setPins([...pins, pin])
        setSelectedPinId(pin.id)
        setAddMode(false)
      } else {
        setSelectedPinId(null)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  /** Arrastrar una chincheta (o seleccionarla si fue un clic). */
  const onPinDown = (e: ReactMouseEvent, pin: Pin) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const start = { x: e.clientX, y: e.clientY }
    let moved = false
    const onMove = (ev: MouseEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return
      moved = true
      const point = relativePoint(ev.clientX, ev.clientY)
      setPins(pins.map((p) => (p.id === pin.id ? { ...p, ...point } : p)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setSelectedPinId(pin.id)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const updatePin = (patch: Partial<Pin>) => setPins(pins.map((p) => (p.id === selectedPinId ? { ...p, ...patch } : p)))
  const pinLabel = (pin: Pin) => pin.label || project.lore.find((l) => l.id === pin.loreId)?.title || ''

  return (
    <div className="map-editor">
      <header className="map-header">
        <input
          className="entity-name-input map-name"
          value={draft.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Nombre del mapa"
          aria-label="Nombre del mapa"
        />
        <SaveBadge status={status} />
        {draft.image && (
          <>
            <button className={`btn btn-sm ${addMode ? 'btn-primary' : ''}`} onClick={() => setAddMode(!addMode)}>
              {addMode ? <MousePointer2 size={14} /> : <MapPin size={14} />}
              {addMode ? 'Haz clic en el mapa…' : 'Añadir chincheta'}
            </button>
            <button className="icon-btn" onClick={fit} title="Ver el mapa completo">
              <Maximize size={16} />
            </button>
            <button className="icon-btn" onClick={chooseImage} title="Cambiar imagen del mapa">
              <ImagePlus size={16} />
            </button>
          </>
        )}
        <button className="icon-btn map-delete" onClick={onDelete} title="Eliminar mapa">
          <Trash2 size={16} />
        </button>
      </header>

      <div className="map-body">
        {!draft.image ? (
          <div className="empty-state map-empty">
            <button className="map-upload" onClick={chooseImage}>
              <ImagePlus size={36} />
              <strong>Subir la imagen del mapa</strong>
              <span className="faint">PNG, JPG, WEBP o GIF. Cuanta más resolución, más podrás acercarte.</span>
            </button>
          </div>
        ) : (
          <div ref={viewportRef} className={`map-viewport ${addMode ? 'is-adding' : ''}`} onMouseDown={onBackgroundDown}>
            <div
              className="map-layer"
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
                width: natural?.w,
                height: natural?.h
              }}
            >
              <img
                src={assetUrl(project.id, draft.image)}
                alt=""
                draggable={false}
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              />
              {natural &&
                pins.map((pin) => (
                  <div
                    key={pin.id}
                    className={`map-pin ${pin.id === selectedPinId ? 'is-selected' : ''}`}
                    style={{ left: pin.x * natural.w, top: pin.y * natural.h, transform: `scale(${1 / view.zoom})` }}
                    onMouseDown={(e) => onPinDown(e, pin)}
                  >
                    <MapPin size={28} fill={pin.color} color="#0b1224" strokeWidth={1.5} />
                    {pinLabel(pin) && <span>{pinLabel(pin)}</span>}
                  </div>
                ))}
            </div>
          </div>
        )}

        {selectedPin && (
          <aside className="side-panel">
            <header>
              <h3>Chincheta</h3>
              <button className="icon-btn" onClick={() => setSelectedPinId(null)} title="Cerrar">
                <X size={16} />
              </button>
            </header>
            <label className="field">
              <span className="field-label">Lugar vinculado</span>
              <select className="select" value={selectedPin.loreId ?? ''} onChange={(e) => updatePin({ loreId: e.target.value || null })}>
                <option value="">Ninguno</option>
                {project.lore.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Etiqueta</span>
              <input
                className="input"
                value={selectedPin.label}
                onChange={(e) => updatePin({ label: e.target.value })}
                placeholder={project.lore.find((l) => l.id === selectedPin.loreId)?.title ?? 'Nombre del lugar'}
              />
            </label>
            <div className="field">
              <span className="field-label">Color</span>
              <div className="color-swatches">
                {PIN_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`color-swatch ${selectedPin.color === color ? 'is-active' : ''}`}
                    style={{ background: color }}
                    onClick={() => updatePin({ color })}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>
            {selectedPin.loreId && (
              <p className="faint">{project.lore.find((l) => l.id === selectedPin.loreId)?.summary}</p>
            )}
            <div className="relation-panel-footer">
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setPins(pins.filter((p) => p.id !== selectedPinId))
                  setSelectedPinId(null)
                  void flush()
                }}
              >
                <Trash2 size={14} /> Quitar chincheta
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
