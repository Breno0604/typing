import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FinishReason, SessionMode, TextEntry } from '../types/domain'
import { createSession, reduceTyping } from '../logic/sessionReducer'
import { computeMetrics } from '../logic/metrics'
import type { TypingSession } from '../types/typing'
import type { ResultMetrics } from '../types/domain'
import { playErrorSound, playKeySound, warmUpAudio } from '../services/audio'
import { saveResult } from '../storage/resultsRepo'
import { formatElapsed } from './useTimer'

export interface KeystrokeResult {
  correct: boolean
  consumed: boolean
}

interface UseTestSessionParams {
  mode: SessionMode
  text: TextEntry | null
  /** Segundos; null = sem limite. */
  duration: number | null
  soundEnabled: boolean
  soundVolume: number
}

/**
 * Controla a sessão de digitação: máquina de estados, cronômetro,
 * áudio e persistência do resultado.
 *
 * A posição atual é mantida numa ref síncrona (sessionRef) para que
 * dezenas de eventos por segundo sejam processados na ordem, sem
 * depender de batching do React. Efeitos colaterais (som, salvar)
 * ocorrem fora de updaters de estado.
 */
export function useTestSession({ mode, text, duration, soundEnabled, soundVolume }: UseTestSessionParams) {
  const [session, setSessionState] = useState<TypingSession>(() => createSession(mode, text?.content ?? ''))
  const [finishedMetrics, setFinishedMetrics] = useState<ResultMetrics | null>(null)
  const [clockTick, setClockTick] = useState(0)
  const finishingRef = useRef(false)

  const sessionRef = useRef(session)
  const setSession = useCallback((next: TypingSession) => {
    sessionRef.current = next
    setSessionState(next)
  }, [])

  const textId = text?.id ?? null
  const textIdRef = useRef(textId)
  textIdRef.current = textId
  const textRef = useRef(text)
  textRef.current = text
  const durationRef = useRef(duration)
  durationRef.current = duration
  const modeRef = useRef(mode)
  modeRef.current = mode

  // Troca de texto/modo/duração reinicia a sessão.
  useEffect(() => {
    finishingRef.current = false
    setFinishedMetrics(null)
    setSession(createSession(mode, text?.content ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textId, mode, duration, setSession])

  /** Consolida o fim da sessão, calcula métricas e persiste o resultado. */
  const finish = useCallback(
    (reason: FinishReason) => {
      const current = sessionRef.current
      if (current.status !== 'running' || finishingRef.current) return
      finishingRef.current = true
      const now = performance.now()
      const closed = reduceTyping(current, { type: 'finish', reason }, now).session
      setSession(closed)
      const metrics = computeMetrics(closed, now)
      setFinishedMetrics(metrics)
      const textId = textIdRef.current
      if (textId) {
        void saveResult({
          id: `result-${crypto.randomUUID()}`,
          mode: modeRef.current,
          finishedAt: Date.now(),
          finishReason: reason,
          textId,
          textTitle: textRef.current?.title ?? '',
          textSource: textRef.current?.source ?? 'preset',
          level: textRef.current?.level ?? 'basic',
          durationSeconds: durationRef.current,
          metrics,
        })
      }
    },
    [setSession],
  )

  const handleCharacter = useCallback(
    (codePoint: number): KeystrokeResult => {
      const prev = sessionRef.current
      if (prev.status === 'finished' || prev.position >= prev.target.length) {
        return { correct: false, consumed: false }
      }
      const now = performance.now()
      const { session: next, keystroke } = reduceTyping(prev, { type: 'character', codePoint }, now)
      if (!keystroke) return { correct: false, consumed: false }
      setSession(next)
      if (soundEnabled) {
        if (keystroke.correct) playKeySound(soundVolume)
        else playErrorSound(soundVolume)
      }
      // Fim por conclusão do texto (teste, treino e sem limite).
      if (next.position >= next.target.length) {
        finish('text-completed')
      }
      return { correct: keystroke.correct, consumed: true }
    },
    [soundEnabled, soundVolume, finish, setSession],
  )

  const handleBackspace = useCallback((): KeystrokeResult => {
    const prev = sessionRef.current
    if (prev.status !== 'running' || prev.position === 0) {
      return { correct: false, consumed: false }
    }
    const now = performance.now()
    const { session: next } = reduceTyping(prev, { type: 'backspace' }, now)
    setSession(next)
    return { correct: true, consumed: true }
  }, [setSession])

  const finishManually = useCallback(() => {
    finish('manual')
  }, [finish])

  // Término automático por tempo (um único timeout por sessão iniciada).
  const startedAt = session.startedAt
  useEffect(() => {
    if (session.status !== 'running' || duration == null || startedAt == null) return
    const remaining = duration * 1000 - (performance.now() - startedAt)
    if (remaining <= 0) {
      finish('time-up')
      return
    }
    const id = window.setTimeout(() => finish('time-up'), remaining)
    return () => window.clearTimeout(id)
  }, [session.status, startedAt, duration, finish])

  // Clock fluido: tick a cada 100ms enquanto em execução (timestamp real).
  useEffect(() => {
    if (session.status !== 'running' || session.startedAt == null) return
    const id = window.setInterval(() => setClockTick((t) => t + 1), 100)
    return () => window.clearInterval(id)
  }, [session.status, session.startedAt])

  /** Entrada de teclado crua (chamada pelo listener global). */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): KeystrokeResult => {
      if (event.ctrlKey || event.metaKey || event.altKey) return { correct: false, consumed: false }

      if (event.key === 'Backspace') {
        const result = handleBackspace()
        if (result.consumed) event.preventDefault()
        return result
      }

      if (event.key.length === 1) {
        event.preventDefault()
        warmUpAudio()
        return handleCharacter(event.key.codePointAt(0)!)
      }

      return { correct: false, consumed: false }
    },
    [handleBackspace, handleCharacter],
  )

  const reset = useCallback(() => {
    finishingRef.current = false
    setFinishedMetrics(null)
    setSession(reduceTyping(sessionRef.current, { type: 'reset' }, performance.now()).session)
  }, [setSession])

  const liveMetrics = useMemo(
    () => computeMetrics(session, performance.now()),
    // clockTick atualiza o tempo decorrido exibido em tempo real.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, clockTick],
  )
  const clockMs =
    session.status === 'running' && session.startedAt != null
      ? performance.now() - session.startedAt
      : liveMetrics.elapsedMs

  return {
    session,
    liveMetrics,
    finishedMetrics,
    clockMs,
    elapsedLabel: formatElapsed(liveMetrics.elapsedMs),
    handleKeyDown,
    reset,
    finishManually,
    running: session.status === 'running',
    finished: session.status === 'finished',
    idle: session.status === 'idle',
  }
}
