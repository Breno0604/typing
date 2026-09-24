import type { GroqConfig, Settings } from '../types/domain'
import { dbGet, dbPut, STORE_SETTINGS } from './db'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  uiFontSize: 'medium',
  typingFontSize: 'medium',
  accentColor: 'blue',
  caretColor: 'blue',
  caretUnderlineColor: 'blue',
  soundEnabled: true,
  soundVolume: 0.5,
  defaultDuration: '30',
  defaultCustomDuration: 45,
  defaultLevel: 'basic',
  defaultMode: 'test',
}

export const DEFAULT_GROQ_CONFIG: GroqConfig = {
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
}

const SETTINGS_KEY = 'app-settings'
const GROQ_KEY = 'groq-config'

export async function loadSettings(): Promise<Settings> {
  const stored = await dbGet<Partial<Settings>>(STORE_SETTINGS, SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await dbPut(STORE_SETTINGS, settings, SETTINGS_KEY)
}

export async function loadGroqConfig(): Promise<GroqConfig> {
  const stored = await dbGet<Partial<GroqConfig>>(STORE_SETTINGS, GROQ_KEY)
  return { ...DEFAULT_GROQ_CONFIG, ...stored }
}

export async function saveGroqConfig(config: GroqConfig): Promise<void> {
  await dbPut(STORE_SETTINGS, config, GROQ_KEY)
}
