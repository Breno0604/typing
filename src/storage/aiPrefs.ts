import type { TrainingFocus } from '../types/domain'
import type { ContentFormatId, TextSizeId } from '../services/groq'
import { DEFAULT_TEXT_FILTERS, TEXT_SIZE_OPTIONS } from '../services/groq'
import { EMPTY_FOCUS } from '../logic/focus'
import { dbGet, dbPut, STORE_SETTINGS } from './db'

const AI_PREFS_KEY = 'ai-prefs'

/** Preferências persistidas do painel de geração por IA. */
export interface AiGenPrefs {
  focus: TrainingFocus
  size: TextSizeId
  accentHeavy: boolean
  withNumbers: boolean
  format: ContentFormatId
  wordsSideOnly: boolean
}

export const DEFAULT_AI_PREFS: AiGenPrefs = {
  focus: EMPTY_FOCUS,
  size: DEFAULT_TEXT_FILTERS.size,
  accentHeavy: DEFAULT_TEXT_FILTERS.accentHeavy,
  withNumbers: DEFAULT_TEXT_FILTERS.withNumbers,
  format: DEFAULT_TEXT_FILTERS.format,
  wordsSideOnly: DEFAULT_TEXT_FILTERS.wordsSideOnly,
}

/** Converte os antigos tamanhos nomeados para a nova escala em caracteres. */
const LEGACY_SIZES: Record<string, TextSizeId> = {
  short: 300,
  medium: 500,
  long: 800,
}

function normalizeSize(value: unknown): TextSizeId {
  if (typeof value === 'number' && (TEXT_SIZE_OPTIONS as number[]).includes(value)) {
    return value as TextSizeId
  }
  if (typeof value === 'string' && value in LEGACY_SIZES) {
    return LEGACY_SIZES[value]
  }
  return DEFAULT_TEXT_FILTERS.size
}

function normalizeFormat(value: unknown): ContentFormatId {
  return value === 'words' || value === 'text' ? value : DEFAULT_TEXT_FILTERS.format
}

/** Mescla preferências salvas com os padrões (função pura, sem IndexedDB). */
export function normalizeAiPrefs(stored: Partial<AiGenPrefs> | undefined): AiGenPrefs {
  return {
    ...DEFAULT_AI_PREFS,
    ...stored,
    size: normalizeSize(stored?.size),
    format: normalizeFormat(stored?.format),
    wordsSideOnly: stored?.wordsSideOnly === true,
  }
}

export async function loadAiPrefs(): Promise<AiGenPrefs> {
  const stored = await dbGet<Partial<AiGenPrefs>>(STORE_SETTINGS, AI_PREFS_KEY)
  return normalizeAiPrefs(stored)
}

export async function saveAiPrefs(prefs: AiGenPrefs): Promise<void> {
  await dbPut(STORE_SETTINGS, prefs, AI_PREFS_KEY)
}
