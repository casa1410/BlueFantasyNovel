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

export async function loadManuscript(repository: ProjectRepository, projectId: Id): Promise<Manuscript> {
  const project = await repository.getProject(projectId)
  const chapters = await Promise.all(
    // Los borradores no forman parte del manuscrito.
    manuscriptChapters(project.chapters).map(async (chapter) => ({
      title: chapter.title,
      doc: await repository.getChapterContent(projectId, chapter.id)
    }))
  )
  return { title: project.title, genre: project.genre, description: project.description, chapters }
}
