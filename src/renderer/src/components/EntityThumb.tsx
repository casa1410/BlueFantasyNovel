import type { ReactNode } from 'react'
import { assetUrl } from '@shared/assets'
import type { AssetFileName, Id } from '@shared/types'

interface EntityThumbProps {
  projectId: Id
  image: AssetFileName
  /** Contenido si no hay imagen (iniciales, icono…). */
  fallback: ReactNode
  /** Color de fondo del fallback. */
  color?: string
  size?: number
  shape?: 'circle' | 'rounded'
}

/** Miniatura de una ficha: su imagen si la tiene, o un fallback de color. */
export function EntityThumb({ projectId, image, fallback, color, size = 34, shape = 'circle' }: EntityThumbProps) {
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.38),
    background: image ? undefined : (color ?? 'var(--surface-hover)')
  }
  return (
    <span className={`avatar ${shape === 'rounded' ? 'avatar-rounded' : ''}`} style={style}>
      {image ? <img src={assetUrl(projectId, image)} alt="" draggable={false} /> : fallback}
    </span>
  )
}
