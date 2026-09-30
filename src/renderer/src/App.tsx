/**
 * Raíz de la interfaz.
 *
 * Navegación deliberadamente simple (sin router): o se ve la Biblioteca, o
 * se ve un proyecto abierto. Dentro del proyecto, `ProjectWorkspace`
 * gestiona sus propias secciones.
 */
import { useEffect, useState } from 'react'
import type { Id } from '@shared/types'
import { ToastProvider } from './components/Toasts'
import { api } from './lib/api'
import { flushAll } from './lib/pendingSaves'
import { LibraryView } from './views/library/LibraryView'
import { ProjectWorkspace } from './views/workspace/ProjectWorkspace'

export function App() {
  const [openProjectId, setOpenProjectId] = useState<Id | null>(null)

  // Antes de cerrar la ventana, guarda todo lo pendiente (ver src/main/index.ts).
  useEffect(
    () =>
      api.app.onCloseRequested(async () => {
        await flushAll()
        api.app.confirmClose()
      }),
    []
  )

  return (
    <ToastProvider>
      {openProjectId ? (
        <ProjectWorkspace key={openProjectId} projectId={openProjectId} onExit={() => setOpenProjectId(null)} />
      ) : (
        <LibraryView onOpenProject={setOpenProjectId} />
      )}
    </ToastProvider>
  )
}
