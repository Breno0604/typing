import type { TextEntry } from '../types/domain'
import { PRESET_TEXTS } from '../data/predefinedTexts'

/**
 * Textos predefinidos vivem em código (sempre disponíveis offline).
 * Textos próprios/IA ficam no IndexedDB. Esta função une as fontes
 * para os seletores, marcando a origem de cada um.
 */
export function buildAllTexts(userAndAiTexts: TextEntry[]): TextEntry[] {
  const presets: TextEntry[] = PRESET_TEXTS.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    level: p.level,
    source: 'preset',
    createdAt: 0,
  }))
  return [...presets, ...userAndAiTexts]
}
