# Plano: Foco do treino combinável (Objetivo + Lado + Interruptores)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o dropdown único de "Foco do treino" (12 opções) por grupos de escolha única (Objetivo, Lado) mais interruptores combináveis, com avisos de conflito e persistência entre sessões.

**Architecture:** Uma função pura `planFocus(focus)` concentra a lógica: converte o estado do foco nas linhas de instrução do prompt (`preLines`, `postLines`), decide se o histórico de erros deve ser usado (`usesHistory`), coleta avisos e diz se a geração está bloqueada. `buildPrompt` passa a ser genérico (recebe as linhas prontas + o texto de histórico), então não conhece os ids do foco. O painel (UI) só monta o estado e renderiza; a persistência acontece via um módulo de storage dedicado, nos mesmos moldes de `settings.ts`.

**Tech Stack:** React 18 + TypeScript + Vite, IndexedDB (wrapper próprio `src/storage/db.ts`), Vitest (ambiente node, sem jsdom).

**Fonte de verdade do design:** `docs/superpowers/specs/2026-10-08-foco-do-treino-design.md` (commit `686e570`).

---

## Restrições e convenções

- Shell da sessão é **cmd.exe**: não usar `;` para separar comandos nem `&&` do PowerShell. Usar comandos em linhas separadas ou `npm run x` isolado.
- Testes rodam em ambiente **node** (sem DOM, sem IndexedDB, sem jsdom/playwright). Só testar lógica pura.
- Há **mudanças não commitadas** pré-existentes no working tree (feature de áudio/backspace). **Não** commitar essas mudanças; cada commit deste plano deve incluir **apenas** os arquivos listados na tarefa.
- Não adicionar comentários novos no código além dos já existentes/necessários.
- Cada tarefa termina com a suíte verde (`npm test`), `npm run typecheck` e `npm run build`.

## Comandos de verificação

```cmd
npm test
npm run typecheck
npm run build
```

---

## Estrutura de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/types/domain.ts` | Modificar | Tipos puros novos (`TextSizeId`, `FingerId`, `ObjectiveId`, `SideId`, `FocusToggleId`, `TrainingFocus`, `AiGenPrefs`). |
| `src/services/groq.ts` | Modificar | `buildPrompt` genérico, remove `FOCUS_HINTS`/`FocusId`, `TextSizeId` passa a vir do domínio. |
| `src/logic/focus.ts` | Modificar | Metadata (`OBJECTIVE_OPTIONS`, `SIDE_OPTIONS`, `FOCUS_TOGGLE_OPTIONS`), `EMPTY_FOCUS`, `planFocus`. Remove código legado (Tarefa 5). |
| `src/components/AiGeneratePanel.tsx` | Reescrever | UI de grupos + interruptores + chips de dedos + avisos. |
| `src/components/ui/controls.tsx` | Modificar | Novo componente `ToggleRow`. |
| `src/storage/aiPrefs.ts` | Criar | Persistência do foco/filtros do painel. |
| `src/styles/app.css` | Modificar | Estilos do bloco de ajustes finos e avisos. |
| `tests/focus.test.ts` | Criar | Testes de `planFocus`. |
| `tests/groq.test.ts` | Modificar | Testes do novo `buildPrompt`. |
| `tests/aiPrefs.test.ts` | Criar | Teste de `normalizeAiPrefs`. |

---

## Tarefa 1: Modelo de domínio + `planFocus`

Objetivo: introduzir os tipos e a lógica pura do foco, com testes, sem quebrar nenhum export existente (aditivo).

**Files:**
- Modificar: `src/types/domain.ts`
- Modificar: `src/logic/focus.ts`
- Modificar: `src/services/groq.ts` (apenas mover `TextSizeId`)
- Modificar: `src/components/AiGeneratePanel.tsx` (apenas ajustar import de `TextSizeId`)
- Criar: `tests/focus.test.ts`

- [ ] **Passo 1: adicionar os tipos ao domínio**

Em `src/types/domain.ts`, acrescentar os tipos abaixo. Colocar `TextSizeId` junto dos demais tipos e os demais logo abaixo.

```ts
/** Tamanho alvo do texto gerado por IA. */
export type TextSizeId = 'short' | 'medium' | 'long'

/** Identificador de um dedo da mão. */
export type FingerId = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb'

/** Objetivo único de treino. */
export type ObjectiveId = 'speed' | 'accuracy' | 'balance'

/** Lado único de treino. */
export type SideId = 'left' | 'right'

/** Interruptores de treino combináveis. */
export type FocusToggleId =
  | 'worst-letters'
  | 'worst-combos'
  | 'nearby-keys'
  | 'rare-keys'
  | 'hand-alternation'
  | 'specific-fingers'

/** Conjunto de escolhas do "Foco do treino". */
export interface TrainingFocus {
  objective: ObjectiveId | null
  side: SideId | null
  toggles: FocusToggleId[]
  fingers: FingerId[]
}

/** Preferências persistidas do painel de geração por IA. */
export interface AiGenPrefs {
  focus: TrainingFocus
  size: TextSizeId
  accentHeavy: boolean
  withNumbers: boolean
}
```

