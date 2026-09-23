import type { DurationId } from '../types/domain'

/** Opções rápidas de duração (segundos). */
export const DURATIONS: readonly { id: DurationId; seconds: number }[] = [
  { id: '5', seconds: 5 },
  { id: '10', seconds: 10 },
  { id: '15', seconds: 15 },
  { id: '30', seconds: 30 },
  { id: '60', seconds: 60 },
  { id: '90', seconds: 90 },
  { id: '120', seconds: 120 },
  { id: '180', seconds: 180 },
]

export const MIN_CUSTOM_SECONDS = 1
export const MAX_CUSTOM_SECONDS = 3600

export function durationSeconds(id: DurationId, customSeconds: number): number | null {
  if (id === 'unlimited') return null
  if (id === 'custom') {
    const clamped = Math.min(Math.max(Math.round(customSeconds), MIN_CUSTOM_SECONDS), MAX_CUSTOM_SECONDS)
    return clamped
  }
  const found = DURATIONS.find((d) => d.id === id)
  return found ? found.seconds : 15
}

export function durationLabel(id: DurationId, customSeconds: number): string {
  if (id === 'unlimited') return 'Sem limite'
  if (id === 'custom') return `Personalizado (${Math.round(customSeconds)}s)`
  const seconds = durationSeconds(id, customSeconds)
  return `${seconds} segundos`
}
