/**
 * "Manuscrito": el proyecto completo con el texto de todos sus capítulos ya
 * cargado. Es la entrada común de todos los exportadores.
 */
import { manuscriptChapters } from '@shared/manuscript'
import type { Id, RichTextNode } from '@shared/types'
import type { ProjectRepository } from '../storage/ProjectRepository'

export interface Manuscript {
  title: string
  genre: string
  description: string
  chapters: { title: string; doc: RichTextNode }[]
}

/**
 * Sin `chapterIds`: el manuscrito (todos los capítulos menos los borradores).
 * Con `chapterIds`: solo esos capítulos, en el orden de la historia (también
 * borradores, si se eligen).
 */
export async function loadManuscript(repository: ProjectRepository, projectId: Id, chapterIds?: Id[]): Promise<Manuscript> {
  const project = await repository.getProject(projectId)
  const selected = chapterIds
    ? project.chapters.filter((c) => chapterIds.includes(c.id))
    : manuscriptChapters(project.chapters)
  if (chapterIds && selected.length === 0) throw new Error('Elige al menos un capítulo para exportar')
  const chapters = await Promise.all(
    selected.map(async (chapter) => ({
      title: chapter.title,
      doc: await repository.getChapterContent(projectId, chapter.id)
    }))
  )
  return { title: project.title, genre: project.genre, description: project.description, chapters }
}
