import { BookMarked, Church, Drama, Gem, Landmark, MapPin, Shield, Sparkles, type LucideIcon } from 'lucide-react'
import { LORE_CATEGORY_LABELS } from '@shared/labels'
import type { LoreCategory } from '@shared/types'

const VISUALS: Record<LoreCategory, { icon: LucideIcon; color: string }> = {
  lugar: { icon: MapPin, color: '#3fb6d9' },
  faccion: { icon: Shield, color: '#e8577a' },
  magia: { icon: Sparkles, color: '#8e5bff' },
  objeto: { icon: Gem, color: '#e8c46a' },
  historia: { icon: Landmark, color: '#f08a4b' },
  religion: { icon: Church, color: '#4fd1a5' },
  cultura: { icon: Drama, color: '#b86bd9' },
  otro: { icon: BookMarked, color: '#5b8cff' }
}

/** Nombre visible, icono y color de cada categoría de lore. */
export const LORE_CATEGORY_INFO = Object.fromEntries(
  (Object.keys(VISUALS) as LoreCategory[]).map((key) => [key, { ...LORE_CATEGORY_LABELS[key], ...VISUALS[key] }])
) as Record<LoreCategory, { label: string; plural: string; icon: LucideIcon; color: string }>
