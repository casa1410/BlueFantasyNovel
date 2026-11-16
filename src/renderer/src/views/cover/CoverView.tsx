/**
 * Sección "Cubierta": diseña la cubierta del libro y mírala en 3D, como
 * quedaría impresa. El diseño se guarda en `project.cover`; el frente también
 * aparece en la biblioteca y en las tarjetas para redes.
 *
 * Colección: se pueden añadir más tomos (solo su cubierta y sus páginas) y
 * verlos todos juntos en una estantería.
 */
import { useState, type DragEvent } from 'react'
import { ArrowDown, ArrowUp, BookImage, Contrast, Download, ImagePlus, Library, Plus, Trash2 } from 'lucide-react'
import { assetUrl } from '@shared/assets'
import {
  BOOK_HEIGHT_CM,
  BOOK_WIDTH_CM,
  bookPages,
  COVER_FONT_INFO,
  COVER_TEMPLATE_INFO,
  defaultBook,
  estimatedPages,
  MAX_PAGES,
  MAX_VOLUMES,
  spineCmForPages
} from '@shared/cover'
import { manuscriptWordCount } from '@shared/manuscript'
import { COVER_FONTS, COVER_TEMPLATES, type CoverBook, type CoverDesign, type CoverFace, type Project } from '@shared/types'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
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

/** Libro de esta historia (los tomos añadidos usan su propio id). */
const MAIN = 'main'
/** Ángulos de la estantería: casi de lado (lomos) o casi de frente. */
const SHELF_VIEWS: Record<'spines' | 'fronts', BookRotation> = {
  spines: { x: -4, y: 90 },
  fronts: { x: -4, y: 16 }
}
const SHELF_HEIGHT = 280

interface ShelfBook {
  id: string
  book: CoverBook
}

/** Libros en el orden de la estantería: los tomos añadidos con esta historia en su sitio. */
function shelfOrder(cover: CoverDesign): ShelfBook[] {
  const list: ShelfBook[] = cover.volumes.map((v) => ({ id: v.id, book: v }))
  list.splice(Math.min(cover.shelfPosition, list.length), 0, { id: MAIN, book: cover })
  return list
}

/** Nombre corto de un libro en la lista de la colección. */
function bookName(book: CoverBook): string {
  const title = book.title.trim() || 'Sin título'
  return book.volumeLabel.trim() ? `${book.volumeLabel.trim()} · ${title}` : title
}

/** Muestra de color de una plantilla. */
function schemeDot(book: CoverBook) {
  const t = COVER_TEMPLATE_INFO[book.template]
  return { background: `linear-gradient(135deg, ${t.background[0]} 50%, ${t.accent} 50%)` }
}

interface CoverViewProps {
  project: Project
  onProjectChange: (project: Project) => void
}

