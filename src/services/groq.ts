import type { GroqConfig, Level, LevelId } from '../types/domain'
import { getLevel } from '../logic/levels'

/**
 * Integração isolada com a API do Groq.
 * Único ponto do app que depende de internet. Erros são mapeados
 * para mensagens amigáveis; a aplicação segue funcionando offline.
 */

export type GroqErrorKind =
  | 'no-key'
  | 'offline'
  | 'unauthorized'
  | 'rate-limit'
  | 'invalid-response'
  | 'server'
  | 'unknown'

export class GroqError extends Error {
  kind: GroqErrorKind
  constructor(kind: GroqErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

const API_URL = 'https://api.groq.com/openai/v1/chat/completions'
/** Tempo máximo de espera pela resposta (rede que "pendura" não deve travar o painel). */
const TIMEOUT_MS = 30_000

const LEVEL_HINTS: Record<LevelId, string> = {
  beginner: 'frases curtas (6 a 10 palavras), palavras simples e familiares, sem pontuação além do ponto final',
  basic: 'frases simples (10 a 18 palavras), alguns acentos e pontuação básica de vírgula e ponto',
  intermediate: 'frases de tamanho médio (14 a 22 palavras), acentuação frequente e pontuação variada',
  advanced: 'frases longas com subordinação, pontuação rica como travessões, dois-pontos e aspas, palavras menos frequentes',
  expert: 'frases complexas e longas, vocabulário sofisticado ou técnico, números, aspas, parênteses, hífen e travessão',
}

const MIN_LENGTH = 220
const MAX_LENGTH = 800

export function buildPrompt(level: Level, topicHint?: string): string {
  const topic = topicHint?.trim()
  return [
    'Você gera textos em português do Brasil usados em testes de digitação.',
    'Regras obrigatórias:',
    '- Responda APENAS com o texto corrido, sem título, sem saudação, sem explicação.',
    '- Não use Markdown, listas, numeração, emojis, código, URLs ou nomes próprios estrangeiros.',
    `- Escreva de 4 a 6 frases em parágrafo único, com ${LEVEL_HINTS[level.id]}.`,
    '- Use acentuação correta do português (á, à, â, ã, é, ê, í, ó, ô, õ, ú, ç).',
    topic ? `- Tema sugerido: ${topic}.` : '- Escolha você mesmo um tema cotidiano, cultural ou científico variado.',
  ].join('\n')
}

export function sanitizeGeneratedText(raw: string): string {
  let text = raw.normalize('NFC').trim()
  // Remove blocos Markdown e cercas de código, se vierem.
  text = text.replace(/```[\s\S]*?```/g, '').replace(/`([^`]*)`/g, '$1')
  // Remove marcadores de lista e numeração no começo das linhas.
  text = text.replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
  // Remove headers markdown.
  text = text.replace(/^#{1,6}\s+/gm, '')
  // Remove emojis.
  text = text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
  // Colapsa espaços e quebras múltiplas em parágrafo único.
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

function mapHttpError(status: number): GroqError {
  switch (status) {
    case 401:
    case 403:
      return new GroqError('unauthorized', 'Chave da API inválida ou sem permissão. Verifique a configuração.')
    case 429:
      return new GroqError('rate-limit', 'Limite de uso da API atingido. Tente novamente em instantes.')
    case 500:
    case 502:
    case 503:
      return new GroqError('server', 'O serviço de IA está indisponível no momento. Tente novamente mais tarde.')
    default:
      return new GroqError('unknown', `A API respondeu com erro (código ${status}).`)
  }
}

export interface GenerateTextParams {
  config: GroqConfig
  level: LevelId
  topicHint?: string
  signal?: AbortSignal
}

/** Gera um texto para digitação. Lança GroqError com mensagem amigável. */
export async function generateTypingText(params: GenerateTextParams): Promise<string> {
  const { config, level, topicHint, signal } = params
  if (!config.apiKey.trim()) {
    throw new GroqError('no-key', 'Configure sua chave da API do Groq para usar geração por IA.')
  }

  let response: Response
  try {
    response = await fetchWithTimeout({
      model: config.model,
      apiKey: config.apiKey.trim(),
      prompt: buildPrompt(getLevel(level), topicHint),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new GroqError('offline', 'Sem conexão com a internet. A geração por IA está indisponível.')
  }

  if (!response.ok) throw mapHttpError(response.status)

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new GroqError('invalid-response', 'A IA respondeu em um formato inesperado. Tente novamente.')
  }

  const { content, finishReason, hasReasoning } = extractContent(data)

  if (!content) {
    // Modelos racionadores podem gastar todo o orçamento de tokens em raciocínio
    // e não produzir texto. Erro distinto orienta o usuário a ajustar o modelo.
    if (hasReasoning || finishReason === 'length') {
      throw new GroqError(
        'invalid-response',
        `O modelo "${config.model}" gastou o limite de tokens sem produzir texto (modelo de raciocínio?). Escolha outro modelo nas configurações (ex.: llama-3.3-70b-versatile) e tente novamente.`,
      )
    }
    throw new GroqError('invalid-response', 'A IA não retornou um texto utilizável. Tente novamente.')
  }

  const sanitized = sanitizeGeneratedText(content)
  if (sanitized.length < MIN_LENGTH) {
    throw new GroqError(
      'invalid-response',
      `O texto gerado veio curto demais para o teste (${sanitized.length} caracteres). Tente novamente ou escolha outro modelo.`,
    )
  }
  return sanitized.slice(0, MAX_LENGTH)
}

/** Fetch com timeout: evita que uma rede sem resposta trave a geração indefinidamente. */
async function fetchWithTimeout(args: {
  model: string
  apiKey: string
  prompt: string
  signal?: AbortSignal
}): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), TIMEOUT_MS)
  const onExternalAbort = () => controller.abort()
  args.signal?.addEventListener('abort', onExternalAbort, { once: true })
  try {
    return await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        messages: [
          { role: 'system', content: args.prompt },
          { role: 'user', content: 'Gere um novo texto para o teste de digitação.' },
        ],
        temperature: 0.9,
        // Orçamento suficiente até para modelos com raciocínio.
        max_completion_tokens: 2048,
      }),
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timer)
    args.signal?.removeEventListener('abort', onExternalAbort)
  }
}

export interface ExtractedResponse {
  /** Conteúdo utilizável, ou null se ausente/vazio. */
  content: string | null
  /** Motivo de término informado pela API ("stop", "length", …). */
  finishReason: string | null
  /** Indica se o modelo produziu campo de raciocínio sem conteúdo. */
  hasReasoning: boolean
}

/**
 * Extrai o conteúdo de uma resposta compatível com OpenAI.
 * Tolerante a modelos racionadores: usa `reasoning` como fallback de texto
 * quando o `content` vem vazio (alguns modelos despejam a resposta ali).
 */
export function extractContent(data: unknown): ExtractedResponse {
  if (typeof data !== 'object' || data === null) {
    return { content: null, finishReason: null, hasReasoning: false }
  }
  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    return { content: null, finishReason: null, hasReasoning: false }
  }
  const choice = choices[0] as {
    message?: { content?: unknown; reasoning?: unknown }
    finish_reason?: unknown
  }
  const rawContent = choice.message?.content
  const content = typeof rawContent === 'string' && rawContent.trim() ? rawContent : null
  if (content) {
    return {
      content,
      finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : null,
      hasReasoning: false,
    }
  }
  const reasoning = choice.message?.reasoning
  if (typeof reasoning === 'string' && reasoning.trim()) {
    return {
      content: reasoning,
      finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : null,
      hasReasoning: true,
    }
  }
  return {
    content: null,
    finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : null,
    hasReasoning: true,
  }
}
