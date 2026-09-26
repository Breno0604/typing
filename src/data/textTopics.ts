import type { TextEntry } from '../types/domain'
import { PRESET_TEXTS } from './predefinedTexts'

/**
 * Estrutura de navegação por temas: cada tema agrupa subtemas, e cada
 * subtema aponta para os textos (predefinidos, do usuário ou de IA)
 * exibidos como cards na tela de configuração.
 *
 * O nível de dificuldade continua existindo nos dados (métricas e
 * resultados) — apenas não é mais um filtro na interface.
 */

export interface SubtopicDef {
  id: string
  label: string
  /** IDs dos textos predefinidos que compõem o subtema. */
  presetIds: string[]
}

export interface TopicDef {
  id: string
  label: string
  /** Descrição curta exibida no card do tema. */
  description: string
  subtopics: SubtopicDef[]
}

export const TOPICS: readonly TopicDef[] = [
  {
    id: 'cotidiano',
    label: 'Cotidiano',
    description: 'Frases do dia a dia, casa, rotina e animais',
    subtopics: [
      {
        id: 'casa',
        label: 'Casa e rotina',
        presetIds: ['preset-beginner-1'],
      },
      {
        id: 'animais',
        label: 'Bichos',
        presetIds: ['preset-beginner-2'],
      },
      {
        id: 'cozinha',
        label: 'Cozinha',
        presetIds: ['preset-basic-1'],
      },
      {
        id: 'cidade-campo',
        label: 'Cidade e campo',
        presetIds: ['preset-basic-2'],
      },
    ],
  },
  {
    id: 'estudos',
    label: 'Estudos',
    description: 'Aprendizado, leitura e hábitos de estudo',
    subtopics: [
      {
        id: 'metodos',
        label: 'Métodos de estudo',
        presetIds: ['preset-intermediate-2'],
      },
      {
        id: 'leitura',
        label: 'Leitura',
        presetIds: ['preset-advanced-1'],
      },
    ],
  },
  {
    id: 'tecnologia',
    label: 'Tecnologia',
    description: 'Comunicação digital e computação',
    subtopics: [
      {
        id: 'comunicacao',
        label: 'Comunicação digital',
        presetIds: ['preset-intermediate-1'],
      },
      {
        id: 'computacao',
        label: 'Computação',
        presetIds: ['preset-expert-1'],
      },
    ],
  },
  {
    id: 'sociedade',
    label: 'Cidade e sociedade',
    description: 'Espaço urbano, cultura e expressão',
    subtopics: [
      {
        id: 'urbanismo',
        label: 'Urbanismo',
        presetIds: ['preset-advanced-2'],
      },
      {
        id: 'musica',
        label: 'Música brasileira',
        presetIds: ['preset-expert-2'],
      },
    ],
  },
]

/** Primeiro tema/subtema: seleção sugerida ao abrir a aplicação. */
export const DEFAULT_TOPIC = TOPICS[0]
export const DEFAULT_SUBTOPIC = TOPICS[0].subtopics[0]

export interface TextCard {
  entry: TextEntry
  /** Origem para exibição no card. */
  origin: 'preset' | 'user' | 'ai'
}

/**
 * Resolve os cards de um subtema: junta os predefinidos do subtema com
 * os textos do usuário/IA. Como textos próprios não têm tema, todos
 * aparecem na subseção "Meus textos e IA" de qualquer subtema — assim
 * continuam acessíveis sem depender de nível ou tema.
 */
export function cardsForSubtopic(subtopic: SubtopicDef, userAndAiTexts: TextEntry[]): TextCard[] {
  const cards: TextCard[] = []
  for (const id of subtopic.presetIds) {
    const preset = PRESET_TEXTS.find((p) => p.id === id)
    if (preset) {
      cards.push({
        entry: {
          id: preset.id,
          title: preset.title,
          content: preset.content,
          level: preset.level,
          source: 'preset',
          createdAt: 0,
        },
        origin: 'preset',
      })
    }
  }
  for (const entry of userAndAiTexts) {
    cards.push({ entry, origin: entry.source === 'ai' ? 'ai' : 'user' })
  }
  return cards
}
