/** Fontes de texto disponíveis. */
export type TextSource = 'preset' | 'ai' | 'user'

/** Modos da aplicação: teste medido ou prática livre. */
export type SessionMode = 'test' | 'practice'

/** Por que a sessão terminou. */
export type FinishReason = 'time-up' | 'text-completed' | 'manual'

/** Máquina de estados da sessão (evita booleanos soltos). */
export type SessionStatus = 'idle' | 'running' | 'finished'

/** Nível de dificuldade (identificador estável). */
export type LevelId = 'beginner' | 'basic' | 'intermediate' | 'advanced' | 'expert'

export interface Level {
  id: LevelId
  label: string
  /** Ordem crescente de dificuldade. */
  order: number
  /** Descrição usada em tooltips e no prompt de IA. */
  description: string
}

export type DurationId = '5' | '10' | '15' | '30' | '60' | '90' | '120' | '180' | 'custom' | 'unlimited'

export type ThemeId = 'dark' | 'light'

export type FontSizeId = 'small' | 'medium' | 'large'

export type AccentColorId = 'blue' | 'green' | 'slate' | 'orange' | 'pink'

/** Cor de fundo do card de digitação no tema claro. */
export type LightCardBgId = 'white' | 'default' | 'soft' | 'cream' | 'mint'

/** Texto usado numa sessão (predefinido, gerado por IA ou do usuário). */
export interface TextEntry {
  id: string
  title: string
  content: string
  level: LevelId
  source: TextSource
  createdAt: number
  /** Indicativo de "Gerado por IA" exibido na interface. */
  generatedByAi?: boolean
}

/** Configurações gerais persistidas no IndexedDB. */
export interface Settings {
  theme: ThemeId
  /** Tamanho da fonte dos controles/interface. */
  uiFontSize: FontSizeId
  /** Tamanho do texto exibido na área de digitação. */
  typingFontSize: FontSizeId
  /** Cor do destaque de digitação (botoes, barras de progresso). */
  accentColor: AccentColorId
  /** Cor da letra a ser digitada (caractere atual). */
  caretColor: AccentColorId
  /** Cor do sublinhado do caractere atual. */
  caretUnderlineColor: AccentColorId
  /** Fundo do card de digitação (aplicado somente no tema claro). */
  lightTypingCardBg: LightCardBgId
  soundEnabled: boolean
  soundVolume: number // 0..1
  defaultDuration: DurationId
  /** Segundos quando defaultDuration === 'custom'. */
  defaultCustomDuration: number
  defaultLevel: LevelId
  defaultMode: SessionMode
}

/** Configuração do Groq persistida no IndexedDB. */
export interface GroqConfig {
  apiKey: string
  /** Modelo configurável (a API pode mudar modelos a qualquer momento). */
  model: string
}

/** Registro de um teste/treino finalizado. */
export interface TestResult {
  id: string
  mode: SessionMode
  finishedAt: number
  finishReason: FinishReason
  textId: string
  textTitle: string
  textSource: TextSource
  level: LevelId
  /** Duração configurada em segundos; null = sem limite. */
  durationSeconds: number | null
  metrics: ResultMetrics
}

export interface ResultMetrics {
  wpm: number
  accuracy: number
  netKeystrokes: number
  grossKeystrokes: number
  errors: number
  corrections: number
  totalKeystrokes: number
  wordsCompleted: number
  wordsTotal: number
  charsCorrect: number
  charsTotal: number
  /** Milissegundos. */
  elapsedMs: number
}