- [ ] **Passo 2: apontar `groq.ts` para o `TextSizeId` do domínio**

Em `src/services/groq.ts`, garantir que `TextSizeId` é importado do domínio e **remover** a definição local.

Adicionar/ajustar o import (o import de tipos já existe; inclua `TextSizeId`):

```ts
import type { GroqConfig, Level, LevelId, TextSizeId } from '../types/domain'
```

Remover a linha que hoje define localmente:

```ts
export type TextSizeId = 'short' | 'medium' | 'long'
```

> Se houver referências a `TextSizeId` vindas de `'../services/groq'` em outros arquivos, atualizar o import para `'../types/domain'`. Há uma ocorrência em `src/components/AiGeneratePanel.tsx` (linha do import de tipos): trocar para importar `TextSizeId` de `'../types/domain'`.

- [ ] **Passo 3: escrever os testes de `planFocus` (antes da implementação)**

Criar `tests/focus.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { EMPTY_FOCUS, planFocus } from '../src/logic/focus'
import type { TrainingFocus } from '../src/types/domain'

const focus = (patch: Partial<TrainingFocus>): TrainingFocus => ({ ...EMPTY_FOCUS, ...patch })

describe('planFocus', () => {
  it('sem nenhuma escolha não gera linhas nem pede histórico', () => {
    const plan = planFocus(EMPTY_FOCUS)
    expect(plan.preLines).toEqual([])
    expect(plan.postLines).toEqual([])
    expect(plan.usesHistory).toBe(false)
    expect(plan.blocked).toBe(false)
    expect(plan.warnings).toEqual([])
  })

  it('objetivo e lado entram nas linhas pré-texto', () => {
    const plan = planFocus(focus({ objective: 'speed', side: 'left' }))
    const joined = plan.preLines.join(' ')
    expect(joined).toContain('VELOCIDADE')
    expect(joined).toContain('MÃO ESQUERDA')
  })

  it('interruptores combinam nas linhas pré-texto', () => {
    const plan = planFocus(focus({ toggles: ['rare-keys', 'nearby-keys'] }))
    const joined = plan.preLines.join(' ')
    expect(joined).toContain('TECLAS POUCO USADAS')
    expect(joined).toContain('TECLAS PRÓXIMAS')
  })

  it('interruptores de histórico marcam usesHistory', () => {
    expect(planFocus(focus({ toggles: ['worst-letters'] })).usesHistory).toBe(true)
    expect(planFocus(focus({ toggles: ['worst-combos'] })).usesHistory).toBe(true)
    expect(planFocus(focus({ toggles: ['rare-keys'] })).usesHistory).toBe(false)
  })

  it('duas ou mais escolhas geram uma linha de combinação no pós-texto', () => {
    const plan = planFocus(focus({ objective: 'accuracy', toggles: ['nearby-keys'] }))
    expect(plan.postLines.join(' ')).toContain('Combine')
  })

  it('uma única escolha não gera linha de combinação', () => {
    const plan = planFocus(focus({ objective: 'accuracy' }))
    expect(plan.postLines.join(' ')).not.toContain('Combine')
  })

  it('dedos específicos sem dedo escolhido bloqueia a geração', () => {
    const plan = planFocus(focus({ toggles: ['specific-fingers'] }))
    expect(plan.blocked).toBe(true)
    expect(plan.blockMessage).toBeTruthy()
  })

  it('dedos específicos com dedo escolhido gera a linha das letras', () => {
    const plan = planFocus(focus({ toggles: ['specific-fingers'], fingers: ['pinky'] }))
    expect(plan.blocked).toBe(false)
    const joined = plan.postLines.join(' ')
    expect(joined).toContain('Mindinho')
    expect(joined).toContain('q')
  })

  it('avisa conflito de velocidade com treino difícil', () => {
    const plan = planFocus(focus({ objective: 'speed', toggles: ['rare-keys'] }))
    expect(plan.warnings.length).toBeGreaterThan(0)
  })

  it('avisa quando há muitos interruptores ligados', () => {
    const plan = planFocus(
      focus({ toggles: ['worst-letters', 'worst-combos', 'nearby-keys', 'rare-keys', 'hand-alternation'] }),
    )
    expect(plan.warnings.some((w) => w.includes('diluir'))).toBe(true)
  })
})
```

