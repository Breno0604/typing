import type { ResultMetrics } from '../types/domain'
import type { TypingSession } from '../types/typing'
import { countSpaces } from './texts'

/**
 * Camada única de cálculo de métricas.
 * Documentação das regras (confirmadas com o usuário):
 *
 * - Caracteres corretos (posicional): quantidade de posições já alcançadas
 *   cujo estado atual é 'correct'. Corrigir com Backspace muda o estado da
 *   posição; a correção não apaga erros históricos.
 * - WPM = caracteres corretos / 5 / minutos decorridos.
 * - Precisão = toques corretos / tentativas de caracteres * 100
 *   (histórico por toque; re-digitar após Backspace conta nova tentativa).
 * - Toques brutos = tentativas de caracteres (inclui incorretos).
 * - Erros = tentativas incorretas (nunca diminuem).
 * - Correções = usos do Backspace.
 * - Toques totais = toques brutos + correções.
 * - Toques líquidos = toques brutos - erros.
 * - Palavras = concluídas (posições de espaço alcançadas) / total do texto.
 * - Caracteres = corretos posicionais / total do texto.
 */

const CHARS_PER_WORD = 5

function minutesFrom(session: TypingSession, now: number): number {
  if (session.startedAt == null) return 0
  const end = session.finishedAt ?? now
  return Math.max((end - session.startedAt) / 60000, 0)
}

/** Caracteres corretos na posição atual (correções refletem o estado real). */
export function positionalCorrectChars(session: TypingSession): number {
  let correct = 0
  for (const [, state] of session.entries) {
    if (state === 'correct') correct++
  }
  return correct
}

/** Tentativas de caracteres que resultaram em acerto (histórico). */
export function historicalCorrectKeystrokes(session: TypingSession): number {
  return session.grossKeystrokes - session.errors
}

/** Palavras concluídas: espaços alcançados (+ texto completo como última palavra). */
export function completedWords(session: TypingSession): number {
  if (session.target.length === 0) return 0
  const spaces = countSpaces(session.target.slice(0, session.position))
  const completed = session.position >= session.target.length ? spaces + 1 : spaces
  return Math.min(completed, countSpaces(session.target) + 1)
}

export function computeMetrics(session: TypingSession, now: number): ResultMetrics {
  const correctChars = positionalCorrectChars(session)
  const gross = session.grossKeystrokes
  const errors = session.errors
  const corrections = session.corrections
  const minutes = minutesFrom(session, now)

  const wpm = minutes > 0 ? correctChars / CHARS_PER_WORD / minutes : 0
  const accuracy = gross > 0 ? (historicalCorrectKeystrokes(session) / gross) * 100 : 0

  return {
    wpm: Math.round(wpm * 10) / 10,
    accuracy: Math.round(accuracy * 10) / 10,
    netKeystrokes: Math.max(gross - errors, 0),
    grossKeystrokes: gross,
    errors,
    corrections,
    totalKeystrokes: gross + corrections,
    wordsCompleted: completedWords(session),
    wordsTotal: countSpaces(session.target) + 1,
    charsCorrect: correctChars,
    charsTotal: session.target.length,
    elapsedMs: session.startedAt != null ? Math.max((session.finishedAt ?? now) - session.startedAt, 0) : 0,
  }
}
