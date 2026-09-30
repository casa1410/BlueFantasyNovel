import { useState } from 'react'

/** "fuego, antiguo ,  magia" -> ["fuego", "antiguo", "magia"] (sin repetidos). */
export function parseList(text: string): string[] {
  return [...new Set(text.split(',').map((t) => t.trim()).filter(Boolean))]
}

interface ListInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
  'aria-label'?: string
}

/**
 * Campo de texto para listas separadas por comas (alias, etiquetas…).
 * Guarda el texto tal cual se escribe para no "comerse" las comas al teclear,
 * y emite la lista ya limpia.
 */
export function ListInput({ value, onChange, placeholder, className = 'input', ...rest }: ListInputProps) {
  const [text, setText] = useState(value.join(', '))
  return (
    <input
      className={className}
      value={text}
      placeholder={placeholder}
      aria-label={rest['aria-label']}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseList(e.target.value))
      }}
    />
  )
}
