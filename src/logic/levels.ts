import type { Level, LevelId } from '../types/domain'

/**
 * Fonte única de verdade para níveis de dificuldade.
 * Adicionar/remover/renomear níveis exige mudar apenas aqui.
 */
export const LEVELS: readonly Level[] = [
  {
    id: 'beginner',
    label: 'Iniciante',
    order: 1,
    description:
      'Frases curtas com palavras simples e familiares, vocabulário do dia a dia, sem pontuação complexa, poucos acentos e grande espaçamento entre palavras.',
  },
  {
    id: 'basic',
    label: 'Básico',
    order: 2,
    description:
      'Frases simples com palavras comuns, alguns acentos e pontuação básica (vírgulas e pontos finais).',
  },
  {
    id: 'intermediate',
    label: 'Intermediário',
    order: 3,
    description:
      'Frases de tamanho médio, vocabulário mais variado, acentuação frequente e pontuação variada.',
  },
  {
    id: 'advanced',
    label: 'Avançado',
    order: 4,
    description:
      'Frases longas com subordinação, pontuação rica (dois-pontos, travessões, aspas), palavras menos frequentes e acentos variados.',
  },
  {
    id: 'expert',
    label: 'Especialista',
    order: 5,
    description:
      'Frases complexas e longas, vocabulário técnico, pontuação densa, aspas, números, hífen, travessão e grande variedade de caracteres.',
  },
]

export const LEVELS_BY_ID: Record<LevelId, Level> = Object.fromEntries(
  LEVELS.map((l) => [l.id, l]),
) as Record<LevelId, Level>

export function getLevel(id: LevelId): Level {
  return LEVELS_BY_ID[id] ?? LEVELS_BY_ID.beginner
}

export function levelLabel(id: LevelId): string {
  return getLevel(id).label
}

export const LEVEL_IDS: readonly LevelId[] = LEVELS.map((l) => l.id)