export function CoverView({ project, onProjectChange }: CoverViewProps) {
  const [cover, setCover] = useState<CoverDesign>(project.cover)
  const [selectedId, setSelectedId] = useState<string>(MAIN)
  const [mode, setMode] = useState<'book' | 'shelf'>('book')
  const [shelfSide, setShelfSide] = useState<'spines' | 'fronts'>('spines')
  const [rotation, setRotation] = useState<BookRotation>(VIEWS.front)
  const [animate, setAnimate] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ShelfBook | null>(null)
  const toast = useToast()
  const words = manuscriptWordCount(project.chapters)

  const shelf = shelfOrder(cover)
  const selected = shelf.find((b) => b.id === selectedId) ?? shelf.find((b) => b.id === MAIN)!
  const book = selected.book
  const isMain = selected.id === MAIN
  const pagesOf = (id: string, b: CoverBook) => (id === MAIN ? bookPages(b, words) : Math.max(1, b.pages))
  const pages = pagesOf(selected.id, book)

  const { schedule, flush, status } = useDebouncedSave(async (next: CoverDesign) => {
    onProjectChange(await api.projects.update(project.id, { cover: next }))
  }, 500)

  const save = (next: CoverDesign, saveNow = false) => {
    setCover(next)
    schedule(next)
    if (saveNow) void flush()
  }
  /** Cambia el libro seleccionado (el de la historia o un tomo). */
  const changeBook = (patch: Partial<CoverBook>, saveNow = false) => {
    if (isMain) save({ ...cover, ...patch }, saveNow)
    else save({ ...cover, volumes: cover.volumes.map((v) => (v.id === selected.id ? { ...v, ...patch } : v)) }, saveNow)
  }
  const changeFace = (key: FaceKey, patch: Partial<CoverFace>, saveNow = false) => changeBook({ [key]: { ...book[key], ...patch } }, saveNow)

  /** Guarda un nuevo orden de la estantería. */
  const saveOrder = (list: ShelfBook[]) => {
    const volumes = list.filter((b) => b.id !== MAIN).map((b) => cover.volumes.find((v) => v.id === b.id)!)
    save({ ...cover, volumes, shelfPosition: list.findIndex((b) => b.id === MAIN) }, true)
  }
  const move = (index: number, step: number) => {
    const target = index + step
    if (target < 0 || target >= shelf.length) return
    const list = [...shelf]
    ;[list[index], list[target]] = [list[target], list[index]]
    saveOrder(list)
  }
  const addVolume = () => {
    if (cover.volumes.length >= MAX_VOLUMES) return
    const id = crypto.randomUUID()
    // Mismo estilo y firma que esta historia, para que la colección case.
    const volume = {
      ...defaultBook(''),
      template: cover.template,
      font: cover.font,
      titleSize: cover.titleSize,
      titlePosition: cover.titlePosition,
      author: cover.author,
      pages: bookPages(cover, words),
      volumeLabel: String(shelf.length + 1),
      id
    }
    save({ ...cover, volumes: [...cover.volumes, volume] }, true)
    setSelectedId(id)
  }
  const removeVolume = (id: string) => {
    const list = shelf.filter((b) => b.id !== id)
    const volumes = cover.volumes.filter((v) => v.id !== id)
    save({ ...cover, volumes, shelfPosition: list.findIndex((b) => b.id === MAIN) }, true)
    if (selectedId === id) setSelectedId(MAIN)
  }

  const animateTo = (apply: () => void) => {
    setAnimate(true)
    apply()
    setTimeout(() => setAnimate(false), 700)
  }
  const showView = (key: FaceKey) => animateTo(() => setRotation(VIEWS[key]))

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
      const result = await api.files.savePng(await renderFrontCoverPng(book, project.id), `Cubierta - ${book.title || project.title}`)
      if (result.status === 'saved') toast.success(`Cubierta guardada en ${result.filePath}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const cm = (value: number) => value.toFixed(1).replace('.', ',')

  return (
    <div className="cover-studio">
      <header className="timeline-header">
        <h2>
          <BookImage size={18} /> Diseño de cubierta
        </h2>
        <SaveBadge status={status} />
        <div className="spacer" />
        <div className="segmented cover-mode" role="group" aria-label="Vista">
          <button className={mode === 'book' ? 'is-active' : ''} onClick={() => setMode('book')}>
            <BookImage size={14} /> Libro
          </button>
          <button className={mode === 'shelf' ? 'is-active' : ''} onClick={() => setMode('shelf')}>
            <Library size={14} /> Estantería
          </button>
        </div>
        <button className="btn btn-sm btn-primary" onClick={download} title="Exporta el frente del libro seleccionado">
          <Download size={15} /> Exportar el frente (PNG)
        </button>
      </header>

      <div className="cover-body">
        {mode === 'book' ? (
          <section className="cover-preview">
            <div className={animate ? 'book-animate' : ''}>
              <Book3D cover={book} projectId={project.id} spineCm={spineCmForPages(pages)} rotation={rotation} onRotationChange={setRotation} />
            </div>
            <div className="segmented cover-views" role="group" aria-label="Ver cara">
              {FACES.map(({ key, label }) => (
                <button key={key} onClick={() => showView(key)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="faint cover-hint">
              Gira el libro arrastrándolo con el ratón · 15,24 × 22,86 cm · {pages} páginas · lomo de {cm(spineCmForPages(pages))} cm
              {isMain && book.pages === 0 ? ' según lo escrito' : ''}
            </p>
          </section>
        ) : (
          <section className="cover-preview">
            <div className={`cover-shelf ${animate ? 'book-animate' : ''}`}>
              <div className="cover-shelf-books">
                {shelf.map(({ id, book: b }) => {
                  const bPages = pagesOf(id, b)
                  const spineCm = spineCmForPages(bPages)
                  const view = SHELF_VIEWS[shelfSide]
                  const angle = (view.y * Math.PI) / 180
                  const W = (SHELF_HEIGHT * BOOK_WIDTH_CM) / BOOK_HEIGHT_CM
                  const D = Math.max(6, (SHELF_HEIGHT * spineCm) / BOOK_HEIGHT_CM)
                  // Ancho que ocupa el libro girado: así quedan juntos, como en una balda.
                  const width = Math.abs(W * Math.cos(angle)) + Math.abs(D * Math.sin(angle)) + 6
                  return (
                    <button
                      key={id}
                      className={`cover-shelf-book ${id === selected.id ? 'is-selected' : ''}`}
                      style={{ width }}
                      onClick={() => setSelectedId(id)}
                      onDoubleClick={() => {
                        setSelectedId(id)
                        setMode('book')
                      }}
                      title={`${bookName(b)} · ${bPages} páginas`}
                    >
                      <Book3D
                        cover={b}
                        projectId={project.id}
                        spineCm={spineCm}
                        rotation={view}
                        onRotationChange={() => undefined}
                        height={SHELF_HEIGHT}
                        interactive={false}
                      />
                    </button>
                  )
                })}
              </div>
              <div className="cover-shelf-plank" />
            </div>
            <div className="segmented cover-views" role="group" aria-label="Lado de los libros">
              <button className={shelfSide === 'spines' ? 'is-active' : ''} onClick={() => animateTo(() => setShelfSide('spines'))}>
                Lomos
              </button>
              <button className={shelfSide === 'fronts' ? 'is-active' : ''} onClick={() => animateTo(() => setShelfSide('fronts'))}>
                Frentes
              </button>
            </div>
            <p className="faint cover-hint">
              Clic en un libro para editarlo a la derecha · doble clic para verlo de cerca
              {shelf.length === 1 ? ' · añade tomos en el panel «Colección»' : ` · ${shelf.length} libros`}
            </p>
          </section>
        )}

        <aside className="cover-controls">
          <section className="cover-panel">
            <h3>
              <Library size={14} /> Colección
            </h3>
            <div className="cover-collection">
              {shelf.map(({ id, book: b }, index) => (
                <div key={id} className={`cover-collection-row ${id === selected.id ? 'is-selected' : ''}`}>
                  <button className="cover-collection-name" onClick={() => setSelectedId(id)} title="Editar este libro">
                    <span className="cover-scheme-dot" style={schemeDot(b)} />
                    <span className="cover-collection-title">
                      {bookName(b)}
                      {id === MAIN && <small className="faint"> · esta historia</small>}
                    </span>
                  </button>
                  <button className="icon-btn" onClick={() => move(index, -1)} disabled={index === 0} title="Antes en la estantería">
                    <ArrowUp size={13} />
                  </button>
                  <button className="icon-btn" onClick={() => move(index, 1)} disabled={index === shelf.length - 1} title="Después en la estantería">
                    <ArrowDown size={13} />
                  </button>
                  {id !== MAIN && (
                    <button className="icon-btn" onClick={() => setPendingDelete({ id, book: b })} title="Quitar este tomo">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn btn-sm" onClick={addVolume} disabled={cover.volumes.length >= MAX_VOLUMES}>
              <Plus size={14} /> Añadir tomo
            </button>
            {shelf.length > 1 && <p className="field-hint">Los tomos añadidos son solo cubiertas para ver la colección: no tienen capítulos.</p>}
          </section>

          <section className="cover-panel">
            <h3>Páginas y lomo{isMain ? '' : ` · ${bookName(book)}`}</h3>
            <div className="cover-fields">
              {isMain && (
                <label className="cover-check">
                  <input type="checkbox" checked={book.pages === 0} onChange={(e) => changeBook({ pages: e.target.checked ? 0 : estimatedPages(words) })} />
                  Calcular según lo escrito (unas {estimatedPages(words)} páginas)
                </label>
              )}
              {(!isMain || book.pages > 0) && (
                <label>
                  Páginas
                  <div className="cover-pages">
                    <input
                      type="range"
                      min={24}
                      max={1200}
                      step={2}
                      value={Math.min(1200, pages)}
                      onChange={(e) => changeBook({ pages: Number(e.target.value) })}
                      aria-label="Páginas"
                    />
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={MAX_PAGES}
                      value={pages}
                      onChange={(e) => {
                        const value = Math.round(Number(e.target.value))
                        if (Number.isFinite(value) && value > 0) changeBook({ pages: Math.min(MAX_PAGES, value) })
                      }}
                      aria-label="Número de páginas"
                    />
                  </div>
                </label>
              )}
              <p className="field-hint">
                Lomo de {cm(spineCmForPages(pages))} cm con {pages} páginas (papel de 80 g).
              </p>
              <label>
                Número en el lomo
                <input
                  className="input"
                  value={book.volumeLabel}
                  maxLength={30}
                  onChange={(e) => changeBook({ volumeLabel: e.target.value })}
                  placeholder="Opcional: 1, I, Libro uno…"
                />
              </label>
            </div>
          </section>

          <section className="cover-panel">
            <h3>Textos</h3>
            <div className="cover-fields">
              <label>
                Título
                <input className="input" value={book.title} onChange={(e) => changeBook({ title: e.target.value })} />
              </label>
              <label>
                Subtítulo
                <input className="input" value={book.subtitle} onChange={(e) => changeBook({ subtitle: e.target.value })} placeholder="Opcional" />
              </label>
              <label>
                Firma
                <input className="input" value={book.author} onChange={(e) => changeBook({ author: e.target.value })} placeholder="Nombre o seudónimo" />
              </label>
              <label className="is-stacked">
                Sinopsis de la trasera
                <textarea
                  className="textarea"
                  rows={4}
                  value={book.backText}
                  onChange={(e) => changeBook({ backText: e.target.value })}
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
                const face = book[key]
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
                    aria-checked={book.template === key}
                    className={`cover-scheme ${book.template === key ? 'is-active' : ''}`}
                    onClick={() => changeBook({ template: key })}
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
                <select className="select" value={book.font} onChange={(e) => changeBook({ font: e.target.value as CoverDesign['font'] })}>
                  {COVER_FONTS.map((key) => (
                    <option key={key} value={key} style={{ fontFamily: COVER_FONT_INFO[key].family }}>
                      {COVER_FONT_INFO[key].label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tamaño del título
                <input type="range" min={0.06} max={0.16} step={0.005} value={book.titleSize} onChange={(e) => changeBook({ titleSize: Number(e.target.value) })} />
              </label>
              <label>
                Altura del título
                <div className="segmented">
                  {(['top', 'center', 'bottom'] as const).map((pos) => (
                    <button key={pos} className={book.titlePosition === pos ? 'is-active' : ''} onClick={() => changeBook({ titlePosition: pos })}>
                      {{ top: 'Arriba', center: 'Centro', bottom: 'Abajo' }[pos]}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </section>
        </aside>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Quitar tomo"
          message={`Se quitará «${bookName(pendingDelete.book)}» de la colección, con sus ilustraciones. Esta historia no cambia.`}
          confirmLabel="Quitar tomo"
          destructive
          onConfirm={() => removeVolume(pendingDelete.id)}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
