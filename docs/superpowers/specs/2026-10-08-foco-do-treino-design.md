# Design — Reestruturação do "Foco do treino" (modal Gerar texto com IA)

Data: 2026-10-08
Status: aprovado para planejamento

## Contexto

Hoje o "Foco do treino", no modal "Gerar texto com IA", é um **dropdown de escolha única**
com 12 opções. Várias dessas opções são, na prática, características aditivas que fazem
sentido ser **ligadas/desligadas e combinadas** (ex.: "teclas pouco usadas" + "alternância
entre mãos"). Além disso, a implementação atual tem problemas conhecidos:

- O histórico de erros do usuário é anexado a **qualquer** foco, não só aos dois que
  anunciam usá-lo, podendo contradizer o objetivo escolhido.
- "Combinações difíceis" promete usar o histórico, mas só recebe **letras isoladas**
  (não existem dados de pares/trincas no sistema).
- O aviso de "histórico insuficiente" não corresponde ao que é realmente enviado.
- "Dedos específicos" sem dedo escolhido gera uma instrução contraditória.
- Dois filtros já existentes no código (`accentHeavy` e `withNumbers`) **não têm UI**.

## Objetivo

Substituir o dropdown por uma estrutura que permita **combinar vários focos ao mesmo tempo**,
separando:

- **Escolhas únicas** (por grupo): Objetivo e Lado.
- **Interruptores combináveis**: toggles de treino.
- **Parâmetros**: seleção de dedos.

## Não-objetivos

- Registrar a tecla errada digitada e combinações (pares/trincas) reais — o "Combinações
  difíceis" continua usando as letras do histórico. Fica para um próximo ciclo.
- "Presets" prontos (Rápido, Preciso, Erros, Mãos) — abordagem descartada.
- Alterar o layout geral do modal além da seção de foco.

## Decisões (confirmadas com o usuário)

1. Os focos podem ser **combinados** no mesmo texto.
2. Itens conflitantes são tratados como **escolha única por grupo** (Objetivo, Lado);
   o restante é toggle.
3. **Acentos** e **Números** entram como toggles (reaproveitando `accentHeavy`/`withNumbers`).
4. Conflitos entre grupos **avisam, mas não bloqueiam** (única exceção: ver regras).
5. As escolhas são **lembradas entre sessões** (persistidas no navegador).

## Seção 1 — Modelo do foco

O foco passa a ser um conjunto de itens independentes.

**Objetivo (escolha única):** `nenhum` · `velocidade` · `precisao` · `equilibrio`

**Lado (escolha única):** `nenhum` · `esquerda` · `direita`

**Interruptores (combináveis):**

| Item | Usa histórico | Observação |
| --- | --- | --- |
| Letras com mais erros | sim | baseado em `charStats` do histórico |
| Combinações difíceis | sim | *hoje usa letras; combinações reais fora de escopo* |
| Teclas próximas | não | pares de teclas vizinhas (ABNT2/QWERTY) |
| Teclas pouco usadas | não | k, w, y, z e dígrafos incomuns |
| Alternância entre mãos | não | palavras que trocam de mão |
| Dedos específicos | não | revela seleção de dedos; exige ≥1 dedo |
| Muitos acentos | não | mapeia para `filters.accentHeavy` |
| Números e valores | não | mapeia para `filters.withNumbers` |

**Regras de negócio:**

- "Sem foco específico" deixa de existir: é o estado com tudo neutro/desligado.
- O histórico é usado **somente** se "Letras com mais erros" ou "Combinações difíceis"
  estiver ligado e houver dados (corrige a contaminação atual).
- Acentos/Números reaproveitam `TextFilters.accentHeavy`/`withNumbers`; nenhuma instrução
  nova é necessária para eles.
- Cada item carrega: rótulo curto, descrição em linguagem simples e a instrução de IA.

## Seção 2 — Interface

Na seção "Foco do treino" do modal:

1. Dois seletores compactos lado a lado: **Objetivo** e **Lado**.
2. Bloco **"Ajustes finos"** com os 8 interruptores (componente `Switch` já existente),
   cada um com rótulo + frase curta de ajuda.
3. Ao ligar "Dedos específicos", surgem os chips de dedos abaixo.
4. **Área de avisos** visível apenas quando a combinação gera alerta (aviso, não bloqueio).
5. *(Opcional)* linha-resumo: "Seu texto vai treinar: …".

Os campos atuais (Nível, Tamanho, Tema, Modelo) permanecem.

## Seção 3 — Montagem do pedido à IA

Separação de responsabilidades:

- **`focus.ts`** produz a lista de instruções (regra de treino). Função pura.
- **`groq.ts`** apenas concatena as instruções ao pedido; deixa de importar `FocusId`.

Ordem das instruções:

1. Regras básicas (existentes).
2. Objetivo, se escolhido.
3. Lado, se escolhido.
4. Cada interruptor ativo, na ordem em que aparece na tabela da Seção 1.
5. Acentos e Números (via `TextFilters`, existente).
6. Histórico do usuário — **uma única vez** — só se um toggle de histórico estiver ativo
   e houver dados.
7. Dados dos dedos, só se "Dedos específicos" ligado e com dedos escolhidos.
8. Se 2+ itens de foco ativos: linha pedindo combinação natural.
9. Tema sugerido (existente).

Assinatura-alvo (conceitual): `buildPrompt(level, topic, filters, focusLines?)`, em que
`focusLines` é a lista pronta produzida por `focus.ts`.

## Seção 4 — Regras de conflito (avisos)

Avisos são **somente de UI** (não vão para a IA), definidos em um único lugar em `focus.ts`:

- **Velocidade + (Teclas pouco usadas / Letras difíceis / Combinações difíceis / Teclas
  próximas)** → "treino difícil tende a reduzir a velocidade".
- **Mais de 4 interruptores ligados** → "muitos objetivos ao mesmo tempo podem diluir o foco".
- **Dedos específicos ligado sem dedo escolhido** → **bloqueia** o botão Gerar, com mensagem
  clara (único bloqueio rígido).
- **Equilíbrio + outros itens** → informativo ("Equilíbrio já mistura; os demais somam").
- **Lado (Esquerda/Direita) + Letras com mais erros** → aviso suave de possível conflito.

## Seção 5 — Persistência e migração

- Novo conjunto "preferências de geração", persistido como um único objeto:
  - **Foco**: objetivo, lado, interruptores e dedos.
  - **Filtros**: Tamanho, Acentos e Números.
- Persistido no armazenamento do navegador seguindo o padrão existente (mesma abordagem da
  configuração do Groq), com **carga + junção com valores padrão**.
- **Sem migração de dados antigos**: hoje o foco não é salvo (reinicia a cada abertura),
  então não há valor legado a converter.
- Arquitetura: módulo de armazenamento enxuto e dedicado; o próprio painel carrega/salva
  (como já faz com o histórico de resultados), evitando encanamento extra no App.

## Seção 6 — Testes e arquivos afetados

Testes (somente lógica pura; o projeto não tem ambiente de navegador nos testes):

- `focus.ts`: geração das linhas por objetivo/lado/interruptores; histórico só quando pedido;
  avisos de conflito; dedos; estado tudo desligado = nenhuma linha.
- `groq`: nova assinatura do `buildPrompt`, ordem das linhas, acentos/números, ausência de
  histórico quando não solicitado.
- Mantidos/atualizados: `lettersForFingers`, `buildPerformanceSummary`, `collectProblemChars`.

Arquivos previstos:

- `src/logic/focus.ts` — modelo, opções, função de instruções e avisos.
- `src/services/groq.ts` — instruções separadas por item; `buildPrompt` recebe as linhas de foco.
- `src/components/AiGeneratePanel.tsx` — seletores, interruptores, chips, avisos, carga/salvamento.
- `src/storage/aiPrefs.ts` *(novo)* — carga/salvamento + padrões.
- `src/components/ui/controls.tsx` — variação de interruptor "com rótulo e descrição".
- `src/styles/app.css` — estilos mínimos do bloco de ajustes finos e avisos.
- `tests/groq.test.ts` + `tests/focus.test.ts` *(novo)*.

## Critérios de aceite

- É possível combinar 2+ focos em um único texto gerado.
- Acentos e Números aparecem na interface e afetam o pedido.
- O histórico é usado **apenas** quando um toggle de histórico está ligado.
- "Dedos específicos" sem dedo escolhido impede a geração com mensagem clara.
- Avisos de conflito aparecem, mas não impedem a geração.
- As escolhas são restauradas na próxima abertura do modal.
- Testes de lógica passando; `typecheck` e `build` OK.
