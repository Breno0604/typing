import { memo, useMemo } from 'react'
import type { TypingSession } from '../types/typing'
import { charStateAt } from '../logic/sessionReducer'

interface TypingAreaProps {
  session: TypingSession
  active: boolean
}

/**
 * Exibe o texto caractere por caractere com estados:
 * pendente, correto, incorreto e atual (cursor).
 * Renderiza apenas a janela visível em textos longos (performance).
 *
 * Estabilidade visual: o início da janela é QUANTIZADO em blocos de 100
 * caracteres. Sem isso, a janela deslizaria a cada tecla (position - 200)
 * e o texto inteiro se reajustaria continuamente, o que confunde a leitura.
 * Com a quantização, o texto fica estável durante a digitação e avança em
 * passos discretos (a cada 100 caracteres), sempre com o cursor visível.
 */
export const TypingArea = memo(function TypingArea({ session, active }: TypingAreaProps) {
  const WINDOW = 600
  const BACKSPACE_MARGIN = 200
  const BLOCK = 100
  const rawStart = Math.max(0, session.position - BACKSPACE_MARGIN)
  const start = Math.floor(rawStart / BLOCK) * BLOCK
  const end = Math.min(session.target.length, start + WINDOW)
  const slice = useMemo(() => session.target.slice(start, end), [session.target, start, end])

  return (
    <div
      className="typing-text"
      aria-label="Texto para digitação"
      aria-live="off"
      spellCheck={false}
    >
      {start > 0 && <span aria-hidden>…</span>}
      {slice.map((codePoint, i) => {
        const index = start + i
        const state =
          index === session.position && active
            ? 'current'
            : charStateAt(session, index)
        const char = codePoint === 0x20 ? ' ' : String.fromCodePoint(codePoint)
        return (
          <span key={index} className="char" data-state={state}>
            {char}
          </span>
        )
      })}
      {end < session.target.length && <span aria-hidden>…</span>}
    </div>
  )
})
