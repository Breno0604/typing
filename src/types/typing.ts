import type { FinishReason, SessionMode, SessionStatus } from './domain'

/** Estado de um caractere na área de digitação. */
export type CharState = 'pending' | 'correct' | 'incorrect'

/** Eventos que alteram a sessão de digitação. */
export type TypingEvent =
  | { type: 'character'; codePoint: number }
  | { type: 'backspace' }
  | { type: 'start' }
  | { type: 'finish'; reason: FinishReason }
  | { type: 'reset' }

export interface TypingSession {
  status: SessionStatus
  mode: SessionMode
  /** Code points do texto alvo. */
  target: number[]
  /** Estado de cada posição já tentada (recortada por posição atual). */
  entries: Map<number, CharState>
  /** Posição atual do cursor (índice no array target). */
  position: number
  /** Timestamp (performance.now) do primeiro caractere; null se não iniciado. */
  startedAt: number | null
  /** Timestamp de finalização; null se em andamento. */
  finishedAt: number | null
  finishReason: FinishReason | null
  /** Toques brutos: tentativas de caracteres. */
  grossKeystrokes: number
  /** Tentativas incorretas (nunca diminuem). */
  errors: number
  /** Usos do Backspace. */
  corrections: number
  /** Última tecla produz erro? (para feedback sonoro) */
  lastKeyError: boolean
}
