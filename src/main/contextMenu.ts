/**
 * Menú del clic derecho.
 *
 * Electron subraya las faltas de ortografía en rojo, pero no muestra ningún
 * menú por su cuenta: sin esto no habría forma de ver las sugerencias.
 *
 * Sobre una palabra subrayada ofrece sus correcciones y "Añadir al
 * diccionario"; en cualquier texto, las acciones de edición habituales.
 */
import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'

/** Sugerencias que se muestran como mucho (el resto suele ser ruido). */
const MAX_SUGGESTIONS = 6

export function attachContextMenu(window: BrowserWindow): void {
  const { webContents } = window

  webContents.on('context-menu', (_event, params) => {
    const items: MenuItemConstructorOptions[] = []

    if (params.misspelledWord) {
      const suggestions = params.dictionarySuggestions.slice(0, MAX_SUGGESTIONS)
      if (suggestions.length === 0) {
        items.push({ label: 'Sin sugerencias', enabled: false })
      }
      for (const suggestion of suggestions) {
        items.push({ label: suggestion, click: () => webContents.replaceMisspelling(suggestion) })
      }
      items.push(
        { type: 'separator' },
        {
          label: `Añadir «${params.misspelledWord}» al diccionario`,
          click: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
        },
        { type: 'separator' }
      )
    }

    const { editFlags } = params
    if (params.isEditable) {
      items.push(
        { label: 'Deshacer', role: 'undo', enabled: editFlags.canUndo },
        { label: 'Rehacer', role: 'redo', enabled: editFlags.canRedo },
        { type: 'separator' },
        { label: 'Cortar', role: 'cut', enabled: editFlags.canCut },
        { label: 'Copiar', role: 'copy', enabled: editFlags.canCopy },
        { label: 'Pegar', role: 'paste', enabled: editFlags.canPaste },
        { type: 'separator' },
        { label: 'Seleccionar todo', role: 'selectAll', enabled: editFlags.canSelectAll }
      )
    } else if (params.selectionText.trim()) {
      items.push({ label: 'Copiar', role: 'copy', enabled: editFlags.canCopy })
    }

    if (items.length > 0) Menu.buildFromTemplate(items).popup({ window })
  })
}