- [ ] **Passo 4: rodar os testes e confirmar que falham**

```cmd
npm test -- focus
```

Esperado: falha ("planFocus is not a function" / export ausente).

- [ ] **Passo 5: implementar metadata + `planFocus` em `focus.ts`**

Em `src/logic/focus.ts`:

(a) Ajustar o topo. Trocar o import de tipos por:

```ts
import type {
  CharStatEntry,
  FingerId,
  FocusToggleId,
  ObjectiveId,
  SideId,
  TrainingFocus,
} from '../types/domain'
```

(b) **Remover** a definição local de `FingerId` (agora vem do domínio):

```ts
export type FingerId = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb'
```

> `FINGER_OPTIONS`, `FINGER_LETTERS` e `lettersForFingers` continuam usando `FingerId`, agora importado.

(c) Acrescentar os blocos novos (mantendo o código legado `FocusId`/`FOCUS_OPTIONS`/`getFocus` intacto até a Tarefa 5):

```ts
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
  usesHistory?: boolean
  asksFingers?: boolean
}

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
  /** Linhas de instrução que vêm antes do texto de desempenho. */
  preLines: string[]
  /** Linhas de instrução que vêm depois do texto de desempenho. */
  postLines: string[]
  /** O texto deve usar o histórico de erros do usuário. */
  usesHistory: boolean
  /** Avisos mostrados ao usuário (não bloqueiam). */
  warnings: string[]
  /** A geração está bloqueada (ex.: dedos específicos sem dedo escolhido). */
  blocked: boolean
  /** Mensagem explicando o bloqueio. */
  blockMessage?: string
}

const HARD_TOGGLES: FocusToggleId[] = ['worst-combos', 'rare-keys']
const DIFFICULT_TOGGLES: FocusToggleId[] = ['worst-combos', 'nearby-keys', 'rare-keys']
const MAX_TOGGLES_WITHOUT_WARNING = 4
const LOTS_OF_TOGGLES = 5

function toggleLabel(id: FocusToggleId): string {
  return FOCUS_TOGGLE_OPTIONS.find((o) => o.id === id)?.label ?? id
}

/**
 * Converte o estado do foco nas linhas de instrução do prompt, avisos e
 * decisão sobre o histórico. Função pura, sem dependências de UI.
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
    const letters = lettersForFingers(fingers).join(' ')
    postLines.push(
      `Dados de desempenho (dedos do treino): dedos ${names}. Priorize as letras: ${letters}.`,
    )
  }

  const focusIdCount = preLines.length + (asksFingers && fingers.length > 0 ? 1 : 0)
  if (focusIdCount >= 2) {
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
```

- [ ] **Passo 6: rodar os testes**

```cmd
npm test -- focus
```

Esperado: 10 testes passando.

- [ ] **Passo 7: typecheck e build**

```cmd
npm run typecheck
npm run build
```

Esperado: sem erros.

- [ ] **Passo 8: commit (apenas os arquivos desta tarefa)**

```cmd
git add src/types/domain.ts src/services/groq.ts src/logic/focus.ts src/components/AiGeneratePanel.tsx tests/focus.test.ts
git commit -m "IA: modelo de foco de treino (objetivo, lado, toggles) + planFocus"
```

---

## Tarefa 2: Prompt genérico + painel com grupos e interruptores

Objetivo: `buildPrompt` deixa de conhecer os ids do foco e passa a receber as linhas prontas; o painel ganha os dois selects, os 8 interruptores, os chips de dedos e a área de avisos.

**Files:**
- Modificar: `src/services/groq.ts`
- Reescrever: `src/components/AiGeneratePanel.tsx`
- Modificar: `src/components/ui/controls.tsx`
- Modificar: `tests/groq.test.ts`

- [ ] **Passo 1: atualizar os testes de `buildPrompt` (antes da implementação)**

Em `tests/groq.test.ts`:

(a) Ajustar o bloco de imports do topo: remover `FOCUS_OPTIONS` e adicionar `planFocus`:

```ts
import {
  buildPerformanceSummary,
  collectProblemChars,
  lettersForFingers,
  planFocus,
} from '../src/logic/focus'
```

> Remover também qualquer teste que chame `hasEnoughHistory` (função deixará de existir na Tarefa 5).

(b) Substituir o bloco de testes de foco do `describe('buildPrompt')` por:

```ts
it('linhas de foco entram no prompt', () => {
  const plan = planFocus({ objective: null, side: null, toggles: ['nearby-keys'], fingers: [] })
  const prompt = buildPrompt(getLevel('basic'), undefined, DEFAULT_TEXT_FILTERS, {
    preLines: plan.preLines,
    postLines: plan.postLines,
  })
  expect(prompt).toContain('TECLAS PRÓXIMAS')
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

it('sem histórico não adiciona dados de desempenho', () => {
  const prompt = buildPrompt(getLevel('basic'))
  expect(prompt).not.toContain('Dados de desempenho')
})
```

