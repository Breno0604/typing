import type {
  CharStatEntry,
  FingerId,
  FocusToggleId,
  ObjectiveId,
  SideId,
  TrainingFocus,
} from '../types/domain'

/** Dedos do teclado escolhíveis no foco "Dedos específicos". */
export const FINGER_OPTIONS: { id: FingerId; label: string }[] = [
  { id: 'pinky', label: 'Mindinho' },
  { id: 'ring', label: 'Anelar' },
  { id: 'middle', label: 'Médio' },
  { id: 'index', label: 'Indicador' },
  { id: 'thumb', label: 'Polegar (espaço)' },
]

/**
 * Mapa de letras do teclado ABNT2 por dedo (ambas as mãos). Acentos com
 * dead key (´ ^ ~) e c-cedilha ficam no anelar/médio conforme o layout.
 */
const FINGER_LETTERS: Record<FingerId, string[]> = {
  pinky: ['q', 'a', 'z', 'p', 'ç'],
  ring: ['w', 's', 'x', 'o'],
  middle: ['e', 'd', 'c', 'i', 'k'],
  index: ['r', 'f', 'v', 't', 'g', 'b', 'u', 'j', 'm', 'h', 'n', 'y'],
  thumb: [' '],
}

/** Letras dominadas por cada dedo (união das duas mãos), para o prompt. */
export function lettersForFingers(fingers: FingerId[]): string {
  const set = new Set<string>()
  for (const f of fingers) for (const ch of FINGER_LETTERS[f]) set.add(ch)
  return [...set].join(' ')
}

/**
 * Agrega o histórico de sessões em letras problemáticas: erros por
 * caractere, letras que mais erram primeiro. Igual ao CharStatsDialog.
 */
export interface ProblemChar {
  char: string
  attempts: number
  errors: number
  errorRate: number
}

export function collectProblemChars(results: { metrics?: { charStats?: CharStatEntry[] } | null }[]): ProblemChar[] {
  const agg = new Map<string, { attempts: number; errors: number }>()
  for (const r of results) {
    for (const cs of r.metrics?.charStats ?? []) {
      const prev = agg.get(cs.char) ?? { attempts: 0, errors: 0 }
      prev.attempts += cs.attempts
      prev.errors += cs.errors
      agg.set(cs.char, prev)
    }
  }
  return [...agg.entries()]
    .map(([char, v]) => ({ char, ...v, errorRate: v.attempts > 0 ? v.errors / v.attempts : 0 }))
    .filter((c) => c.errors > 0)
    .sort((a, b) => b.errors - a.errors || b.errorRate - a.errorRate)
}

/**
 * Resumo compacto do desempenho do usuário para o prompt da IA.
 * vazio quando não há dados.
 */
export function buildPerformanceSummary(results: { metrics?: { charStats?: CharStatEntry[] } | null }[]): string {
  const worst = collectProblemChars(results).slice(0, 8)
  if (worst.length === 0) return ''
  const list = worst
    .map((c) => {
      const shown = c.char === ' ' ? 'espaço' : `"${c.char}"`
      return `${shown} (${c.errors} erros em ${c.attempts})`
    })
    .join(', ')
  return `Histórico de erros do usuário (caractere: erros/tentativas): ${list}.`
}

/** Estado de foco "vazio" (nada escolhido). Não mutar diretamente. */
export const EMPTY_FOCUS: TrainingFocus = {
  objective: null,
  side: null,
  toggles: [],
  fingers: [],
}

export interface ObjectiveOption {
  id: ObjectiveId
  label: string
  hint: string
}

/** Objetivos de escolha única (o usuário escolhe no máximo um). */
export const OBJECTIVE_OPTIONS: ObjectiveOption[] = [
  {
    id: 'speed',
    label: 'Velocidade',
    hint: 'Objetivo: VELOCIDADE. Use palavras curtas e muito comuns do português, sílabas simples e frases fluidas, com poucas letras raras ou sequências incomuns; o texto deve permitir digitar em ritmo constante.',
  },
  {
    id: 'accuracy',
    label: 'Precisão',
    hint: 'Objetivo: PRECISÃO. Inclua muitas palavras com pares de letras comumente confundidos (rn/m, i/l, cl/d, b/p, m/n, v/w, h silencioso) e acentuação frequente, para exigir atenção e reduzir erros.',
  },
  {
    id: 'balance',
    label: 'Equilíbrio',
    hint: 'Objetivo: EQUILÍBRIO. Combine variedade: palavras comuns e raras, acentos frequentes, alternância de mãos e algumas combinações difíceis, mantendo o texto natural e pronunciável.',
  },
]

