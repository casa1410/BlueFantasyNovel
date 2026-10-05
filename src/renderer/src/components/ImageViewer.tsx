/**
 * Visor a pantalla grande de una imagen del proyecto. Se cierra con Escape,
 * con el botón o haciendo clic fuera de la imagen.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { assetUrl } from '@shared/assets'
import type { AssetFileName, Id } from '@shared/types'
import './imageViewer.css'

interface ImageViewerProps {
  projectId: Id
  image: AssetFileName
  onClose: () => void
}

export function ImageViewer({ projectId, image, onClose }: ImageViewerProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="image-viewer" role="dialog" aria-modal="true" aria-label="Imagen completa" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <img src={assetUrl(projectId, image)} alt="" draggable={false} />
      <button className="image-viewer-close" onClick={onClose} title="Cerrar (Esc)">
        <X size={18} />
      </button>
    </div>,
    document.body
  )
}
