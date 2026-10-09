import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Mock mínimo da Web Audio API para testar o serviço em ambiente Node
 * (sem DOM). Simula a cadeia osc -> gain -> destination.
 */
function installAudioMock(options: { supported?: boolean; initialState?: string } = {}) {
  const supported = options.supported ?? true
  const start = vi.fn()
  const stop = vi.fn()
  const setValueAtTime = vi.fn()
  const exponentialRampToValueAtTime = vi.fn()
  const connect = vi.fn((node: unknown) => node)
  const createOscillator = vi.fn(() => ({
    type: '',
    frequency: { setValueAtTime },
    connect,
    start,
    stop,
  }))
  const createGain = vi.fn(() => ({
    gain: { setValueAtTime, exponentialRampToValueAtTime },
    connect,
  }))
  const resume = vi.fn(() => Promise.resolve())
  let contextCount = 0

  const state = options.initialState ?? 'running'
  class FakeAudioContext {
    state = state
    currentTime = 0
    destination = {}
    createOscillator = createOscillator
    createGain = createGain
    resume = resume
    constructor() {
      contextCount += 1
    }
  }

  const win: Record<string, unknown> = {}
  if (supported) win.AudioContext = FakeAudioContext

  ;(globalThis as { window?: unknown }).window = win

  return {
    createOscillator,
    createGain,
    start,
    stop,
    exponentialRampToValueAtTime,
    resume,
    get contextCount() {
      return contextCount
    },
  }
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
  vi.resetModules()
})

describe('playErrorSound', () => {
  it('toca um tom curto (inicia e para) quando há Web Audio', async () => {
    const mock = installAudioMock()
    const { playErrorSound } = await import('../src/services/audio')

    playErrorSound()

    expect(mock.createOscillator).toHaveBeenCalledTimes(1)
    expect(mock.createGain).toHaveBeenCalledTimes(1)
    expect(mock.start).toHaveBeenCalledTimes(1)
    expect(mock.stop).toHaveBeenCalledTimes(1)
    // Envelope de volume aplicado (evita estalos/volume alto).
    expect(mock.exponentialRampToValueAtTime).toHaveBeenCalled()
  })

  it('reutiliza o mesmo AudioContext em chamadas repetidas', async () => {
    const mock = installAudioMock()
    const { playErrorSound } = await import('../src/services/audio')

    playErrorSound()
    playErrorSound()

    expect(mock.createOscillator).toHaveBeenCalledTimes(2)
    expect(mock.contextCount).toBe(1)
  })

  it('retoma o contexto suspenso (restrições de autoplay do navegador)', async () => {
    const mock = installAudioMock({ initialState: 'suspended' })
    const { playErrorSound } = await import('../src/services/audio')

    playErrorSound()

    expect(mock.resume).toHaveBeenCalledTimes(1)
  })

  it('não faz nada (sem lançar) quando o navegador não suporta Web Audio', async () => {
    installAudioMock({ supported: false })
    const { playErrorSound } = await import('../src/services/audio')

    expect(() => playErrorSound()).not.toThrow()
  })

  it('não faz nada quando o som está desabilitado por volume zero', async () => {
    const mock = installAudioMock()
    const { playErrorSound } = await import('../src/services/audio')

    playErrorSound(0)

    expect(mock.createOscillator).not.toHaveBeenCalled()
  })
})
