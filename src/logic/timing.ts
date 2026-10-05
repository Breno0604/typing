import type { TypingSession } from '../types/typing'

/**
 * Cronômetro de tempo efetivo da sessão:
 * - Inicia na primeira tecla CORRETA.
 * - Enquanto ativo (última ação válida há ≤ 3s), o tempo EXIBIDO corre de
 *   forma contínua: acumulado + intervalo desde a última tecla. O display
 *   atualiza segundo a segundo, mesmo sem novas teclas.
 * - Ao detectar 3s de inatividade, o cronômetro pausa e o exibido VOLTA ao
 *   valor da última tecla (os 3s de janela não são incorporados ao tempo):
 *   última tecla às 00:10 → avança até ~00:13 → pausa e exibe ~00:10.
 * - Retomada: tecla correta na posição atual ou Backspace que corrige o
 *   último caractere digitado incorretamente; volta a correr continuamente.
 * - Teclas controlam o ESTADO (iniciar/pausar/retomar); o relógio controla
 *   a atualização contínua do valor exibido.
 */

/** Inatividade que pausa o cronômetro (ms). */
export const IDLE_PAUSE_MS = 3000

/**
 * Trecho de tempo efetivo entre duas ações válidas. Intervalo maior que a
 * janela de inatividade é uma pausa: nada é somado (a pausa já ocorreu).
 */
export function effectiveDelta(anchor: number, now: number): number {
  const gap = now - anchor
  if (gap <= 0) return 0
  return gap <= IDLE_PAUSE_MS ? gap : 0
}

/**
 * Tempo efetivo exibido (ms), atualizado continuamente:
 * - Contagem ativa (última ação há ≤ 3s): acumulado + intervalo corrente.
 * - Pausado (última ação há > 3s): congela no acumulado até a última tecla.
 * - Sessões encerradas: congela no acumulado final.
 */
export function effectiveElapsedMs(session: TypingSession, now: number): number {
  if (session.startedAt == null) return 0
  if (session.status !== 'running') return session.activeMs
  const anchor = session.lastActiveAt ?? session.startedAt
  const gap = now - anchor
  if (gap > IDLE_PAUSE_MS) return session.activeMs
  return session.activeMs + Math.max(gap, 0)
}

/** Sessão em pausa por inatividade: rodando, iniciada e passou da janela. */
export function isPaused(session: TypingSession, now: number): boolean {
  return (
    session.status === 'running' &&
    session.startedAt != null &&
    now - (session.lastActiveAt ?? session.startedAt) > IDLE_PAUSE_MS
  )
}
