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

const MAX_LENGTH = 900
/** Proporção mínima esperada do tamanho pedido (evita aceitar resposta truncada). */
const MIN_LENGTH_RATIO = 0.6

/** Níveis de vocabulário usados no formato "Somente palavras". */
const WORD_LEVEL_HINTS: Record<LevelId, string> = {
  beginner: 'palavras curtas e simples do dia a dia',
  basic: 'palavras simples e comuns, algumas com acento',
  intermediate: 'palavras de uso médio, com acentuação',
  advanced: 'palavras menos frequentes e mais longas',
  expert: 'palavras longas, raras ou técnicas',
}

/** Tamanho alvo do conteúdo gerado, em caracteres. */
export type TextSizeId = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800

/** Opções de tamanho (em caracteres) exibidas no modal, em ordem crescente. */
export const TEXT_SIZE_OPTIONS: TextSizeId[] = [100, 200, 300, 400, 500, 600, 700, 800]

/** Formato do conteúdo gerado. */
export type ContentFormatId = 'text' | 'words'

export interface ContentFormatOption {
  id: ContentFormatId
  label: string
  description: string
}

export const CONTENT_FORMAT_OPTIONS: ContentFormatOption[] = [
  { id: 'text', label: 'Texto', description: 'Frases e parágrafos completos.' },
  { id: 'words', label: 'Somente palavras', description: 'Palavras isoladas, sem frases.' },
]

/** Opções extras de conteúdo do texto gerado. */
export interface TextFilters {
  size: TextSizeId
  /** Texto intencionalmente rico em acentos e cedilha (treino ABNT). */
  accentHeavy: boolean
  /** Inclui números, datas, valores e símbolos (treino da linha numérica). */
  withNumbers: boolean
  /** Formato do conteúdo: texto corrido ou somente palavras isoladas. */
  format: ContentFormatId
  /**
   * No formato "Somente palavras", restringe 100% das palavras ao lado
   * escolhido (esquerdo/direito). Sem efeito nos demais formatos.
   */
  wordsSideOnly: boolean
}

export const DEFAULT_TEXT_FILTERS: TextFilters = {
  size: 300,
  accentHeavy: false,
  withNumbers: false,
  format: 'text',
  wordsSideOnly: false,
}

/**
 * Linhas de instrução já resolvidas pelo foco de treino (produzidas por
 * planFocus). O buildPrompt não conhece os ids do foco: recebe as linhas prontas.
 */
export interface FocusPrompt {
  preLines: string[]
  postLines: string[]
}

/** Comprimento mínimo aceitável para o tamanho pedido. */
function minLengthFor(size: TextSizeId): number {
  return Math.max(50, Math.round(size * MIN_LENGTH_RATIO))
}

export function buildPrompt(
  level: Level,
  topicHint?: string,
  filters: TextFilters = DEFAULT_TEXT_FILTERS,
  focus?: FocusPrompt,
  historyText?: string,
): string {
  const topic = topicHint?.trim()
  const words = filters.format === 'words'
  const lines = [
    'Você gera conteúdo em português do Brasil usado em testes de digitação.',
    'Regras obrigatórias:',
  ]

  if (words) {
    lines.push('- Responda APENAS com palavras isoladas, separadas por um único espaço.')
    lines.push('- Não forme frases nem parágrafos e não use pontuação de nenhum tipo.')
    lines.push('- Não use Markdown, listas, numeração, emojis, código, URLs ou nomes próprios estrangeiros.')
    lines.push(`- Escreva cerca de ${filters.size} caracteres no total, com ${WORD_LEVEL_HINTS[level.id]}.`)
  } else {
    lines.push('- Responda APENAS com o texto corrido, sem título, sem saudação, sem explicação.')
    lines.push('- Responda exclusivamente em português do Brasil, mesmo que o tema contenha palavras em outras línguas.')
    lines.push('- Não use Markdown, listas, numeração, emojis, código, URLs ou nomes próprios estrangeiros.')
    lines.push(`- Escreva em parágrafo único com cerca de ${filters.size} caracteres, com ${LEVEL_HINTS[level.id]}.`)
  }
  lines.push('- Use acentuação correta do português (á, à, â, ã, é, ê, í, ó, ô, õ, ú, ç).')

  if (filters.accentHeavy) {
    lines.push('- Priorize palavras com acentos e cedilha (á, ã, ç, ê, é, ó, ô, õ): pelo menos um terço das palavras deve conter acento ou cedilha.')
  }
  if (filters.withNumbers) {
    lines.push('- Inclua números naturais no conteúdo: datas, horários, quantidades, valores em reais e medidas; use também alguns parênteses e percentuais.')
  }
  if (focus) {
    for (const line of focus.preLines) lines.push(`- ${line}`)
  }
  if (historyText?.trim()) {
    lines.push(`- Dados de desempenho do usuário nesta aplicação: ${historyText.trim()}`)
    lines.push('- Use esses dados com prioridade: o conteúdo deve treinar exatamente os pontos fracos listados, mantendo o português natural.')
  }
  if (focus) {
    for (const line of focus.postLines) lines.push(`- ${line}`)
  }

  if (words) {
    lines.push('- Importante: independentemente das instruções de foco acima, responda apenas com palavras isoladas, sem formar frases.')
  }

  lines.push(topic ? (words ? `- Tema das palavras: ${topic}.` : `- Tema sugerido: ${topic}.`) : '- Escolha você mesmo um tema cotidiano, cultural ou científico variado.')
  return lines.join('\n')
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

/**
 * Sugere um modelo alternativo ao informado, garantindo que a sugestão
 * nunca seja igual ao modelo que acabou de falhar.
 */
export function suggestAlternativeModel(model: string | undefined): string {
  if (model && model.includes('gpt-oss-20b')) return 'openai/gpt-oss-120b'
  if (model && model.includes('gpt-oss-120b')) return 'openai/gpt-oss-20b'
  return 'openai/gpt-oss-120b'
}

export function mapHttpError(status: number, model?: string, apiMessage?: string): GroqError {
  // Normaliza o final da mensagem da API para não gerar pontuação dupla ("..").
  const detail = apiMessage ? ` Detalhe: ${apiMessage.replace(/[.\s]+$/, '')}.` : ''
  switch (status) {
    case 401:
    case 403:
      return new GroqError('unauthorized', 'Chave da API inválida ou sem permissão. Verifique a configuração.')
    case 404: {
      return new GroqError(
        'unknown',
        `O modelo "${model ?? 'escolhido'}" não foi encontrado ou foi descontinuado no Groq. ` +
          `Escolha outro modelo no modal (ex.: ${suggestAlternativeModel(model)}) e tente novamente.` +
          detail,
      )
    }
    case 429:
      return new GroqError('rate-limit', 'Limite de uso da API atingido. Tente novamente em instantes.')
    case 500:
    case 502:
    case 503:
      return new GroqError('server', 'O serviço de IA está indisponível no momento. Tente novamente mais tarde.')
    default:
      return new GroqError('unknown', `A API respondeu com erro (código ${status}).${detail}`)
  }
}

/**
 * Lê a mensagem de erro do corpo da resposta do Groq
 * ({ error: { message } }), tolerante a corpos inesperados.
 */
export async function readApiErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const data: unknown = await response.json()
    const message = (data as { error?: { message?: unknown } })?.error?.message
    if (typeof message === 'string' && message.trim()) {
      return message.trim().slice(0, 200)
    }
  } catch {
    // Corpo não-JSON: sem detalhe extra.
  }
  return undefined
}

