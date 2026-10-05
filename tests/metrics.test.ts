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

  it('registers errors permanently (mesmo antes do início do cronômetro)', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'x', 0) // erro antes da 1ª correta: cronômetro não abre
    expect(s.status).toBe('idle')
    s = backspace(s, 150) // correção permitida antes do início
    s = typeString(s, 'a', 200) // 1ª correta: inicia
    expect(s.startedAt).toBe(200)
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
  it('wpm uses positional correct chars over effective minutes', () => {
    let s = createSession('test', 'a'.repeat(30))
    s = typeString(s, 'a'.repeat(30), 0)
    s = reduceTyping(s, { type: 'finish', reason: 'text-completed' }, 15000).session
    const m = computeMetrics(s, 15000)
    // tempo efetivo = 2,9s (teclas 0..2900); 6 palavras / (2,9/60) ≈ 124,1
    expect(m.wpm).toBeCloseTo(124.1, 0)
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

describe('cronômetro de tempo efetivo (pausa por inatividade)', () => {
  it('não inicia a contagem com tecla incorreta', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'x', 0) // erro antes da primeira correta
    expect(s.startedAt).toBeNull()
    const m = computeMetrics(s, 60_000) // um minuto depois
    expect(m.elapsedMs).toBe(0)
  })

  it('inicia a contagem na primeira tecla correta', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'a', 5_000)
    expect(s.startedAt).toBe(5_000)
  })

  it('display corre continuamente enquanto ativo e congela no valor da última tecla na pausa', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'ab', 1_000) // teclas em 1000 e 1100 → 100ms acumulados
    // 1s depois da última tecla, SEM digitar: display corre continuamente
    let m = computeMetrics(s, 2_100)
    expect(m.elapsedMs).toBe(1_100) // 100 acumulados + 1000 correntes
    // 2,9s depois da última tecla (dentro da janela de 3s): segue correndo
    m = computeMetrics(s, 4_000)
    expect(m.elapsedMs).toBe(3_000) // 100 + 2900
    // 10s depois: pausa detectada; volta e congela no valor da última tecla
    m = computeMetrics(s, 11_000)
    expect(m.elapsedMs).toBe(100) // os ~3s de janela não permanecem contabilizados
  })

  it('retomada após pausa continua a partir do valor congelado', () => {
    let s = createSession('test', 'abcd')
    s = typeString(s, 'ab', 1_000) // 100ms acumulados
    s = typeString(s, 'c', 20_000) // pausa descartada; retoma na posição
    s = typeString(s, 'd', 20_500) // 500ms depois: corrente
    const m = computeMetrics(s, 20_800)
    expect(m.elapsedMs).toBe(900) // 100 (inicial) + 0 (pausa) + 500 (c→d) + 300 correntes
  })

  it('tecla correta após pausa retoma e soma só o trecho novo', () => {
    let s = createSession('test', 'abcd')
    s = typeString(s, 'ab', 1_000) // 100ms
    s = typeString(s, 'c', 31_000) // pausa descartada; c soma 0
    s = typeString(s, 'd', 31_400) // c→d soma 400ms
    const m = computeMetrics(s, 40_000)
    expect(m.elapsedMs).toBe(500) // 100 + 0 + 400
  })

  it('backspace corrige caractere correto sem retomar o tempo', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'ab', 1_000)
    s = backspace(s, 20_000) // último 'b' está correto: não retoma
    expect(s.position).toBe(1)
    expect(s.lastActiveAt).toBe(1_100)
    const m = computeMetrics(s, 25_000)
    expect(m.elapsedMs).toBe(100)
  })

  it('backspace que corrige erro retoma a contagem', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'ax', 1_000) // 'x' errado em 1100
    s = backspace(s, 20_000) // corrige erro: retoma (pausa descartada)
    expect(s.lastActiveAt).toBe(20_000)
    s = typeString(s, 'b', 20_300)
    const m = computeMetrics(s, 20_300)
    expect(m.elapsedMs).toBe(300) // 100 (a→x) + 0 (pausa) + 200 (bs→b)
  })

  it('backspace antes da primeira correta não inicia o cronômetro', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'x', 0) // erro
    s = backspace(s, 500) // correção sem iniciar
    expect(s.startedAt).toBeNull()
    expect(s.position).toBe(0)
    expect(s.corrections).toBe(1)
  })

  it('finish congela no último tempo efetivo', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'ab', 1_000)
    s = reduceTyping(s, { type: 'finish', reason: 'manual' }, 15_000).session
    const m = computeMetrics(s, 15_000)
    expect(m.elapsedMs).toBe(100) // valor da última tecla
  })

  it('wpm usa o tempo efetivo', () => {
    let s = createSession('test', 'a'.repeat(30))
    s = typeString(s, 'a'.repeat(30), 0)
    s = reduceTyping(s, { type: 'finish', reason: 'text-completed' }, 60_000).session
    const m = computeMetrics(s, 60_000)
    // 2,9s efetivos: 6 palavras / (2,9/60) ≈ 124,1 wpm
    expect(m.wpm).toBeCloseTo(124.1, 0)
  })
})

describe('positionalCorrectChars', () => {
  it('counts only positions currently correct', () => {
    let s = createSession('test', 'abc')
    s = typeString(s, 'axc', 0)
    expect(positionalCorrectChars(s)).toBe(2)
  })
})
