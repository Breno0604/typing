import { describe, expect, it } from 'vitest'
import { buildPrompt, extractContent, sanitizeGeneratedText, DEFAULT_TEXT_FILTERS, TEXT_SIZE_OPTIONS, mapHttpError, readApiErrorMessage } from '../src/services/groq'
import { migrateGroqModel, DEFAULT_GROQ_CONFIG } from '../src/storage/settings'
import { durationLabel, durationSeconds, MAX_CUSTOM_SECONDS, MIN_CUSTOM_SECONDS } from '../src/logic/durations'
import { getLevel } from '../src/logic/levels'
import { generateId } from '../src/utils/id'
import {
  buildPerformanceSummary,
  collectProblemChars,
  lettersForFingers,
  planFocus,
} from '../src/logic/focus'

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

  it('exige resposta em português do Brasil', () => {
    const prompt = buildPrompt(getLevel('basic'))
    expect(prompt).toContain('português do Brasil')
  })

  it('padrão usa o tamanho padrão sem menção a números nem acentos extras', () => {
    const prompt = buildPrompt(getLevel('basic'))
    expect(prompt).toContain(`${DEFAULT_TEXT_FILTERS.size} caracteres`)
    expect(prompt).not.toContain('Inclua números')
    expect(prompt).not.toContain('cedilha (á, ã, ç, ê, é, ó, ô, õ)')
  })

  it('cada opção de tamanho aparece no prompt', () => {
    for (const size of TEXT_SIZE_OPTIONS) {
      const prompt = buildPrompt(getLevel('basic'), undefined, { ...DEFAULT_TEXT_FILTERS, size })
      expect(prompt).toContain(`${size} caracteres`)
    }
  })

  it('tamanho pequeno e grande mudam a meta de caracteres', () => {
    expect(buildPrompt(getLevel('basic'), undefined, { ...DEFAULT_TEXT_FILTERS, size: 100 })).toContain('100 caracteres')
    expect(buildPrompt(getLevel('basic'), undefined, { ...DEFAULT_TEXT_FILTERS, size: 800 })).toContain('800 caracteres')
  })

  it('filtros extras entram no prompt', () => {
    const prompt = buildPrompt(getLevel('intermediate'), undefined, {
      size: 300,
      accentHeavy: true,
      withNumbers: true,
      format: 'text',
    })
    expect(prompt).toContain('cedilha (á, ã, ç, ê, é, ó, ô, õ)')
    expect(prompt).toContain('Inclua números')
  })

  it('formato "Somente palavras" pede palavras isoladas sem frases', () => {
    const prompt = buildPrompt(getLevel('basic'), undefined, { ...DEFAULT_TEXT_FILTERS, size: 200, format: 'words' })
    expect(prompt).toContain('palavras isoladas')
    expect(prompt).toContain('200 caracteres')
    expect(prompt).not.toContain('parágrafo único')
    expect(prompt).not.toContain('texto corrido')
  })

  it('formato "Texto" pede texto corrido sem a regra de palavras isoladas', () => {
    const prompt = buildPrompt(getLevel('basic'), undefined, { ...DEFAULT_TEXT_FILTERS, format: 'text' })
    expect(prompt).toContain('texto corrido')
    expect(prompt).toContain('parágrafo único')
    expect(prompt).not.toContain('palavras isoladas')
  })

  it('formato "Somente palavras" reforça a regra mesmo com foco', () => {
    const plan = planFocus({ objective: 'speed', side: null, toggles: [], fingers: [] })
    const prompt = buildPrompt(
      getLevel('basic'),
      undefined,
      { ...DEFAULT_TEXT_FILTERS, size: 200, format: 'words' },
      { preLines: plan.preLines, postLines: plan.postLines },
    )
    expect(prompt).toContain('palavras isoladas')
    expect(prompt).toContain('VELOCIDADE')
  })

  it('objetivo do foco entra como linha no prompt', () => {
    const plan = planFocus({ objective: 'speed', side: null, toggles: [], fingers: [] })
    const prompt = buildPrompt(getLevel('basic'), undefined, DEFAULT_TEXT_FILTERS, {
      preLines: plan.preLines,
      postLines: plan.postLines,
    })
    expect(prompt).toContain('VELOCIDADE')
  })

  it('interruptor de foco entra como linha no prompt', () => {
    const plan = planFocus({ objective: null, side: null, toggles: ['nearby-keys'], fingers: [] })
    const prompt = buildPrompt(getLevel('basic'), undefined, DEFAULT_TEXT_FILTERS, {
      preLines: plan.preLines,
      postLines: plan.postLines,
    })
    expect(prompt).toContain('TECLAS PRÓXIMAS')
  })

  it('sem foco não adiciona objetivo nem dados', () => {
    const prompt = buildPrompt(getLevel('basic'))
    expect(prompt).not.toContain('Objetivo:')
    expect(prompt).not.toContain('Dados de desempenho')
  })

  it('histórico entra com prioridade quando fornecido', () => {
    const plan = planFocus({ objective: null, side: null, toggles: ['worst-letters'], fingers: [] })
    const prompt = buildPrompt(
      getLevel('basic'),
      undefined,
      DEFAULT_TEXT_FILTERS,
      { preLines: plan.preLines, postLines: plan.postLines },
      'Histórico: "ç" (5 erros em 20)',
    )
    expect(prompt).toContain('Histórico: "ç" (5 erros em 20)')
    expect(prompt).toContain('prioridade')
  })

  it('foco baseado em histórico sem dados usa a estratégia padrão do objetivo', () => {
    const plan = planFocus({ objective: null, side: null, toggles: ['worst-letters'], fingers: [] })
    const prompt = buildPrompt(getLevel('basic'), undefined, DEFAULT_TEXT_FILTERS, {
      preLines: plan.preLines,
      postLines: plan.postLines,
    })
    expect(prompt).toContain('LETRAS COM MAIS ERROS')
    expect(prompt).toContain('classicamente difíceis')
  })
})

