import type { LevelId } from '../types/domain'

/**
 * Textos predefinidos para demonstração (um ou mais por nível).
 * Vivem no código; para crescer, basta adicionar novos itens aqui.
 * Conteúdos em português, adequados ao nível de dificuldade.
 */

export interface PresetText {
  id: string
  title: string
  content: string
  level: LevelId
}

export const PRESET_TEXTS: readonly PresetText[] = [
  {
    id: 'preset-beginner-1',
    title: 'Dia tranquilo',
    level: 'beginner',
    content:
      'O sol nasceu cedo. O café estava quente. A casa era pequena e alegre. O dia começa com calma e um bom livro.',
  },
  {
    id: 'preset-beginner-2',
    title: 'Bichos do quintal',
    level: 'beginner',
    content:
      'O gato dorme no sofá. O pato nada no lago. A vaca come capim. O cão late para o vento e corre no quintal.',
  },
  {
    id: 'preset-basic-1',
    title: 'Receita simples',
    level: 'basic',
    content:
      'Para fazer um bolo simples, misture farinha, ovos e açúcar. Depois, leve ao forno por quarenta minutos e espere amornar antes de servir.',
  },
  {
    id: 'preset-basic-2',
    title: 'Cidade e campo',
    level: 'basic',
    content:
      'Nas grandes cidades, o trânsito é intenso e as pessoas vivem com pressa. No campo, o ritmo é mais tranquilo e a natureza está sempre por perto.',
  },
  {
    id: 'preset-intermediate-1',
    title: 'Comunicação na era digital',
    level: 'intermediate',
    content:
      'A comunicação mudou profundamente nas últimas décadas. Mensagens instantâneas, videochamadas e redes sociais encurtaram distâncias, mas também exigem novo tipo de atenção e cuidado com o que compartilhamos.',
  },
  {
    id: 'preset-intermediate-2',
    title: 'Rotina de estudos',
    level: 'intermediate',
    content:
      'Estudar com consistência vale mais do que longas sessões ocasionais. Reserve períodos curtos e regulares, defina objetivos claros para cada semana e revise o conteúdo em intervalos crescentes para fixar o aprendizado.',
  },
  {
    id: 'preset-advanced-1',
    title: 'O hábito de ler',
    level: 'advanced',
    content:
      'Ler não é apenas decodificar símbolos: é um exercício de empatia e de imaginação. Quando acompanhamos a trajetória de uma personagem, atravessamos dilemas que, em geral, não seriam nossos — e voltamos da leitura com um repertório diferente: mais amplo, mais sensível, mais crítico.',
  },
  {
    id: 'preset-advanced-2',
    title: 'Cidades que respiram',
    level: 'advanced',
    content:
      'Uma cidade bem projetada conversa com quem a habita: praças sombreadas convidam à permanência; calçadas generosas, ao encontro; ciclovias protegidas, ao deslocamento sem medo. Quando o espaço público é tratado com cuidado, a vida urbana floresce de maneiras que nenhum dispositivo consegue replicar.',
  },
  {
    id: 'preset-expert-1',
    title: 'Computabilidade e limites',
    level: 'expert',
    content:
      'Em 1936, Turing formalizou a noção intuitiva de "cálculo efetivo" por meio de um dispositivo hipotético — a máquina que hoje leva seu nome — e demonstrou que certos problemas são indecidíveis: não existe algoritmo capaz de resolvê-los para todas as entradas possíveis. O Teorema de Rice generaliza o resultado: qualquer propriedade não-trivial sobre a função computada é, ela própria, indecidível.',
  },
  {
    id: 'preset-expert-2',
    title: 'O samba e seus enigmas',
    level: 'expert',
    content:
      'O verso de Noélia: "o tempo é uma fileira de água que escorre entre os dedos" — metáfora precisa, quase física. Não por acaso, a melhor prosa brasileira bebe dessa cadência; ela teimosamente resiste à explicação, porém não se nega a um acerto de contas consigo mesma: 3/4, síncopa, a resposta no tempo fraco.',
  },
]
