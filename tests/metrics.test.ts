import { describe, expect, it } from 'vitest'
import { computeMetrics, positionalCorrectChars } from '../src/logic/metrics'
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

function backspace(s: TypingSession, nowMs: number): TypingSession {
  return reduceTyping(s, { type: 'backspace' }, nowMs).session
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
    s = backspace(s, 150)
    s = typeString(s, 'a', 200)
    expect(s.errors).toBe(1) // erro permanece
    expect(s.corrections).toBe(1)
    expect(s.grossKeystrokes).toBe(2)
  })

  it('tracks positions that once had an error', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'x', 0) // erra a posição 0
    s = backspace(s, 100)
    s = typeString(s, 'a', 200) // corrige a posição 0
    expect(s.errorPositions.has(0)).toBe(true)
  })

  it('backspace does nothing at position 0', () => {
    let s = createSession('test', 'abc')
    s = backspace(s, 0)
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
    expect(s.errorPositions.size).toBe(0)
    expect(s.charStats.size).toBe(0)
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
    s = backspace(s, 100)
    s = typeString(s, 'a', 200)
    const m = computeMetrics(s, 200)
    expect(m.accuracy).toBeCloseTo(50, 1) // 1 acerto / 2 tentativas
    expect(m.charsCorrect).toBe(1) // posicional: só 'a' correto
    expect(m.errors).toBe(1)
  })

  it('corrected vs permanent errors', () => {
    let s = createSession('test', 'abcd')
    s = typeString(s, 'xs', 0) // erra posições 0 e 1
    s = backspace(s, 100) // volta para posição 1
    s = typeString(s, 'b', 150) // corrige posição 1
    s = backspace(s, 200)
    s = backspace(s, 210) // volta para posição 0
    s = typeString(s, 'a', 250) // corrige posição 0
    s = typeString(s, 'b', 260) // re-digita posição 1 corretamente
    s = typeString(s, 'k', 300) // erra posição 2 (permanente)
    const m = computeMetrics(s, 300)
    expect(m.correctedChars).toBe(2) // posições 0 e 1 corrigidas
    expect(m.permanentErrors).toBe(1) // posição 2 seguiu incorreta
    expect(m.errors).toBe(3)
  })

  it('charStats aggregates attempts and errors per expected char', () => {
    let s = createSession('test', 'aa b')
    s = typeString(s, 'a', 0) // acerto
    s = typeString(s, 'x', 100) // erro (esperado 'a')
    s = backspace(s, 150)
    s = typeString(s, 'a', 200) // acerto
    s = typeString(s, ' ', 300)
    s = typeString(s, 'k', 400) // erro (esperado 'b')
    const m = computeMetrics(s, 400)
    const byChar = new Map(m.charStats!.map((e) => [e.char, e]))
    // 'a': 1 acerto na pos 0 + 2 tentativas na pos 1 (erro 'x' + acerto 'a')
    expect(byChar.get('a')).toEqual({ char: 'a', attempts: 3, errors: 1 })
    expect(byChar.get(' ')).toEqual({ char: ' ', attempts: 1, errors: 0 })
    expect(byChar.get('b')).toEqual({ char: 'b', attempts: 1, errors: 1 })
  })

  it('charStats sorted by errors desc', () => {
    let s = createSession('test', 'xy')
    s = typeString(s, 'xx', 0) // acerto em x, erro em y
    const m = computeMetrics(s, 100)
    expect(m.charStats![0].char).toBe('y')
  })

  it('total keystrokes = gross + corrections', () => {
    let s = createSession('test', 'abcd')
    s = typeString(s, 'ax', 0)
    s = backspace(s, 100)
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

describe('positionalCorrectChars', () => {
  it('counts only positions currently correct', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'axc', 0)
    expect(positionalCorrectChars(s)).toBe(2)
  })
})
