/**
 * Barras horizontales con las palabras de cada capítulo, en orden de lectura.
 * Sirve para detectar de un vistazo capítulos descompensados.
 */
import type { ChapterMeta } from '@shared/types'
import { useChartTooltip } from './ChartTooltip'

export function ChapterBars({ chapters }: { chapters: ChapterMeta[] }) {
  const tooltip = useChartTooltip()

  if (chapters.length === 0) return <p className="faint">Todavía no hay capítulos.</p>

  const max = Math.max(1, ...chapters.map((c) => c.wordCount))
  const average = Math.round(chapters.reduce((s, c) => s + c.wordCount, 0) / chapters.length)

  return (
    <div className="chapter-bars">
      {chapters.map((chapter, index) => (
        <div
          key={chapter.id}
          className="chapter-bar-row"
          onMouseEnter={(e) =>
            tooltip.show(
              e,
              <>
                <strong>{chapter.wordCount.toLocaleString('es-ES')} palabras</strong>
                <span>
                  {chapter.wordCount >= average ? '+' : ''}
                  {(chapter.wordCount - average).toLocaleString('es-ES')} respecto a la media
                </span>
              </>
            )
          }
          onMouseLeave={tooltip.hide}
        >
          <span className="chapter-bar-label" title={chapter.title}>
            <span className="faint">{index + 1}.</span> {chapter.title}
          </span>
          <div className="chapter-bar-track">
            <div className="chapter-bar-fill" style={{ width: `${(chapter.wordCount / max) * 100}%` }} />
          </div>
          <span className="chapter-bar-value">{chapter.wordCount.toLocaleString('es-ES')}</span>
        </div>
      ))}
      <p className="chapter-bars-footnote faint">Media: {average.toLocaleString('es-ES')} palabras por capítulo</p>
      {tooltip.element}
    </div>
  )
}
