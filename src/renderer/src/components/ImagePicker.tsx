/**
 * Zona de imagen editable para las fichas: clic para elegir o cambiar la
 * imagen, botón para quitarla. La imagen se copia a la carpeta del proyecto.
 *
 * En las imágenes cuadradas (retratos, criaturas, razas…) se abre además el
 * recorte para encuadrarla. Por defecto se guarda solo el recorte; si se pasa
 * `onFullImageChange`, se conserva también el original: la miniatura es el
 * recorte y al hacer clic se ve la imagen completa (cambiarla pasa a un
 * botón). Cada nuevo encuadre parte del original.
 */
import { useState, type ReactNode } from 'react'
import { Crop, ImagePlus, Maximize2, X } from 'lucide-react'
import { assetUrl } from '@shared/assets'
import type { AssetFileName, Id } from '@shared/types'
import { api, errorMessage } from '@renderer/lib/api'
import { ImageCropDialog } from './ImageCropDialog'
import { ImageViewer } from './ImageViewer'
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
  /** Original sin recortar ('' = no hay). Solo con `onFullImageChange`. */
  fullImage?: AssetFileName
  /** Conserva el original al recortar y permite verlo entero. */
  onFullImageChange?: (image: AssetFileName) => void
}

/** Imagen que se está recortando y si es una recién elegida (que se descarta si no se usa). */
interface Cropping {
  file: AssetFileName
  fresh: boolean
}

export function ImagePicker({ projectId, image, onChange, variant, fallback, color, fullImage = '', onFullImageChange }: ImagePickerProps) {
  const [busy, setBusy] = useState(false)
  const [cropping, setCropping] = useState<Cropping | null>(null)
  const [viewing, setViewing] = useState(false)
  const toast = useToast()
  const croppable = variant !== 'banner'
  const keepsOriginal = Boolean(onFullImageChange)
  /** Con original guardado, el clic en la imagen la abre entera en vez de cambiarla. */
  const clickViews = keepsOriginal && Boolean(image)

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

  /** Cierra el recorte sin usarlo: el original recién elegido ya no hace falta. */
  const cancelCrop = (current: Cropping) => {
    setCropping(null)
    if (current.fresh) void api.assets.discard(projectId, current.file).catch(() => undefined)
  }

  const saveCrop = async (current: Cropping, dataUrl: string) => {
    try {
      const cropped = await api.assets.saveImage(projectId, dataUrl)
      setCropping(null)
      if (keepsOriginal) {
        // El original va junto al recorte: `onChange` guarda ambos a la vez.
        if (current.fresh) onFullImageChange!(current.file)
        onChange(cropped)
      } else {
        onChange(cropped)
        if (current.fresh) void api.assets.discard(projectId, current.file).catch(() => undefined)
      }
    } catch (error) {
      toast.error(`No se pudo guardar el recorte: ${errorMessage(error)}`)
    }
  }

  const remove = () => {
    if (keepsOriginal) onFullImageChange!('')
    onChange('')
  }

  return (
    <div className={`image-picker image-picker-${variant} ${image ? 'has-image' : ''}`}>
      <button
        type="button"
        className="image-picker-button"
        onClick={clickViews ? () => setViewing(true) : choose}
        disabled={busy}
        style={image ? undefined : { background: color }}
        title={clickViews ? 'Ver imagen completa' : image ? 'Cambiar imagen' : 'Añadir imagen'}
      >
        {image ? <img src={assetUrl(projectId, image)} alt="" draggable={false} /> : fallback}
        <span className="image-picker-overlay">
          {clickViews ? <Maximize2 size={16} /> : <ImagePlus size={variant === 'banner' ? 18 : 16} />}
          {variant === 'banner' && (image ? 'Cambiar ilustración' : 'Añadir ilustración')}
        </span>
      </button>
      {clickViews && (
        <button type="button" className="image-picker-change" onClick={choose} disabled={busy} title="Cambiar imagen">
          <ImagePlus size={13} />
        </button>
      )}
      {image && croppable && (
        <button
          type="button"
          className="image-picker-crop"
          onClick={() => setCropping({ file: (keepsOriginal && fullImage) || image, fresh: false })}
          title="Encuadrar imagen"
        >
          <Crop size={13} />
        </button>
      )}
      {image && (
        <button type="button" className="image-picker-remove" onClick={remove} title="Quitar imagen">
          <X size={13} />
        </button>
      )}

      {cropping && (
        <ImageCropDialog
          projectId={projectId}
          image={cropping.file}
          shape={variant === 'portrait' ? 'circle' : 'square'}
          onCancel={() => cancelCrop(cropping)}
          onConfirm={(dataUrl) => saveCrop(cropping, dataUrl)}
        />
      )}

      {viewing && image && <ImageViewer projectId={projectId} image={fullImage || image} onClose={() => setViewing(false)} />}
    </div>
  )
}
