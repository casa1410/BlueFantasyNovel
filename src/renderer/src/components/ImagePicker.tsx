/**
 * Zona de imagen editable para las fichas: clic para elegir o cambiar la
 * imagen, botón para quitarla. La imagen se copia a la carpeta del proyecto.
 */
import { useState, type ReactNode } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { assetUrl } from '@shared/assets'
import type { AssetFileName, Id } from '@shared/types'
import { api, errorMessage } from '@renderer/lib/api'
import { useToast } from './Toasts'

interface ImagePickerProps {
  projectId: Id
  image: AssetFileName
  onChange: (image: AssetFileName) => void
  /** portrait: círculo (personajes) · square: cuadrado (criaturas) · banner: franja ancha (lore). */
  variant: 'portrait' | 'square' | 'banner'
  /** Lo que se ve cuando no hay imagen. */
  fallback?: ReactNode
  color?: string
}

export function ImagePicker({ projectId, image, onChange, variant, fallback, color }: ImagePickerProps) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const choose = async () => {
    setBusy(true)
    try {
      const fileName = await api.assets.pickImage(projectId)
      if (fileName) onChange(fileName)
    } catch (error) {
      toast.error(`No se pudo añadir la imagen: ${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`image-picker image-picker-${variant} ${image ? 'has-image' : ''}`}>
      <button
        type="button"
        className="image-picker-button"
        onClick={choose}
        disabled={busy}
        style={image ? undefined : { background: color }}
        title={image ? 'Cambiar imagen' : 'Añadir imagen'}
      >
        {image ? <img src={assetUrl(projectId, image)} alt="" draggable={false} /> : fallback}
        <span className="image-picker-overlay">
          <ImagePlus size={variant === 'banner' ? 18 : 16} />
          {variant === 'banner' && (image ? 'Cambiar ilustración' : 'Añadir ilustración')}
        </span>
      </button>
      {image && (
        <button type="button" className="image-picker-remove" onClick={() => onChange('')} title="Quitar imagen">
          <X size={13} />
        </button>
      )}
    </div>
  )
}