export interface SideOption {
  id: SideId
  label: string
  hint: string
}

/** Lados de escolha única (o usuário escolhe no máximo um). */
export const SIDE_OPTIONS: SideOption[] = [
  {
    id: 'left',
    label: 'Mão esquerda',
    hint: 'Objetivo: MÃO ESQUERDA. A maioria das letras deve ser digitada com a mão esquerda (q w e r t, a s d f g, z x c v b, e acentos que as acompanham); espalhe vogais entre consoantes da mão esquerda para formar palavras pronunciáveis.',
  },
  {
    id: 'right',
    label: 'Mão direita',
    hint: 'Objetivo: MÃO DIREITA. A maioria das letras deve ser digitada com a mão direita (y u i o p, h j k l ç, n m); espalhe vogais entre consoantes da mão direita para formar palavras pronunciáveis.',
  },
]

export interface FocusToggleOption {
  id: FocusToggleId
  label: string
  description: string
  hint: string
  /** O treino se beneficia do histórico de erros do usuário. */
  usesHistory?: boolean
  /** Abre a escolha de dedos quando ligado. */
  asksFingers?: boolean
}

/** Interruptores combináveis do "Foco do treino", na ordem de exibição. */
export const FOCUS_TOGGLE_OPTIONS: FocusToggleOption[] = [
  {
    id: 'worst-letters',
    label: 'Letras com mais erros',
    description: 'Prioriza as letras em que você mais erra (usa seu histórico).',
    hint: 'Objetivo: LETRAS COM MAIS ERROS DO USUÁRIO. Repita com naturalidade, em várias palavras diferentes, as letras problemáticas indicadas nos dados de desempenho abaixo; se nenhum dado for fornecido, priorize letras classicamente difíceis (ç, acentos, q, z, x, h).',
    usesHistory: true,
  },
  {
    id: 'worst-combos',
    label: 'Combinações difíceis',
    description: 'Sequências de letras em que você mais erra (usa seu histórico).',
    hint: 'Objetivo: COMBINAÇÕES DIFÍCEIS DO USUÁRIO. Construa palavras e sequências que explorem os pares e trigramas problemáticos indicados nos dados de desempenho abaixo; se nenhum dado for fornecido, use combinações classicamente difíceis (rr, ss, ç, ões, nh, lh, ch, xs).',
    usesHistory: true,
  },
  {
    id: 'nearby-keys',
    label: 'Teclas próximas',
    description: 'Sequências de teclas vizinhas no teclado, fáceis de confundir.',
    hint: 'Objetivo: TECLAS PRÓXIMAS. Inclua sequências de teclas fisicamente vizinhas e fáceis de confundir (q/w, a/s, e/r, u/i, o/p, d/f, j/k, c/v, n/m, h/j) dentro de palavras e entre palavras seguidas.',
  },
  {
    id: 'rare-keys',
    label: 'Teclas pouco usadas',
    description: 'Letras raras como k, w, y e z, que aparecem pouco no dia a dia.',
    hint: 'Objetivo: TECLAS POUCO USADAS. Priorize letras raras do português (k, w, y, z e dígrafos incomuns) em palavras reais como kiwi, yogurt, show, zigzag, zumbido, Webster — sem inventar palavras estrangeiras sem sentido.',
  },
  {
    id: 'hand-alternation',
    label: 'Alternância entre mãos',
    description: 'Palavras que trocam de mão a cada letra.',
    hint: 'Objetivo: ALTERNÂNCIA ENTRE MÃOS. Prefira palavras em que as letras alternam entre mão esquerda e direita quase a cada tecla (ex.: dar, teclado, fotografar, musical — padrão mão esquerda/direita alternado); escreva palavras reais em português.',
  },
  {
    id: 'specific-fingers',
    label: 'Dedos específicos',
    description: 'Exercícios para os dedos que você escolher.',
    hint: 'Objetivo: DEDOS ESPECÍFICOS. A maioria das letras deve ser digitada com os dedos indicados nos dados de desempenho abaixo; combine-as com vogais para formar palavras pronunciáveis e evite depender demais dos outros dedos.',
    asksFingers: true,
  },
]

