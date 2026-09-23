import { useEffect, useRef, useState } from 'react'

/**
 * Cronômetro de alta precisão baseado em performance.now().
 * Atualiza ~10x/s; o valor exibido é derivado de timestamps reais,
 * nunca de somar intervalos.
 */
export function useTimer(running: boolean, startedAt: number | null): number {
  const [elapsedMs, setElapsedMs] = useState(0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (!running || startedAt == null) {
      setElapsedMs(0)
      return
    }
    const tick = () => {
      setElapsedMs(performance.now() - startedAt)
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [running, startedAt])

  return elapsedMs
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatElapsed(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const millis = Math.floor(ms % 1000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(millis).padStart(3, '0')}`
}
