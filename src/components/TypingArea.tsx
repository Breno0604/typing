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
 */
export const TypingArea = memo(function TypingArea({ session, active }: TypingAreaProps) {
  const WINDOW = 600
  const start = Math.max(0, session.position - 200)
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