export interface FocusPlan {
  /** Linhas de instrução que entram antes do texto de desempenho. */
  preLines: string[]
  /** Linhas de instrução que entram depois do texto de desempenho. */
  postLines: string[]
  /** O texto deve usar o histórico de erros do usuário. */
  usesHistory: boolean
  /** Avisos mostrados ao usuário (não bloqueiam a geração). */
  warnings: string[]
  /** A geração está bloqueada. */
  blocked: boolean
  /** Mensagem explicando o bloqueio. */
  blockMessage?: string
}

const HARD_TOGGLES: FocusToggleId[] = ['worst-combos', 'rare-keys']
const DIFFICULT_TOGGLES: FocusToggleId[] = ['worst-combos', 'nearby-keys', 'rare-keys']
const MAX_TOGGLES_WITHOUT_WARNING = 4

/**
 * Converte o estado do foco nas linhas de instrução do prompt, avisos e
 * decisão sobre o uso do histórico. Função pura, sem dependências de UI.
 */
export function planFocus(focus: TrainingFocus): FocusPlan {
  const preLines: string[] = []
  const postLines: string[] = []
  let usesHistory = false

  const objective = focus.objective
    ? OBJECTIVE_OPTIONS.find((o) => o.id === focus.objective)
    : undefined
  if (objective) preLines.push(objective.hint)

  const side = focus.side ? SIDE_OPTIONS.find((o) => o.id === focus.side) : undefined
  if (side) preLines.push(side.hint)

  for (const t of focus.toggles) {
    const option = FOCUS_TOGGLE_OPTIONS.find((o) => o.id === t)
    if (!option) continue
    preLines.push(option.hint)
    if (option.usesHistory) usesHistory = true
  }

  const asksFingers = focus.toggles.includes('specific-fingers')
  const fingers = focus.fingers

  let blocked = false
  let blockMessage: string | undefined
  if (asksFingers && fingers.length === 0) {
    blocked = true
    blockMessage = 'Escolha ao menos um dedo para apoiar o treino de "Dedos específicos".'
  }

  if (asksFingers && fingers.length > 0) {
    const names = fingers
      .map((f) => FINGER_OPTIONS.find((o) => o.id === f)?.label ?? f)
      .join(', ')
    const letters = lettersForFingers(fingers)
    postLines.push(`Dados de desempenho (dedos do treino): dedos ${names}. Priorize as letras: ${letters}.`)
  }

  const focusItemCount = preLines.length + (asksFingers && fingers.length > 0 ? 1 : 0)
  if (focusItemCount >= 2) {
    postLines.push(
      'Combine todos os objetivos acima na mesma passagem de texto, produzindo um material único, coeso e legível.',
    )
  }

  const warnings: string[] = []
  if (objective?.id === 'speed' && focus.toggles.some((t) => DIFFICULT_TOGGLES.includes(t))) {
    warnings.push(
      'Dica: velocidade e treino difícil são opostos. Você pode preferir desligar um deles para focar.',
    )
  }
  if (focus.toggles.length > MAX_TOGGLES_WITHOUT_WARNING) {
    warnings.push(
      'Há muitos interruptores ligados; isso pode diluir o treino. Considere focar em poucos por vez.',
    )
  }
  const hardCount = focus.toggles.filter((t) => HARD_TOGGLES.includes(t)).length
  if (hardCount >= 2) {
    warnings.push('Você combinou vários treinos difíceis; o texto pode ficar pouco natural.')
  }

  return { preLines, postLines, usesHistory, warnings, blocked, blockMessage }
}
