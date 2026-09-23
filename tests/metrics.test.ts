import { describe, expect, it } from 'vitest'
import { computeMetrics } from '../src/logic/metrics'
import { createSession, reduceTyping } from '../src/logic/sessionReducer'
import type { TypingSession } from '../src/types/typing'

function typeString(state: TypingSession, text: string, nowMs: number): TypingSession {
  let s = state
  let i = 0
  for (const ch of text) {
    const r = reduceTyping(s, { type: 'character', codePoint: ch.codePointAt(0)! }, nowMs + i * 100)
    s = r.session
    i++
  }
  return s
}

describe('sessionReducer', () => {
  it('starts on first character only', () => {
    let s = createSession('test', 'abc')
    expect(s.status).toBe('idle')
    s = typeString(s, 'a', 1000)
    expect(s.status).toBe('running')
    expect(s.startedAt).toBe(1000)
  })

  it('registers errors permanently', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'x', 0) // erro
    s = reduceTyping(s, { type: 'backspace' }, 150).session
    s = typeString(s, 'a', 200)
    expect(s.errors).toBe(1) // erro permanece
    expect(s.corrections).toBe(1)
    expect(s.grossKeystrokes).toBe(2)
  })

  it('backspace does nothing at position 0', () => {
    let s = createSession('test', 'abc')
    s = reduceTyping(s, { type: 'backspace' }, 0).session
    expect(s.corrections).toBe(0)
    expect(s.position).toBe(0)
  })

  it('finishes by time-up', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'ab', 0)
    s = reduceTyping(s, { type: 'finish', reason: 'time-up' }, 15000).session
    expect(s.status).toBe('finished')
    expect(s.finishedAt).toBe(15000)
  })

  it('finishes when text completed', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'abc', 0)
    expect(s.status).toBe('running')
    s = reduceTyping(s, { type: 'finish', reason: 'text-completed' }, 3000).session
    expect(s.status).toBe('finished')
  })

  it('reset creates fresh session with same text', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'ax', 0)
    s = reduceTyping(s, { type: 'reset' }, 100).session
    expect(s.status).toBe('idle')
    expect(s.position).toBe(0)
    expect(s.target.length).toBe(3)
  })
})

describe('metrics (hybrid rules confirmed by user)', () => {
  it('wpm uses positional correct chars over minutes', () => {
    let s = createSession('test', 'a'.repeat(30))
    s = typeString(s, 'a'.repeat(30), 0)
    s = reduceTyping(s, { type: 'finish', reason: 'text-completed' }, 15000).session
    const m = computeMetrics(s, 15000)
    // 30 chars / 5 = 6 words in 0.25 min = 24 wpm
    expect(m.wpm).toBe(24)
  })

  it('accuracy uses historical keystrokes', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'x', 0) // erro
    s = reduceTyping(s, { type: 'backspace' }, 100).session
    s = typeString(s, 'a', 200)
    const m = computeMetrics(s, 200)
    expect(m.accuracy).toBeCloseTo(50, 1) // 1 acerto / 2 tentativas
    expect(m.charsCorrect).toBe(1) // posicional: só 'a' correto
    expect(m.errors).toBe(1)
  })

  it('total keystrokes = gross + corrections', () => {
    let s = createSession('test', 'abcd')
    s = typeString(s, 'ax', 0)
    s = reduceTyping(s, {type: 'backspace'}, 100).session
    s = typeString(s, 'bc', 200)
    const m = computeMetrics(s, 200)
    expect(m.grossKeystrokes).toBe(4)
    expect(m.corrections).toBe(1)
    expect(m.totalKeystrokes).toBe(5)
    expect(m.netKeystrokes).toBe(3)
    expect(m.charsCorrect).toBe(3)
  })

  it('words and chars progress', () => {
    let s = createSession('test', 'olá mundo')
    s = typeString(s, 'olá m', 0)
    const m = computeMetrics(s, 0)
    expect(m.wordsTotal).toBe(2)
    expect(m.wordsCompleted).toBe(1)
    expect(m.charsTotal).toBe(9)
    expect(m.charsCorrect).toBe(5)
  })

  it('accents compared exactly (case-sensitive, NFC)', () => {
    let s = createSession('test', 'çáê')
    s = typeString(s, 'çáê', 0)
    const m = computeMetrics(s, 0)
    expect(m.charsCorrect).toBe(3)
  })
})