Manter inalterados os testes existentes de "anti-lista", "português do Brasil", "respeita tamanho" e "filtros extras (acentos/números)".

- [ ] **Passo 2: rodar os testes e confirmar que falham**

```cmd
npm test -- groq
```

Esperado: falha de tipo/assinatura (`buildPrompt` ainda aceita `FocusId`).

- [ ] **Passo 3: reescrever `buildPrompt` em `groq.ts`**

Em `src/services/groq.ts`:

(a) Remover o import de `FocusId`:

```ts
import type { FocusId } from '../logic/focus'
```

(b) Remover o bloco `FOCUS_HINTS` inteiro.

(c) Acrescentar a interface e reescrever `buildPrompt`:

```ts
/** Linhas de instrução já resolvidas pelo foco (produzidas por planFocus). */
export interface FocusPrompt {
  preLines: string[]
  postLines: string[]
}

function buildPrompt(
  level: Level,
  topicHint?: string,
  filters: TextFilters = DEFAULT_TEXT_FILTERS,
  focus?: FocusPrompt,
  historyText?: string,
): string {
  const lines: string[] = []

  lines.push(
    `Gere um texto original em português do Brasil para treino de digitação, adequado para o NÍVEL ${level.label}.`,
  )
  lines.push(
    `Regras: apenas texto corrido, sem títulos, legendas, listas, numeração, marcadores, negrito, emojis ou comentários; nada de markdown; nenhuma explicação antes ou depois.`,
  )
  lines.push(
    'Escreva apenas a passagem, sem cerca de código, sem aspas envolvendo o texto todo.',
  )

  const counts: Record<TextSizeId, string> = {
    short: 'entre 25 e 40 palavras',
    medium: 'entre 60 e 90 palavras',
    long: 'entre 120 e 180 palavras',
  }
  lines.push(
    `Tamanho: ${filters.size} — escreva ${counts[filters.size]} em 1 a 3 frases completas e coesas.`,
  )

  if (filters.accentHeavy) {
    lines.push(
      'Inclua muitas palavras acentuadas e com cedilha e trechos com acentuação típica do português (á, â, ã, é, ê, í, ó, ô, õ, ú, ç), respeitando a ortografia correta.',
    )
  }

  if (filters.withNumbers) {
    lines.push(
      'Inclua vários números em contextos reais no meio das frases: datas (12/03/2024), horários (14h30), quantidades (3.500 unidades), valores (R$ 27,90) e percentuais (18,5%).',
    )
  }

  if (focus) {
    for (const line of focus.preLines) lines.push(line)
  }

  if (historyText && historyText.trim()) {
    lines.push(
      `Dados de desempenho: aqui estão os erros mais frequentes do usuário. Use esses dados com prioridade e com naturalidade: ${historyText}`,
    )
  }

  if (focus) {
    for (const line of focus.postLines) lines.push(line)
  }

  if (topicHint && topicHint.trim()) {
    lines.push(`Tema/assunto desejado: ${topicHint.trim()}.`)
  }

  lines.push(
    'Evite repetir as mesmas palavras; mantenha a linguagem simples, natural e coerente, como um texto real.',
  )

  return lines.join('\n')
}
```

(d) Em `GenerateTextParams`, trocar o tipo de `focus`:

```ts
export interface GenerateTextParams {
  config: GroqConfig
  level: LevelId
  topicHint?: string
  filters?: TextFilters
  /** Linhas de foco já resolvidas (ver planFocus). */
  focus?: FocusPrompt
  /** Texto com os erros mais frequentes do usuário, quando o foco pedir histórico. */
  performanceData?: string
  signal?: AbortSignal
}
```

(e) Em `generateTypingText`, confirmar a chamada passa os argumentos na ordem nova:

```ts
const prompt = buildPrompt(getLevel(level), topicHint?.trim() || undefined, filters, focus, performanceData)
```

- [ ] **Passo 4: adicionar `ToggleRow` em `controls.tsx`**

Em `src/components/ui/controls.tsx`, acrescentar o componente abaixo (perto do `Switch`, reutilizando-o):

```tsx
export interface ToggleRowProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}

export function ToggleRow({ checked, onChange, label, description }: ToggleRowProps) {
  return (
    <label className="toggle-row">
      <span className="toggle-row-text">
        <span className="toggle-row-label">{label}</span>
        {description && <span className="toggle-row-desc">{description}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  )
}
```

> Ajustar a assinatura de `Switch` se necessário para aceitar `label` (para o `aria-label`). Se `Switch` já exigir os mesmos props, nenhuma mudança além do novo componente é necessária.

