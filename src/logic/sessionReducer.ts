import type { FinishReason, SessionMode } from '../types/domain'
import type { CharState, TypingEvent, TypingSession } from '../types/typing'
import { toCodePoints } from './texts'

/**
 * Máquina de estados da sessão de digitação.
 * Fluxo previsível: idle -> running -> finished.
 * Reducer puro: sem efeitos colaterais, fácil de testar.
 */

export function createSession(mode: SessionMode, text: string): TypingSession {
  return {
    status: 'idle',
    mode,
    target: toCodePoints(text),
    entries: new Map(),
    position: 0,
    startedAt: null,
    finishedAt: null,
    finishReason: null,
    grossKeystrokes: 0,
    errors: 0,
    corrections: 0,
    lastKeyError: false,
  }
}

/** Processa um evento de digitação. Retorna o novo estado e o resultado do toque. */
export function reduceTyping(
  state: TypingSession,
  event: TypingEvent,
  now: number,
): { session: TypingSession; keystroke?: { correct: boolean; started: boolean } } {
  switch (event.type) {
    case 'character':
      return reduceCharacter(state, event.codePoint, now)
    case 'backspace':
      return reduceBackspace(state, now)
    case 'start':
      // Explicitamente usado no treino sem texto digitado (não é o fluxo padrão).
      return { session: state.status === 'idle' ? { ...state, status: 'running', startedAt: now } : state }
    case 'finish':
      return reduceFinish(state, event.reason, now)
    case 'reset':
      return { session: createSession(state.mode, fromPoints(state.target)) }
  }
}

function fromPoints(points: number[]): string {
  return points.map((p) => String.fromCodePoint(p)).join('')
}

function reduceCharacter(state: TypingSession, codePoint: number, now: number) {
  if (state.status === 'finished' || state.position >= state.target.length) {
    return { session: state }
  }

  const started = state.status === 'idle'
  const session: TypingSession = {
    ...state,
    status: 'running',
    startedAt: started ? now : state.startedAt,
    grossKeystrokes: state.grossKeystrokes + 1,
  }

  const expected = state.target[state.position]
  const correct = codePoint === expected
  if (!correct) session.errors = state.errors + 1

  // Sobrescreve o estado da posição (re-digitação após Backspace substitui).
  session.entries = new Map(state.entries)
  session.entries.set(state.position, correct ? 'correct' : 'incorrect')
  session.position = state.position + 1
  session.lastKeyError = !correct

  return {
    session,
    keystroke: { correct, started },
  }
}

function reduceBackspace(state: TypingSession, now: number) {
  if (state.status === 'finished' || state.position === 0 || state.status !== 'running') {
    return { session: state }
  }

  const session: TypingSession = {
    ...state,
    corrections: state.corrections + 1,
    position: state.position - 1,
    lastKeyError: false,
  }
  return { session }
}

function reduceFinish(state: TypingSession, reason: FinishReason, now: number) {
  if (state.status !== 'running') return { session: state }
  const session: TypingSession = {
    ...state,
    status: 'finished',
    finishedAt: now,
    finishReason: reason,
    lastKeyError: false,
  }
  return { session }
}

/** Estado visual de cada caractere para renderização. */
export function charStateAt(session: TypingSession, index: number): CharState {
  return session.entries.get(index) ?? 'pending'
}
