/**
 * Sección "Cubierta": diseña la cubierta del libro y mírala en 3D, como
 * quedaría impresa. El diseño se guarda en `project.cover`; el frente también
 * aparece en la biblioteca y en las tarjetas para redes.
 */
import { useState, type DragEvent } from 'react'
import { BookImage, Contrast, Download, ImagePlus, Trash2 } from 'lucide-react'
import { assetUrl } from '@shared/assets'
import { COVER_FONT_INFO, COVER_TEMPLATE_INFO, estimatedPages, spineThicknessCm } from '@shared/cover'
import { manuscriptWordCount } from '@shared/manuscript'
import { COVER_FONTS, COVER_TEMPLATES, type CoverDesign, type CoverFace, type Project } from '@shared/types'
import { SaveBadge } from '@renderer/components/SaveBadge'
import { useToast } from '@renderer/components/Toasts'
import { useDebouncedSave } from '@renderer/hooks/useDebouncedSave'
import { api, errorMessage } from '@renderer/lib/api'
import { renderFrontCoverPng } from '@renderer/lib/coverRender'
import { Book3D, VIEWS, type BookRotation } from './Book3D'
import './cover.css'

type FaceKey = 'front' | 'spine' | 'back'
const FACES: { key: FaceKey; label: string; hint: string }[] = [
  { key: 'front', label: 'Frente', hint: 'Lo primero que se ve del libro' },
  { key: 'spine', label: 'Lomo', hint: 'Se ve en la estantería' },
  { key: 'back', label: 'Trasera', hint: 'Detrás de la sinopsis' }
]

interface CoverViewProps {
  project: Project
  onProjectChange: (project: Project) => void
}