- [ ] **Passo 5: reescrever `AiGeneratePanel.tsx`**

Substituir o conteúdo de `src/components/AiGeneratePanel.tsx` por:

```tsx
import { useEffect, useMemo, useState } from 'react'
import type {
  GroqConfig,
  LevelId,
  TestResult,
  TextEntry,
  TextSizeId,
  TrainingFocus,
  FocusToggleId,
} from '../types/domain'
import {
  GroqError,
  generateTypingText,
  DEFAULT_TEXT_FILTERS,
  type TextFilters,
} from '../services/groq'
import { saveUserText } from '../storage/textsRepo'
import { getAllResults } from '../storage/resultsRepo'
import { generateId } from '../utils/id'
import { Button, Field, SelectControl, ToggleRow } from './ui/controls'
import { IconSparkles } from './ui/Icons'
import { LEVELS } from '../logic/levels'
import {
  EMPTY_FOCUS,
  FINGER_OPTIONS,
  FOCUS_TOGGLE_OPTIONS,
  OBJECTIVE_OPTIONS,
  SIDE_OPTIONS,
  buildPerformanceSummary,
  planFocus,
  type FingerId,
} from '../logic/focus'

type AiState = 'idle' | 'loading' | 'error'

export interface AiGeneratePanelProps {
  level: LevelId
  groqConfig: GroqConfig
  onGroqChange: (config: GroqConfig) => void
  onUse: (entry: TextEntry) => void
  onClose: () => void
}

export function AiGeneratePanel(props: AiGeneratePanelProps) {
  const [state, setState] = useState<AiState>('idle')
  const [message, setMessage] = useState('')
  const [topic, setTopic] = useState('')
  const [filters, setFilters] = useState<TextFilters>(DEFAULT_TEXT_FILTERS)
  const [showKeyForm, setShowKeyForm] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [focus, setFocus] = useState<TrainingFocus>(EMPTY_FOCUS)
  const [results, setResults] = useState<TestResult[]>([])

  useEffect(() => {
    let active = true
    getAllResults()
      .then((all) => {
        if (active) setResults(all)
      })
      .catch(() => {
        if (active) setResults([])
      })
    return () => {
      active = false
    }
  }, [])

  const plan = useMemo(() => planFocus(focus), [focus])
  const historySummary = useMemo(() => buildPerformanceSummary(results), [results])
  const historyAvailable = historySummary.trim().length > 0

  const toggleFinger = (f: FingerId) =>
    setFocus((prev) => ({
      ...prev,
      fingers: prev.fingers.includes(f)
        ? prev.fingers.filter((x) => x !== f)
        : [...prev.fingers, f],
    }))

  const toggleFocus = (id: FocusToggleId) =>
    setFocus((prev) => ({
      ...prev,
      toggles: prev.toggles.includes(id)
        ? prev.toggles.filter((x) => x !== id)
        : [...prev.toggles, id],
    }))

  const saveKey = () => {
    const trimmed = keyDraft.trim()
    if (!trimmed) return
    props.onGroqChange({ ...props.groqConfig, apiKey: trimmed })
    setKeyDraft('')
    setShowKeyForm(false)
  }

  const generate = async () => {
    setState('loading')
    setMessage('Gerando texto…')
    try {
      const content = await generateTypingText({
        config: props.groqConfig,
        level: props.level,
        topicHint: topic || undefined,
        filters,
        focus: { preLines: plan.preLines, postLines: plan.postLines },
        performanceData: plan.usesHistory && historyAvailable ? historySummary : undefined,
      })
      const entry: TextEntry = {
        id: generateId(),
        content,
        source: 'user',
        level: props.level,
        createdAt: Date.now(),
      }
      await saveUserText(entry)
      setState('idle')
      props.onUse(entry)
    } catch (err) {
      const msg =
        err instanceof GroqError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Falha ao gerar texto.'
      setState('error')
      setMessage(msg)
    }
  }

  const noKey = !props.groqConfig.apiKey
  const keyNotice = showKeyForm || noKey

  return (
    <>
      <div className="ai-body">
        {keyNotice && (
          <div className="ai-key-setup">
            <p className="form-help">
              Usa a API do Groq (gratuita). Crie uma chave em{' '}
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                console.groq.com/keys
              </a>{' '}
              e cole abaixo. A chave fica salva só neste navegador.
            </p>
            <div className="ai-key-form">
              <input
                className="text-input"
                type="password"
                placeholder="gsk_..."
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
              />
              <Button variant="primary" onClick={saveKey}>
                Salvar chave
              </Button>
            </div>
          </div>
        )}

        <div className="ai-panel">
          <Field label="Objetivo" htmlFor="ai-objective">
            <SelectControl
              id="ai-objective"
              value={focus.objective ?? ''}
              onChange={(e) =>
                setFocus((prev) => ({
                  ...prev,
                  objective: (e.target.value || null) as TrainingFocus['objective'],
                }))
              }
            >
              <option value="">Nenhum</option>
              {OBJECTIVE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </SelectControl>
          </Field>

          <Field label="Lado" htmlFor="ai-side">
            <SelectControl
              id="ai-side"
              value={focus.side ?? ''}
              onChange={(e) =>
                setFocus((prev) => ({
                  ...prev,
                  side: (e.target.value || null) as TrainingFocus['side'],
                }))
              }
            >
              <option value="">Nenhum</option>
              {SIDE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </SelectControl>
          </Field>

          <Field label="Nível" htmlFor="ai-level">
            <SelectControl id="ai-level" value={String(props.level)} disabled>
              <option value={String(props.level)}>
                {LEVELS.find((l) => l.id === props.level)?.label ?? props.level}
              </option>
            </SelectControl>
          </Field>

          <Field label="Tamanho" htmlFor="ai-size">
            <SelectControl
              id="ai-size"
              value={filters.size}
              onChange={(e) => setFilters((prev) => ({ ...prev, size: e.target.value as TextSizeId }))}
            >
              <option value="short">Curto</option>
              <option value="medium">Médio</option>
              <option value="long">Longo</option>
            </SelectControl>
          </Field>

          <Field label="Tema (opcional)" htmlFor="ai-topic">
            <input
              id="ai-topic"
              className="text-input"
              placeholder="ex.: dia a dia, tecnologia…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </Field>

          <Field label="Modelo" htmlFor="ai-model">
            <SelectControl
              id="ai-model"
              value={props.groqConfig.model}
              onChange={(e) => props.onGroqChange({ ...props.groqConfig, model: e.target.value })}
            >
              <option value="openai/gpt-oss-120b">openai/gpt-oss-120b</option>
              <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
            </SelectControl>
          </Field>
        </div>

        <div className="ai-focus-section">
          <span className="ai-focus-section-title">Ajustes finos</span>
          {FOCUS_TOGGLE_OPTIONS.map((o) => (
            <ToggleRow
              key={o.id}
              checked={focus.toggles.includes(o.id)}
              onChange={() => toggleFocus(o.id)}
              label={o.label}
              description={o.description}
            />
          ))}
          <ToggleRow
            checked={filters.accentHeavy}
            onChange={(v) => setFilters((prev) => ({ ...prev, accentHeavy: v }))}
            label="Muitos acentos"
            description="Prioriza palavras com acentos e cedilha (treino ABNT)."
          />
          <ToggleRow
            checked={filters.withNumbers}
            onChange={(v) => setFilters((prev) => ({ ...prev, withNumbers: v }))}
            label="Números e valores"
            description="Inclui datas, horários, quantidades, valores e percentuais."
          />
        </div>

        {focus.toggles.includes('specific-fingers') && (
          <div className="ai-fingers" role="group" aria-label="Dedos do treino">
            <span className="ai-fingers-label">Dedos:</span>
            {FINGER_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`chip${focus.fingers.includes(f.id) ? ' chip-active' : ''}`}
                onClick={() => toggleFinger(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {plan.usesHistory && (
          <p className="ai-focus-help" role="note">
            {historyAvailable
              ? 'Seu histórico de erros será usado para personalizar o texto.'
              : 'Ainda não há histórico de erros suficiente — será usada uma estratégia padrão para este objetivo.'}
          </p>
        )}

        {plan.warnings.length > 0 && (
          <ul className="ai-focus-warnings" role="note">
            {plan.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        {plan.blocked && (
          <p className="ai-focus-help" data-kind="error">
            {plan.blockMessage}
          </p>
        )}

        {message && (
          <p className="status-message" data-state={state}>
            {message}
          </p>
        )}
      </div>

      <div className="ai-footer">
        <Button
          variant="primary"
          onClick={() => void generate()}
          disabled={state === 'loading' || noKey || plan.blocked}
        >
          <IconSparkles size={18} />
          {state === 'loading' ? 'Gerando…' : 'Gerar texto com IA'}
        </Button>
      </div>
    </>
  )
}
```

