/**
 * Zona de imagen editable para las fichas: clic para elegir o cambiar la
 * imagen, botón para quitarla. La imagen se copia a la carpeta del proyecto.
 *
 * En las imágenes cuadradas (retratos, criaturas, razas…) se abre además el
 * recorte para encuadrarla; se guarda solo el recorte, no el original.
 */
import { useState, type ReactNode } from 'react'
import { Crop, ImagePlus, X } from 'lucide-react'
import { assetUrl } from '@shared/assets'
import type { AssetFileName, Id } from '@shared/types'
import { api, errorMessage } from '@renderer/lib/api'
import { ImageCropDialog } from './ImageCropDialog'
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

/** Imagen que se está recortando y si es una recién elegida (que se descarta al terminar). */
interface Cropping {
  file: AssetFileName
  fresh: boolean
}

export function ImagePicker({ projectId, image, onChange, variant, fallback, color }: ImagePickerProps) {
  const [busy, setBusy] = useState(false)
  const [cropping, setCropping] = useState<Cropping | null>(null)
  const toast = useToast()
  const croppable = variant !== 'banner'

  const choose = async () => {
    setBusy(true)
    try {
      const fileName = await api.assets.pickImage(projectId)
      if (!fileName) return
      if (croppable) setCropping({ file: fileName, fresh: true })
      else onChange(fileName)
    } catch (error) {
      toast.error(`No se pudo añadir la imagen: ${errorMessage(error)}`)
    } finally {
      setBusy(false)
    }
  }

  /** Cierra el recorte; el original recién elegido ya no hace falta. */
  const finishCrop = (current: Cropping) => {
    setCropping(null)
    if (current.fresh) void api.assets.discard(projectId, current.file).catch(() => undefined)
  }

  const saveCrop = async (current: Cropping, dataUrl: string) => {
    try {
      onChange(await api.assets.saveImage(projectId, dataUrl))
      finishCrop(current)
    } catch (error) {
      toast.error(`No se pudo guardar el recorte: ${errorMessage(error)}`)
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
      {image && croppable && (
        <button type="button" className="image-picker-crop" onClick={() => setCropping({ file: image, fresh: false })} title="Encuadrar imagen">
          <Crop size={13} />
        </button>
      )}
      {image && (
        <button type="button" className="image-picker-remove" onClick={() => onChange('')} title="Quitar imagen">
          <X size={13} />
        </button>
      )}

      {cropping && (
        <ImageCropDialog
          projectId={projectId}
          image={cropping.file}
          shape={variant === 'portrait' ? 'circle' : 'square'}
          onCancel={() => finishCrop(cropping)}
          onConfirm={(dataUrl) => saveCrop(cropping, dataUrl)}
        />
      )}
    </div>
  )
}
