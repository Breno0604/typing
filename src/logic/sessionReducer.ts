import type { FinishReason, SessionMode } from '../types/domain'
import type { CharState, CharStat, TypingEvent, TypingSession } from '../types/typing'
import { toCodePoints } from './texts'
import { effectiveDelta } from './timing'

/**
 * Máquina de estados da sessão de digitação.
 * Fluxo previsível: idle -> running -> finished.
 * Reducer puro: sem efeitos colaterais, fácil de testar.
 *
 * Cronômetro de tempo efetivo:
 * - Inicia na primeira tecla CORRETA (erros antes disso não abrem a contagem).
 * - Cada ação válida soma o intervalo desde a última ação, desde que dentro
 *   da janela de 3s; intervalos maiores são pausas e não contam.
 * - Ações válidas: tecla correta na posição atual; Backspace que corrige o
 *   último caractere digitado incorretamente.
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
    lastActiveAt: null,
    activeMs: 0,
    finishReason: null,
    grossKeystrokes: 0,
    errors: 0,
    corrections: 0,
    errorPositions: new Set(),
    charStats: new Map(),
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

  const expected = state.target[state.position]
  const correct = codePoint === expected

  // Erros antes da primeira correta não abrem o cronômetro (mas contam erro
  // e avançam a posição — o Backspace pode corrigi-los sem iniciar a contagem).
  if (state.status === 'idle' && !correct) {
    const preSession: TypingSession = {
      ...state,
      grossKeystrokes: state.grossKeystrokes + 1,
      errors: state.errors + 1,
      errorPositions: new Set(state.errorPositions),
      charStats: new Map(state.charStats),
    }
    preSession.errorPositions.add(state.position)
    const preStat = preSession.charStats.get(expected) ?? { attempts: 0, errors: 0 }
    preSession.charStats.set(expected, {
      attempts: preStat.attempts + 1,
      errors: preStat.errors + 1,
    })
    preSession.entries = new Map(state.entries)
    preSession.entries.set(state.position, 'incorrect')
    preSession.position = state.position + 1
    return { session: preSession, keystroke: { correct: false, started: false } }
  }

  // Só tecla CORRETA é ação válida de digitação: inicia/retoma a contagem.
  // Teclas incorretas contam erro, mas não movem a âncora de tempo.
  const anchor = state.lastActiveAt ?? state.startedAt ?? now
  const delta = correct ? effectiveDelta(anchor, now) : 0
  const started = state.status === 'idle'

  const session: TypingSession = {
    ...state,
    status: 'running',
    startedAt: started ? now : state.startedAt,
    lastActiveAt: correct ? now : state.lastActiveAt,
    activeMs: state.activeMs + delta,
    grossKeystrokes: state.grossKeystrokes + 1,
  }

  if (!correct) {
    session.errors = state.errors + 1
    session.errorPositions = new Set(state.errorPositions)
    session.errorPositions.add(state.position)
  }

  // Estatística por caractere esperado (agrega pelo alvo, não pelo digitado).
  const charStat: CharStat = state.charStats.get(expected) ?? { attempts: 0, errors: 0 }
  session.charStats = new Map(state.charStats)
  session.charStats.set(expected, {
    attempts: charStat.attempts + 1,
    errors: charStat.errors + (correct ? 0 : 1),
  })

  // Sobrescreve o estado da posição (re-digitação após Backspace substitui).
  session.entries = new Map(state.entries)
  session.entries.set(state.position, correct ? 'correct' : 'incorrect')
  session.position = state.position + 1

  return {
    session,
    keystroke: { correct, started },
  }
}

function reduceBackspace(state: TypingSession, now: number) {
  // Permitido também antes da primeira tecla correta (status 'idle' com
  // posição avançada por erros): o usuário pode corrigir sem iniciar o cronômetro.
  if (state.status === 'finished' || state.position === 0) {
    return { session: state }
  }

  const removedIndex = state.position - 1
  // Estado visual sempre reflete o conteúdo ATUAL: remove a entrada da posição
  // apagada. Sem isso, entradas obsoletas (>= nova posição) seriam renderizadas
  // como acerto/erro em letras que já não estão digitadas.
  const entries = new Map(state.entries)
  entries.delete(removedIndex)

  // Backspace só é ação válida de retomada quando corrige o último caractere
  // digitado INCORRETAMENTE. Corrigir caractere correto não retoma a contagem.
  const lastState = state.entries.get(removedIndex)
  if (lastState !== 'incorrect') {
    return {
      session: {
        ...state,
        entries,
        corrections: state.corrections + 1,
        position: state.position - 1,
      },
    }
  }

  // Antes do início do cronômetro: corrige sem haver tempo a acumular.
  if (state.startedAt == null) {
    return {
      session: {
        ...state,
        entries,
        corrections: state.corrections + 1,
        position: state.position - 1,
      },
    }
  }

  // Retomada válida: acumula tempo efetivo e move a âncora de atividade.
  const anchor = state.lastActiveAt ?? state.startedAt
  const session: TypingSession = {
    ...state,
    entries,
    corrections: state.corrections + 1,
    lastActiveAt: now,
    activeMs: state.activeMs + effectiveDelta(anchor, now),
    position: state.position - 1,
  }
  return { session }
}

function reduceFinish(state: TypingSession, reason: FinishReason, now: number) {
  if (state.status !== 'running') return { session: state }
  // Congela no tempo efetivo: o período entre a última tecla e o fim não conta.
  const anchor = state.lastActiveAt ?? state.startedAt ?? now
  const session: TypingSession = {
    ...state,
    status: 'finished',
    finishedAt: now,
    finishReason: reason,
    activeMs: state.activeMs + effectiveDelta(anchor, now),
  }
  return { session }
}

/** Estado visual de cada caractere para renderização. */
export function charStateAt(session: TypingSession, index: number): CharState {
  return session.entries.get(index) ?? 'pending'
}