> Se algum import/utilitário acima não existir exatamente com esse nome no projeto (ex.: `SelectControl`, `Field`, `IconSparkles`, `getAllResults`, `saveUserText`, `generateId`, `LEVELS`), alinhar com os nomes reais já usados na versão atual do arquivo — manter a estrutura e o comportamento, apenas trocar o bloco de foco.

- [ ] **Passo 6: rodar testes, typecheck e build**

```cmd
npm test
npm run typecheck
npm run build
```

Esperado: todos verdes.

- [ ] **Passo 7: verificação manual rápida (opcional, se houver navegador)**

```cmd
npm run dev
```

Abrir `http://localhost:5173`, abrir o modal de IA e conferir: dois selects (Objetivo/Lado), 8 interruptores, chips de dedos aparecem ao ligar "Dedos específicos", aviso ao ligar "Dedos específicos" sem escolher dedo (botão Gerar desabilitado).

- [ ] **Passo 8: commit**

```cmd
git add src/services/groq.ts src/components/AiGeneratePanel.tsx src/components/ui/controls.tsx tests/groq.test.ts
git commit -m "IA: prompt e painel com foco combinavel (grupos + interruptores)"
```

---

## Tarefa 3: Persistência das preferências do painel

Objetivo: guardar foco e filtros entre sessões. O painel carrega no mount e salva a cada mudança (após o primeiro carregamento).

