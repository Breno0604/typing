import { describe, expect, it } from 'vitest'
import { buildPrompt, extractContent, sanitizeGeneratedText, DEFAULT_TEXT_FILTERS } from '../src/services/groq'
import { durationLabel, durationSeconds, MAX_CUSTOM_SECONDS, MIN_CUSTOM_SECONDS } from '../src/logic/durations'
import { getLevel } from '../src/logic/levels'
import { generateId } from '../src/utils/id'

describe('sanitizeGeneratedText', () => {
  it('remove cercas de código e blocos markdown', () => {
    const out = sanitizeGeneratedText('```\ntexto em código\n```')
    expect(out).not.toContain('```')
  })

  it('remove marcadores de lista e numeração no início das linhas', () => {
    const out = sanitizeGeneratedText('- primeiro item\n* segundo item\n1. terceiro item')
    expect(out).toBe('primeiro item segundo item terceiro item')
  })

  it('remove headers markdown e emojis', () => {
    const out = sanitizeGeneratedText('## Título\nTexto com emoji 🎉 no meio.')
    expect(out).toBe('Título Texto com emoji no meio.')
  })

  it('colapsa espaços e quebras em parágrafo único', () => {
    const out = sanitizeGeneratedText('Frase   uma.\n\n\nFrase   duas.')
    expect(out).toBe('Frase uma. Frase duas.')
  })

  it('preserva acentos e caracteres do português', () => {
    const out = sanitizeGeneratedText('Ação, coração, ônibus, você e pingüim.')
    expect(out).toContain('Ação')
    expect(out).toContain('ônibus')
  })
})

describe('buildPrompt', () => {
  it('inclui regras anti-lista/anti-markdown e o nível', () => {
    const prompt = buildPrompt(getLevel('advanced'), 'cidades')
    expect(prompt).toContain('APENAS com o texto corrido')
    expect(prompt).toContain('cidades')
  })

  it('padrão usa tamanho médio e estilo cotidiano sem menção a números', () => {
    const prompt = buildPrompt(getLevel('basic'))
    expect(prompt).toContain('450 caracteres')
    expect(prompt).toContain('cotidiano')
    expect(prompt).not.toContain('Inclua números')
    expect(prompt).not.toContain('cedilha (á, ã, ç, ê, é, ó, ô, õ)')
  })

  it('tamanho curto e longo mudam a meta de caracteres', () => {
    expect(buildPrompt(getLevel('basic'), undefined, { ...DEFAULT_TEXT_FILTERS, size: 'short' })).toContain('250 caracteres')
    expect(buildPrompt(getLevel('basic'), undefined, { ...DEFAULT_TEXT_FILTERS, size: 'long' })).toContain('800 caracteres')
  })

  it('filtros extras entram no prompt', () => {
    const prompt = buildPrompt(getLevel('intermediate'), undefined, {
      size: 'medium',
      style: 'journalistic',
      accentHeavy: true,
      withNumbers: true,
    })
    expect(prompt).toContain('jornalístico')
    expect(prompt).toContain('cedilha (á, ã, ç, ê, é, ó, ô, õ)')
    expect(prompt).toContain('Inclua números')
  })

  it('estilo literário pede frases corridas', () => {
    const prompt = buildPrompt(getLevel('intermediate'), undefined, {
      ...DEFAULT_TEXT_FILTERS,
      style: 'literary',
    })
    expect(prompt).toContain('literário')
    expect(prompt).toContain('sem listas')
  })
})

describe('extractContent', () => {
  it('extrai conteúdo de resposta compatível com OpenAI', () => {
    const data = { choices: [{ message: { content: 'Texto válido.' } }] }
    expect(extractContent(data)).toEqual({ content: 'Texto válido.', finishReason: null, hasReasoning: false })
  })

  it('expõe o finish_reason quando presente', () => {
    const data = { choices: [{ finish_reason: 'length', message: { content: 'parcial' } }] }
    expect(extractContent(data).finishReason).toBe('length')
  })

  it('usa o campo reasoning como fallback quando content vem vazio', () => {
    const data = { choices: [{ message: { content: '', reasoning: 'texto despejado no raciocínio' } }] }
    const r = extractContent(data)
    expect(r.content).toBe('texto despejado no raciocínio')
    expect(r.hasReasoning).toBe(true)
  })

  it('sinaliza hasReasoning no fallback e finish_reason preservado', () => {
    const data = { choices: [{ finish_reason: 'length', message: { reasoning: 'pensou e escreveu no reasoning' } }] }
    const r = extractContent(data)
    expect(r.content).toBe('pensou e escreveu no reasoning')
    expect(r.hasReasoning).toBe(true)
    expect(r.finishReason).toBe('length')
  })

  it('sinaliza modelo racionador sem conteúdo nem reasoning', () => {
    const data = { choices: [{ finish_reason: 'length', message: { reasoning: '' } }] }
    const r = extractContent(data)
    expect(r.content).toBeNull()
    expect(r.hasReasoning).toBe(true)
    expect(r.finishReason).toBe('length')
  })

  it('retorna vazio para respostas malformadas', () => {
    expect(extractContent(null).content).toBeNull()
    expect(extractContent({}).content).toBeNull()
    expect(extractContent({ choices: [] }).content).toBeNull()
    expect(extractContent({ choices: [{ message: {} }] }).content).toBeNull()
    expect(extractContent({ choices: [{ message: { content: 42 } }] }).content).toBeNull()
  })
})

describe('durationSeconds', () => {
  it('opções rápidas retornam os segundos corretos', () => {
    expect(durationSeconds('5', 0)).toBe(5)
    expect(durationSeconds('180', 0)).toBe(180)
  })

  it('sem limite retorna null', () => {
    expect(durationSeconds('unlimited', 0)).toBeNull()
  })

  it('personalizado aceita valores arbitrários', () => {
    expect(durationSeconds('custom', 45)).toBe(45)
    expect(durationSeconds('custom', 7)).toBe(7)
  })

  it('personalizado aplica clamp nos limites', () => {
    expect(durationSeconds('custom', 0)).toBe(MIN_CUSTOM_SECONDS)
    expect(durationSeconds('custom', -10)).toBe(MIN_CUSTOM_SECONDS)
    expect(durationSeconds('custom', 99_999)).toBe(MAX_CUSTOM_SECONDS)
  })

  it('id desconhecido cai no padrão de 15s', () => {
    expect(durationSeconds('999' as never, 0)).toBe(15)
  })
})

describe('durationLabel', () => {
  it('rotula os modos especiais', () => {
    expect(durationLabel('unlimited', 0)).toBe('Sem limite')
    expect(durationLabel('custom', 45)).toBe('Personalizado (45s)')
    expect(durationLabel('30', 0)).toBe('30 segundos')
  })
})

describe('generateId', () => {
  it('gera ids únicos com o prefixo informado', () => {
    const a = generateId('result')
    const b = generateId('result')
    expect(a).toMatch(/^result-/)
    expect(a).not.toBe(b)
  })
})
