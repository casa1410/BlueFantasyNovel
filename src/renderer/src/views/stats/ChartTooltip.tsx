import { useCallback, useState, type MouseEvent, type ReactNode } from 'react'

interface TooltipState {
  x: number
  y: number
  content: ReactNode
}

/**
 * Tooltip ligero para los gráficos. Uso:
 *
 *   const tooltip = useChartTooltip()
 *   <rect onMouseEnter={(e) => tooltip.show(e, 'texto')} onMouseLeave={tooltip.hide} />
 *   {tooltip.element}
 */
export function useChartTooltip() {
  const [state, setState] = useState<TooltipState | null>(null)

  const show = useCallback((event: MouseEvent, content: ReactNode) => {
    const rect = (event.currentTarget as Element).getBoundingClientRect()
    setState({ x: rect.left + rect.width / 2, y: rect.top, content })
  }, [])

  const hide = useCallback(() => setState(null), [])

  const element = state && (
    <div className="chart-tooltip" style={{ left: state.x, top: state.y }} role="tooltip">
      {state.content}
    </div>
  )

  return { show, hide, element }
}