**Files:**
- Criar: `src/storage/aiPrefs.ts`
- Criar: `tests/aiPrefs.test.ts`
- Modificar: `src/components/AiGeneratePanel.tsx`

- [ ] **Passo 1: escrever o teste do merge (antes da implementação)**

Criar `tests/aiPrefs.test.ts`. Este teste **não** chama IndexedDB (não abre banco), só a função pura de normalização:

```ts
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
  })
})
```

- [ ] **Passo 2: rodar o teste e confirmar que falha**

```cmd
npm test -- aiPrefs
```

Esperado: falha (módulo não existe).

- [ ] **Passo 3: implementar `src/storage/aiPrefs.ts`**

```ts
import type { AiGenPrefs } from '../types/domain'
import { EMPTY_FOCUS } from '../logic/focus'
import { DEFAULT_TEXT_FILTERS } from '../services/groq'
import { dbGet, dbPut, STORE_SETTINGS } from './db'

const AI_PREFS_KEY = 'ai-prefs'

export const DEFAULT_AI_PREFS: AiGenPrefs = {
  focus: EMPTY_FOCUS,
  size: DEFAULT_TEXT_FILTERS.size,
  accentHeavy: DEFAULT_TEXT_FILTERS.accentHeavy,
  withNumbers: DEFAULT_TEXT_FILTERS.withNumbers,
}

/** Mescla preferências salvas com os padrões (função pura, sem IndexedDB). */
export function normalizeAiPrefs(stored: Partial<AiGenPrefs> | undefined): AiGenPrefs {
  return { ...DEFAULT_AI_PREFS, ...stored }
}

export async function loadAiPrefs(): Promise<AiGenPrefs> {
  const stored = await dbGet<Partial<AiGenPrefs>>(STORE_SETTINGS, AI_PREFS_KEY)
  return normalizeAiPrefs(stored)
}

export async function saveAiPrefs(prefs: AiGenPrefs): Promise<void> {
  await dbPut(STORE_SETTINGS, prefs, AI_PREFS_KEY)
}
```

- [ ] **Passo 4: rodar o teste**

```cmd
npm test -- aiPrefs
```

Esperado: 2 testes passando.

- [ ] **Passo 5: integrar no painel**

Em `src/components/AiGeneratePanel.tsx`:

(a) Importar:

```ts
import { loadAiPrefs, saveAiPrefs } from '../storage/aiPrefs'
```

(b) Adicionar o estado de carregamento:

```ts
const [prefsLoaded, setPrefsLoaded] = useState(false)
```

(c) Adicionar os efeitos de carga e gravação (logo após o efeito que carrega `results`):

```tsx
useEffect(() => {
  let active = true
  loadAiPrefs()
    .then((prefs) => {
      if (!active) return
      setFocus(prefs.focus)
      setFilters({ size: prefs.size, accentHeavy: prefs.accentHeavy, withNumbers: prefs.withNumbers })
      setPrefsLoaded(true)
    })
    .catch(() => {
      if (active) setPrefsLoaded(true)
    })
    return () => {
      active = false
    }
}, [])

useEffect(() => {
  if (!prefsLoaded) return
  void saveAiPrefs({
    focus,
    size: filters.size,
    accentHeavy: filters.accentHeavy,
    withNumbers: filters.withNumbers,
  }).catch(() => {})
}, [prefsLoaded, focus, filters])
```

- [ ] **Passo 6: rodar testes, typecheck e build**

```cmd
npm test
npm run typecheck
npm run build
```

Esperado: todos verdes.

- [ ] **Passo 7: commit**

```cmd
git add src/storage/aiPrefs.ts tests/aiPrefs.test.ts src/components/AiGeneratePanel.tsx
git commit -m "IA: persistir preferencias de geracao (foco e filtros)"
```

---