export interface GenerateTextParams {
  config: GroqConfig
  level: LevelId
  topicHint?: string
  filters?: TextFilters
  /** Linhas de foco já resolvidas pelo painel (ver planFocus). */
  focus?: FocusPrompt
  /** Resumo do desempenho do usuário (erros por letra), quando o foco pede histórico. */
  performanceData?: string
  signal?: AbortSignal
}

/** Gera um texto para digitação. Lança GroqError com mensagem amigável. */
export async function generateTypingText(params: GenerateTextParams): Promise<string> {
  const { config, level, topicHint, filters = DEFAULT_TEXT_FILTERS, focus, performanceData, signal } = params
  if (!config.apiKey.trim()) {
    throw new GroqError('no-key', 'Configure sua chave da API do Groq para usar geração por IA.')
  }

  let response: Response
  try {
    response = await fetchWithTimeout({
      model: config.model,
      apiKey: config.apiKey.trim(),
      prompt: buildPrompt(getLevel(level), topicHint, filters, focus, performanceData),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new GroqError('offline', 'Sem conexão com a internet. A geração por IA está indisponível.')
  }

  if (!response.ok) {
    const apiMessage = await readApiErrorMessage(response)
    throw mapHttpError(response.status, config.model, apiMessage)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new GroqError('invalid-response', 'A IA respondeu em um formato inesperado. Tente novamente.')
  }

  const { content, finishReason, hasReasoning } = extractContent(data)

  if (!content) {
    // Modelos de raciocínio (GPT-OSS) às vezes gastam todo o orçamento de
    // tokens no raciocínio e devolvem conteúdo vazio. O pedido já limita o
    // esforço de raciocínio; aqui orientamos a tentar de novo.
    const suggestion = suggestAlternativeModel(config.model)
    const reasoningEmpty = hasReasoning || finishReason === 'length'
    throw new GroqError(
      'invalid-response',
      reasoningEmpty
        ? `O modelo "${config.model}" não produziu texto desta vez. Tente gerar novamente; se persistir, escolha outro modelo (ex.: ${suggestion}).`
        : 'A IA não retornou um texto utilizável. Tente novamente.',
    )
  }

  const sanitized = sanitizeGeneratedText(content)
  const minLength = minLengthFor(filters.size)
  if (sanitized.length < minLength) {
    throw new GroqError(
      'invalid-response',
      `O conteúdo gerado veio curto demais (${sanitized.length} caracteres) para o tamanho escolhido. Tente novamente ou escolha outro modelo.`,
    )
  }
  return sanitized.slice(0, MAX_LENGTH)
}

/**
 * Modelos com raciocínio interno (por exemplo GPT-OSS) gastam tokens de
 * raciocínio dentro do orçamento de saída e podem retornar conteúdo vazio.
 */
export function isReasoningModel(model: string): boolean {
  return model.includes('gpt-oss')
}

/** Teto de tokens de saída. Folgado para caber raciocínio + texto. */
export const MAX_COMPLETION_TOKENS = 4096

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

/**
 * Monta o corpo da requisição ao endpoint compatível com OpenAI.
 * Para modelos de raciocínio (GPT-OSS), limita `reasoning_effort` a "low":
 * sem isso, o raciocínio consome todo o orçamento de saída e a resposta volta
 * com `content` vazio de forma intermitente.
 */
export function buildRequestBody(model: string, messages: ChatMessage[]): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.9,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
  }
  if (isReasoningModel(model)) body.reasoning_effort = 'low'
  return body
}

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
      body: JSON.stringify(
        buildRequestBody(args.model, [
          { role: 'system', content: args.prompt },
          { role: 'user', content: 'Gere um novo texto para o teste de digitação.' },
        ]),
      ),
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
    // O reasoning é o pensamento interno do modelo (tipicamente em inglês);
    // é sinalizado, mas NUNCA retornado como conteúdo utilizável.
    return {
      content: null,
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