describe('focus helpers', () => {
  it('agrega charStats do histórico por caractere e ordena por erros', () => {
    const results = [
      { metrics: { charStats: [
        { char: 'a', attempts: 50, errors: 2 },
        { char: 'ç', attempts: 10, errors: 5 },
      ] } },
      { metrics: { charStats: [
        { char: 'ç', attempts: 8, errors: 3 },
        { char: 'm', attempts: 40, errors: 4 },
      ] } },
    ]
    const problems = collectProblemChars(results)
    expect(problems[0].char).toBe('ç')
    expect(problems[0].errors).toBe(8)
    expect(problems[0].attempts).toBe(18)
    expect(problems.find((p) => p.char === 'a')).toBeTruthy()
    // Caracteres sem erro não entram.
    expect(problems.find((p) => p.char === 'x')).toBeUndefined()
  })

  it('espaço é rotulado como "espaço" no resumo de desempenho', () => {
    const summary = buildPerformanceSummary([
      { metrics: { charStats: [{ char: ' ', attempts: 100, errors: 6 }] } },
    ])
    expect(summary).toContain('espaço')
    expect(summary).not.toContain('" "')
  })

  it('resumo vazio quando não há erros no histórico', () => {
    expect(buildPerformanceSummary([{ metrics: { charStats: [{ char: 'a', attempts: 10, errors: 0 }] } }])).toBe('')
    expect(buildPerformanceSummary([])).toBe('')
  })

  it('lettersForFingers junta as letras dos dedos escolhidos', () => {
    const letters = lettersForFingers(['pinky', 'thumb'])
    expect(letters).toContain('q')
    expect(letters).toContain('ç')
    expect(letters).toContain(' ')
    expect(letters).not.toContain('w')
  })
})

describe('erros da API e migração de modelo', () => {
  it('404 explica que o modelo foi descontinuado e sugere outro', () => {
    const err = mapHttpError(404, 'llama-3.3-70b-versatile')
    expect(err.message).toContain('llama-3.3-70b-versatile')
    expect(err.message).toContain('descontinuado')
    expect(err.message).toContain('openai/gpt-oss-120b')
  })

  it('404 anexa a mensagem detalhada da API quando presente', () => {
    const err = mapHttpError(404, 'modelo-x', 'Model not found')
    expect(err.message).toContain('Model not found')
  })

  it('404 com o modelo recomendado selecionado sugere o alternativo', () => {
    const err = mapHttpError(404, 'openai/gpt-oss-120b')
    expect(err.message).toContain('openai/gpt-oss-20b')
    expect(err.message).not.toContain('(ex.: openai/gpt-oss-120b)')
  })

  it('404 com detalhe terminado em ponto não gera pontuação dupla', () => {
    const err = mapHttpError(404, 'modelo-x', 'Model deprecated.')
    expect(err.message).toContain('Detalhe: Model deprecated.')
    expect(err.message).not.toContain('..')
  })

  it('demais códigos continuam com as mensagens amigáveis já existentes', () => {
    expect(mapHttpError(401).message).toContain('Chave da API')
    expect(mapHttpError(429).message).toContain('Limite de uso')
    expect(mapHttpError(500).message).toContain('indisponível')
    expect(mapHttpError(418).message).toContain('código 418')
  })

  it('readApiErrorMessage extrai error.message e tolera corpo inválido', async () => {
    const ok = new Response(JSON.stringify({ error: { message: 'Model not found' } }), { status: 404 })
    expect(await readApiErrorMessage(ok)).toBe('Model not found')
    const bad = new Response('não é json', { status: 500 })
    expect(await readApiErrorMessage(bad)).toBeUndefined()
    const noMsg = new Response('{}', { status: 500 })
    expect(await readApiErrorMessage(noMsg)).toBeUndefined()
  })

  it('migra modelos descontinuados do Groq para o padrão atual', () => {
    expect(migrateGroqModel('llama-3.3-70b-versatile')).toBe('openai/gpt-oss-120b')
    expect(migrateGroqModel('llama-3.1-8b-instant')).toBe('openai/gpt-oss-20b')
    // Modelo custom desconhecido é mantido.
    expect(migrateGroqModel('outro/modelo')).toBe('outro/modelo')
    // Vazio/indefinido cai no padrão.
    expect(migrateGroqModel(undefined)).toBe(DEFAULT_GROQ_CONFIG.model)
    expect(migrateGroqModel('  ')).toBe(DEFAULT_GROQ_CONFIG.model)
  })

  it('padrão atual não é um modelo descontinuado', () => {
    expect(DEFAULT_GROQ_CONFIG.model).toBe('openai/gpt-oss-120b')
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

  it('NÃO usa o campo reasoning como conteúdo (é metalinguagem, geralmente em inglês)', () => {
    const data = { choices: [{ message: { content: '', reasoning: 'We need to output a single paragraph' } }] }
    const r = extractContent(data)
    expect(r.content).toBeNull()
    expect(r.hasReasoning).toBe(true)
  })

  it('preserva finish_reason quando só há reasoning', () => {
    const data = { choices: [{ finish_reason: 'length', message: { reasoning: 'pensou e escreveu no reasoning' } }] }
    const r = extractContent(data)
    expect(r.content).toBeNull()
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