## Tarefa 4: Estilos do bloco de ajustes finos

Objetivo: dar aparência ao bloco de interruptores, à lista de avisos e ao estado de erro.

**Files:**
- Modificar: `src/styles/app.css`

- [ ] **Passo 1: acrescentar os estilos**

Em `src/styles/app.css`, logo após o bloco `.ai-focus-help` (por volta da linha 875), acrescentar:

```css
/* Bloco de ajustes finos (interruptores combináveis). */
.ai-focus-section {
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--btn-border);
  border-radius: var(--radius-md, 8px);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ai-focus-section-title {
  font-size: var(--fs-sm);
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.toggle-row-text {
  display: flex;
  flex-direction: column;
}

.toggle-row-label {
  font-size: var(--fs-md);
  color: var(--text);
}

.toggle-row-desc {
  font-size: var(--fs-sm);
  color: var(--text-muted);
}

.ai-focus-warnings {
  margin: var(--space-2) 0 0;
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
  border-left: 3px solid var(--accent);
  background: var(--btn-bg);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--fs-sm);
}

.ai-focus-help[data-kind='error'] {
  border-left-color: #b00020;
  color: #9b1c1c;
}
```

> Usar apenas variáveis CSS já definidas no arquivo (`--space-2`, `--space-3`, `--space-4`, `--fs-sm`, `--fs-md`, `--btn-border`, `--btn-bg`, `--text`, `--text-muted`, `--text-faint`, `--accent`, `--radius-sm`). Se alguma não existir, substituir pelo valor literal correspondente.

- [ ] **Passo 2: build**

```cmd
npm run build
```

Esperado: sem erros.

- [ ] **Passo 3: verificação visual (se possível)**

```cmd
npm run dev
```

Conferir espaçamento do bloco, alinhamento do switch à direita, aparência da lista de avisos.

- [ ] **Passo 4: commit**

```cmd
git add src/styles/app.css
git commit -m "IA: estilos do bloco de ajustes finos do foco"
```

---

## Tarefa 5: Limpeza do código legado + verificação final

Objetivo: remover o modelo antigo de foco (dropdown único) e confirmar tudo verde.

**Files:**
- Modificar: `src/logic/focus.ts`
- (Garantir) `src/services/groq.ts`, `src/components/AiGeneratePanel.tsx`, `tests/groq.test.ts` sem referências antigas.

- [ ] **Passo 1: localizar referências restantes**

```cmd
git grep -n "FOCUS_OPTIONS\|getFocus\|hasEnoughHistory\|FocusId\|FOCUS_HINTS\|focusOption" -- src tests
```

Esperado após Tarefa 2: nada em `src/`, e apenas os exports órfãos em `src/logic/focus.ts`.

- [ ] **Passo 2: remover do `focus.ts`**

Remover os blocos órfãos:

```ts
export type FocusId = 'none' | 'speed' | 'accuracy' | 'balance' | 'left' | 'right' | 'worst-letters' | 'worst-combos' | 'nearby-keys' | 'rare-keys' | 'hand-alternation' | 'specific-fingers'

export interface FocusOption { ... }
export const FOCUS_OPTIONS: FocusOption[] = [ ... ]

export function getFocus(id: FocusId): FocusOption { ... }

export function hasEnoughHistory(summary: string, threshold = 20): boolean { ... }
```

> Manter `ProblemChar`, `collectProblemChars`, `FINGER_OPTIONS`, `FINGER_LETTERS`, `lettersForFingers`, `buildPerformanceSummary`, as novas metadata e `planFocus`.

- [ ] **Passo 3: confirmar que nada quebrou**

```cmd
git grep -n "FocusId\|FOCUS_OPTIONS\|getFocus\|hasEnoughHistory" -- src tests
```

Esperado: nenhuma saída.

- [ ] **Passo 4: suíte completa + typecheck + build**

```cmd
npm test
npm run typecheck
npm run build
```

Esperado: todos verdes (79+ testes).

- [ ] **Passo 5: commit**

```cmd
git add src/logic/focus.ts
git commit -m "IA: remover codigo de foco legado (dropdown unico)"
```

---

## Verificação final (Definition of Done)

- [ ] `npm test`, `npm run typecheck`, `npm run build` verdes.
- [ ] `git grep -n "FocusId\|FOCUS_OPTIONS\|getFocus\|hasEnoughHistory\|FOCUS_HINTS" -- src tests` sem resultados.
- [ ] No painel: Objetivo, Lado, 8 interruptores, chips de dedos condicionais, avisos e bloqueio de "Dedos específicos" sem dedo.
- [ ] Preferências (foco + tamanho + acentos + números) persistem após recarregar a página.
- [ ] Histórico de erros só entra no prompt quando um interruptor de histórico está ligado.
