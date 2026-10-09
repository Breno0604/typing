import { describe, expect, it } from 'vitest'
import { DEFAULT_AI_PREFS, normalizeAiPrefs } from '../src/storage/aiPrefs'

describe('normalizeAiPrefs', () => {
  it('sem dados salvos retorna os padrões', () => {
    const prefs = normalizeAiPrefs(undefined)
    expect(prefs).toEqual(DEFAULT_AI_PREFS)
  })

  it('mescla campos salvos sobre os padrões', () => {
    const prefs = normalizeAiPrefs({
      focus: { objective: 'speed', side: null, toggles: ['rare-keys'], fingers: [] },
      withNumbers: true,
    })
    expect(prefs.focus.objective).toBe('speed')
    expect(prefs.focus.toggles).toEqual(['rare-keys'])
    expect(prefs.withNumbers).toBe(true)
    expect(prefs.size).toBe(DEFAULT_AI_PREFS.size)
    expect(prefs.accentHeavy).toBe(DEFAULT_AI_PREFS.accentHeavy)
    expect(prefs.format).toBe(DEFAULT_AI_PREFS.format)
  })

  it('mantém tamanho e formato válidos salvos', () => {
    const prefs = normalizeAiPrefs({ size: 800, format: 'words' })
    expect(prefs.size).toBe(800)
    expect(prefs.format).toBe('words')
  })

  it('converte tamanhos antigos (por nome) para a escala em caracteres', () => {
    expect(normalizeAiPrefs({ size: 'long' as never }).size).toBe(800)
    expect(normalizeAiPrefs({ size: 'short' as never }).size).toBe(300)
  })

  it('descarta tamanho e formato inválidos', () => {
    const prefs = normalizeAiPrefs({ size: 999 as never, format: 'x' as never })
    expect(prefs.size).toBe(DEFAULT_AI_PREFS.size)
    expect(prefs.format).toBe(DEFAULT_AI_PREFS.format)
  })
})
