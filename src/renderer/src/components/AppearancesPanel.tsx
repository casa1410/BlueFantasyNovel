/**
 * "Apariciones": en qué capítulos se nombra una ficha (por su nombre o sus
 * alias) y cuántas veces. Clic en un capítulo para abrirlo.
 */
import { useEffect, useState } from 'react'
import { BookOpenText } from 'lucide-react'
import type { ChapterMeta, Id, MentionIndex } from '@shared/types'
import { api } from '@renderer/lib/api'
import { flushAll } from '@renderer/lib/pendingSaves'
import { plural } from '@renderer/lib/format'

interface AppearancesPanelProps {
  projectId: Id
  entityId: Id
  chapters: ChapterMeta[]
  onOpenChapter: (chapterId: Id) => void
}

export function AppearancesPanel({ projectId, entityId, chapters, onOpenChapter }: AppearancesPanelProps) {
  const [index, setIndex] = useState<MentionIndex | null>(null)

  useEffect(() => {
    let cancelled = false
    flushAll()
      .then(() => api.manuscript.mentions(projectId))
      .then((result) => !cancelled && setIndex(result))
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [projectId, entityId])

  if (!index) return null
  const entries = index[entityId] ?? []
  const total = entries.reduce((sum, e) => sum + e.count, 0)
  const titleOf = (id: Id) => chapters.find((c) => c.id === id)
  const position = (id: Id) => chapters.findIndex((c) => c.id === id)

  return (
    <section className="appearances">
      <h4>
        <BookOpenText size={14} /> Apariciones en el manuscrito
      </h4>
      {entries.length === 0 ? (
        <p className="faint">Todavía no se nombra en ningún capítulo. Añade alias si en el texto aparece con otro nombre.</p>
      ) : (
        <>
          <p className="faint">
            {plural(total, 'mención', 'menciones')} en {plural(entries.length, 'capítulo')}
          </p>
          <div className="appearances-list">
            {entries
              .filter((e) => titleOf(e.chapterId))
              .sort((a, b) => position(a.chapterId) - position(b.chapterId))
              .map((e) => (
                <button key={e.chapterId} className="appearance-chip" onClick={() => onOpenChapter(e.chapterId)}>
                  <span className="faint">{position(e.chapterId) + 1}.</span> {titleOf(e.chapterId)!.title}
                  <strong>{e.count}</strong>
                </button>
              ))}
          </div>
        </>
      )}
    </section>
  )
}
