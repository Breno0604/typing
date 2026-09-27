import type { FinishReason, SessionMode, SessionStatus } from './domain'

/** Estado de um caractere na área de digitação. */
export type CharState = 'pending' | 'correct' | 'incorrect'

/** Eventos que alteram a sessão de digitação. */
export type TypingEvent =
  | { type: 'character'; codePoint: number }
  | { type: 'backspace' }
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
  /** Posições que já receberam ao menos um toque incorreto (histórico de erro por posição). */
  errorPositions: Set<number>
  /**
   * Estatísticas por caractere esperado: [codePoint, { tentativas, erros }].
   * Agregadas por caractere alvo para alimentar o modal de estatísticas detalhadas.
   */
  charStats: Map<number, CharStat>
}

export interface CharStat {
  attempts: number
  errors: number
}