export function CoverView({ project, onProjectChange }: CoverViewProps) {
  const [cover, setCover] = useState<CoverDesign>(project.cover)
  const [rotation, setRotation] = useState<BookRotation>(VIEWS.front)
  const [animate, setAnimate] = useState(false)
  const toast = useToast()
  const words = manuscriptWordCount(project.chapters)

  const { schedule, flush, status } = useDebouncedSave(async (next: CoverDesign) => {
    onProjectChange(await api.projects.update(project.id, { cover: next }))
  }, 500)

  const change = (patch: Partial<CoverDesign>, saveNow = false) => {
    const next = { ...cover, ...patch }
    setCover(next)
    schedule(next)
    if (saveNow) void flush()
  }
  const changeFace = (key: FaceKey, patch: Partial<CoverFace>, saveNow = false) => change({ [key]: { ...cover[key], ...patch } }, saveNow)

  const showView = (key: FaceKey) => {
    setAnimate(true)
    setRotation(VIEWS[key])
    setTimeout(() => setAnimate(false), 700)
  }

  const pickFor = async (key: FaceKey) => {
    try {
      const file = await api.assets.pickImage(project.id)
      if (file) changeFace(key, { image: file }, true)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const dropOn = async (key: FaceKey, e: DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    try {
      const name = await api.assets.importFile(project.id, api.files.pathOf(file))
      changeFace(key, { image: name }, true)
    } catch (error) {
      toast.error(`No se pudo usar ese archivo: ${errorMessage(error)}`)
    }
  }

  const download = async () => {
    try {
      await flush()
      const result = await api.files.savePng(await renderFrontCoverPng(cover, project.id), `Cubierta - ${cover.title || project.title}`)
      if (result.status === 'saved') toast.success(`Cubierta guardada en ${result.filePath}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="cover-studio">
      <header className="timeline-header">
        <h2>
          <BookImage size={18} /> Diseño de cubierta
        </h2>
        <SaveBadge status={status} />
        <div className="spacer" />
        <button className="btn btn-sm btn-primary" onClick={download}>
          <Download size={15} /> Exportar el frente (PNG)
        </button>
      </header>

      <div className="cover-body">
        <section className="cover-preview">
          <div className={animate ? 'book-animate' : ''}>
            <Book3D cover={cover} projectId={project.id} spineCm={spineThicknessCm(words)} rotation={rotation} onRotationChange={setRotation} />
          </div>
          <div className="segmented cover-views" role="group" aria-label="Ver cara">
            {FACES.map(({ key, label }) => (
              <button key={key} onClick={() => showView(key)}>
                {label}
              </button>
            ))}
          </div>
          <p className="faint cover-hint">
            Gira el libro arrastrándolo con el ratón · 15,24 × 22,86 cm · unas {estimatedPages(words)} páginas · lomo de{' '}
            {spineThicknessCm(words).toFixed(1).replace('.', ',')} cm según lo escrito
          </p>
        </section>

        <aside className="cover-controls">
          <section className="cover-panel">
            <h3>Textos</h3>
            <div className="cover-fields">
              <label>
                Título
                <input className="input" value={cover.title} onChange={(e) => change({ title: e.target.value })} />
              </label>
              <label>
                Subtítulo
                <input className="input" value={cover.subtitle} onChange={(e) => change({ subtitle: e.target.value })} placeholder="Opcional" />
              </label>
              <label>
                Firma
                <input className="input" value={cover.author} onChange={(e) => change({ author: e.target.value })} placeholder="Nombre o seudónimo" />
              </label>
              <label className="is-stacked">
                Sinopsis de la trasera
                <textarea
                  className="textarea"
                  rows={4}
                  value={cover.backText}
                  onChange={(e) => change({ backText: e.target.value })}
                  placeholder="Unas líneas que hagan querer abrir el libro…"
                />
              </label>
            </div>
          </section>

          <section className="cover-panel">
            <h3>
              <ImagePlus size={14} /> Ilustraciones
            </h3>
            <p className="field-hint">
              Haz clic en una miniatura o suelta una imagen sobre ella. Con «Contraste» la ilustración se oscurece y las letras destacan más.
            </p>
            <div className="cover-art-list">
              {FACES.map(({ key, label, hint }) => {
                const face = cover[key]
                return (
                  <div key={key} className="cover-art-row">
                    <button
                      className={`cover-art-thumb ${face.image ? 'has-image' : ''}`}
                      onClick={() => pickFor(key)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => dropOn(key, e)}
                      title={face.image ? 'Cambiar ilustración' : 'Elegir ilustración'}
                    >
                      {face.image ? <img src={assetUrl(project.id, face.image)} alt="" /> : <ImagePlus size={18} />}
                    </button>
                    <div className="cover-art-info">
                      <strong>{label}</strong>
                      <small className="faint">{hint}</small>
                      <label className="cover-art-contrast" title="Contraste">
                        <Contrast size={13} />
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={face.dim}
                          onChange={(e) => changeFace(key, { dim: Number(e.target.value) })}
                          aria-label={`Contraste de ${label.toLowerCase()}`}
                          disabled={!face.image}
                        />
                      </label>
                    </div>
                    {face.image && (
                      <button className="icon-btn" onClick={() => changeFace(key, { image: '' }, true)} title="Quitar ilustración">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="cover-panel">
            <h3>Estilo</h3>
            <div className="cover-schemes" role="radiogroup" aria-label="Combinación de colores">
              {COVER_TEMPLATES.map((key) => {
                const t = COVER_TEMPLATE_INFO[key]
                return (
                  <button
                    key={key}
                    role="radio"
                    aria-checked={cover.template === key}
                    className={`cover-scheme ${cover.template === key ? 'is-active' : ''}`}
                    onClick={() => change({ template: key })}
                  >
                    <span className="cover-scheme-dot" style={{ background: `linear-gradient(135deg, ${t.background[0]} 50%, ${t.accent} 50%)` }} />
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div className="cover-fields">
              <label>
                Letra
                <select className="select" value={cover.font} onChange={(e) => change({ font: e.target.value as CoverDesign['font'] })}>
                  {COVER_FONTS.map((key) => (
                    <option key={key} value={key} style={{ fontFamily: COVER_FONT_INFO[key].family }}>
                      {COVER_FONT_INFO[key].label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tamaño del título
                <input type="range" min={0.06} max={0.16} step={0.005} value={cover.titleSize} onChange={(e) => change({ titleSize: Number(e.target.value) })} />
              </label>
              <label>
                Altura del título
                <div className="segmented">
                  {(['top', 'center', 'bottom'] as const).map((pos) => (
                    <button key={pos} className={cover.titlePosition === pos ? 'is-active' : ''} onClick={() => change({ titlePosition: pos })}>
                      {{ top: 'Arriba', center: 'Centro', bottom: 'Abajo' }[pos]}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
