/**
 * Selector de color libre: un botón con el arcoíris que abre un mapa de
 * color (saturación × brillo), una barra de tono y un campo hex.
 *
 * Trabaja con colores hex (#rrggbb), el formato de los datos.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import './colorPicker.css'

interface ColorPickerProps {
  value: string
  onChange: (hex: string) => void
  /** Se muestra como seleccionado (el color actual no es de la paleta). */
  active?: boolean
}

interface Hsv {
  h: number
  s: number
  v: number
}

export function ColorPicker({ value, onChange, active }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="color-picker" ref={rootRef}>
      <button
        type="button"
        className={`color-swatch color-picker-trigger ${active ? 'is-active' : ''}`}
        style={active ? { background: value } : undefined}
        onClick={() => setOpen((o) => !o)}
        title="Elegir otro color"
        aria-label="Elegir otro color"
        aria-expanded={open}
      />
      {open && <ColorPanel value={value} onChange={onChange} />}
    </div>
  )
}

function ColorPanel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  // El tono se guarda aparte: con blanco, negro o grises el hex no lo conserva.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) ?? { h: 220, s: 0.65, v: 1 })
  const [text, setText] = useState(value)

  const apply = (next: Hsv) => {
    setHsv(next)
    const hex = hsvToHex(next)
    setText(hex)
    onChange(hex)
  }

  const dragOn = (element: HTMLElement, e: ReactPointerEvent, move: (x: number, y: number) => void) => {
    element.setPointerCapture(e.pointerId)
    const handle = (ev: { clientX: number; clientY: number }) => {
      const rect = element.getBoundingClientRect()
      move(clamp((ev.clientX - rect.left) / rect.width), clamp((ev.clientY - rect.top) / rect.height))
    }
    handle(e)
    const onMove = (ev: PointerEvent) => handle(ev)
    const onUp = () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
  }

  return (
    <div className="color-panel" role="dialog" aria-label="Elegir color">
      <div
        className="color-panel-map"
        style={{ background: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(e) => dragOn(e.currentTarget, e, (x, y) => apply({ ...hsv, s: x, v: 1 - y }))}
      >
        <span className="color-panel-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }} />
      </div>
      <div className="color-panel-hue" onPointerDown={(e) => dragOn(e.currentTarget, e, (x) => apply({ ...hsv, h: x * 360 }))}>
        <span className="color-panel-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, top: '50%', background: `hsl(${hsv.h} 100% 50%)` }} />
      </div>
      <div className="color-panel-row">
        <span className="color-panel-preview" style={{ background: hsvToHex(hsv) }} />
        <input
          className="input color-panel-hex"
          value={text}
          spellCheck={false}
          maxLength={7}
          aria-label="Código de color"
          onChange={(e) => {
            const raw = e.target.value.trim()
            setText(raw)
            const hex = normalizeHex(raw)
            if (hex) {
              setHsv(hexToHsv(hex) ?? hsv)
              onChange(hex)
            }
          }}
          onBlur={() => setText(hsvToHex(hsv))}
        />
      </div>
    </div>
  )
}

const clamp = (n: number) => Math.min(1, Math.max(0, n))

/** "#abc", "abc", "#aabbcc" o "aabbcc" → "#aabbcc"; cualquier otra cosa → null. */
function normalizeHex(raw: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw)
  if (!m) return null
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return `#${digits.toLowerCase()}`
}

function hexToHsv(raw: string): Hsv | null {
  const hex = normalizeHex(raw)
  if (!hex) return null
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  let h = 0
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max }
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`
}
