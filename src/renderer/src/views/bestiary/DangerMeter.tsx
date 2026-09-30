import { Skull } from 'lucide-react'
import type { DangerLevel } from '@shared/types'
import { DANGER_LABELS, DANGER_LEVELS } from './bestiaryOptions'
import './bestiary.css'

interface DangerMeterProps {
  level: DangerLevel
  /** Si se indica, las calaveras son botones para cambiar el nivel. */
  onChange?: (level: DangerLevel) => void
  /** Versión pequeña para listas. */
  compact?: boolean
}

/**
 * Peligrosidad de 1 a 5 calaveras, siempre acompañada de su etiqueta (en la
 * versión compacta, como tooltip) para no depender solo del color.
 */
export function DangerMeter({ level, onChange, compact = false }: DangerMeterProps) {
  const size = compact ? 11 : 18
  return (
    <span
      className={`danger-meter ${compact ? 'is-compact' : ''}`}
      title={`Peligrosidad: ${DANGER_LABELS[level]}`}
      role={onChange ? 'radiogroup' : 'img'}
      aria-label={`Peligrosidad: ${DANGER_LABELS[level]}`}
    >
      {DANGER_LEVELS.map((value) => {
        const filled = value <= level
        const icon = <Skull size={size} className={filled ? 'is-filled' : ''} />
        return onChange ? (
          <button
            key={value}
            type="button"
            className="danger-skull"
            onClick={() => onChange(value)}
            role="radio"
            aria-checked={value === level}
            aria-label={DANGER_LABELS[value]}
            title={DANGER_LABELS[value]}
          >
            {icon}
          </button>
        ) : (
          <span key={value}>{icon}</span>
        )
      })}
      {!compact && <span className="danger-label">{DANGER_LABELS[level]}</span>}
    </span>
  )
}
