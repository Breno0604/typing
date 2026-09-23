# Digitação — Teste e Treino

Aplicação local de **teste e treino de digitação** em português, construída com **React + TypeScript + Vite**, sem dependências de runtime (funciona 100% offline; o único recurso opcional que usa internet é a geração de textos via API do Groq).

## Como rodar

```bash
npm install
npm run dev        # desenvolvimento (http://localhost:5173)
npm run build      # typecheck + build de produção
npm run preview    # servir o build
npm test           # testes unitários (vitest)
npm run typecheck  # apenas tsc --noEmit
```

## Funcionalidades

- **Modos**: Teste (mede desempenho, termina por tempo/texto) e Treino (sem limite de tempo, termina ao concluir o texto ou em "Finalizar").
- **Início no primeiro caractere**: o cronômetro só começa quando o usuário digita; clique no texto não inicia nada.
- **Duração**: 5/10/15/30/60/90/120/180s, Personalizado (livre, 1–3600s) e Sem limite.
- **Níveis**: Iniciante, Básico, Intermediário, Avançado, Especialista — centralizados em `src/logic/levels.ts`; filtram os textos.
- **Textos**:
  - Predefinidos por nível (`src/data/predefinedTexts.ts`, fáceis de expandir);
  - Próprios do usuário (CRUD completo, salvos no IndexedDB);
  - Gerados por IA (Groq), com tema opcional, nível e badge "Gerado por IA".
- **Área de digitação**: caractere a caractere (code points, NFC), com cursor no caractere atual, acertos em verde, erros em vermelho; comparação case-sensitive e exata (á, ç etc.).
- **Erros e correções**: erro permanece contabilizado mesmo após Backspace; Backspace conta como "Correção".
- **Áudio**: sons de acerto/erro via Web Audio API (sem arquivos), com volume configurável.
- **Cronômetro**: baseado em `performance.now()` (timestamps reais, não soma de intervalos).
- **Resultados**: WPM em destaque + Precisão, Toques Líquidos/Brutos/Totais, Erros, Correções, Palavras `x/y`, Caracteres `x/y`, Tempo Total `00:15:000`. Não há "Precisão Real" (requisito).
- **Estatísticas de evolução**: WPM médio, melhor WPM, precisão média, nº de sessões e gráfico SVG (WPM + precisão), com filtro Teste/Treino.
- **Configurações** (persistidas): tema claro/escuro, tamanhos de fonte (UI e texto), cor de destaque, sons + volume, duração/nível/modo padrão, chave e modelo do Groq.

## Regras de métricas (confirmadas)

- **Caracteres corretos (posicional)**: posições atualmente corretas; WPM e progresso usam esse valor. Corrigir com Backspace reflete o estado real da posição.
- **WPM** = caracteres corretos ÷ 5 ÷ minutos.
- **Precisão** = toques corretos ÷ tentativas de caracteres × 100 (histórico por toque; re-digitar após Backspace conta nova tentativa).
- **Toques brutos** = tentativas de caracteres (inclui erros). **Erros** nunca diminuem.
- **Correções** = usos do Backspace. **Toques totais** = brutos + correções. **Toques líquidos** = brutos − erros.
- **Treino também é salvo** no histórico, identificado por modo (filtro nas estatísticas).

## Arquitetura

```
src/
  types/      domain.ts, typing.ts        (contratos centrais)
  logic/      levels, durations, metrics, sessionReducer, texts
  storage/    db.ts (wrapper IndexedDB), settings, textsRepo, resultsRepo, seed
  services/   groq.ts (isolado), audio.ts (Web Audio API)
  hooks/      useSettings, useGroqConfig, useUserTexts, useTestSession, useTimer
  components/ ui/ (ícones SVG, controles, dialog), ControlsBar, TypingArea,
              ResultCard, StatsChart, TextsManager, SettingsDialog, AiGeneratePanel
  pages/      PracticePage, StatsPage
  data/       predefinedTexts.ts
  styles/     app.css (tokens de tema dark/light)
```

- **Máquina de estados única**: `idle → running → finished` (sem booleanos soltos).
- **Camada de métricas pura** e testada; nenhum cálculo nos componentes.
- **IndexedDB** (`typing-app`): stores `settings`, `texts`, `results`. Zero libs externas.
- **Groq isolado** em serviço com erros tipados (sem chave, offline, 401/403, 429, servidor, resposta inválida) e sanitização da resposta (remove markdown/listas/emojis; texto corrido).
- **Zero dependências de runtime**: ícones e gráfico em SVG próprio, fontes do sistema.

## Testes

`tests/metrics.test.ts` cobre: início no 1º caractere, erros permanentes após correção, backspace na posição 0, fim por tempo, fim por texto, reset, WPM (30 chars/15s = 24 WPM), precisão histórica, toque total/líquido, progresso de palavras/caracteres e comparação exata de acentos.

## Verificação manual (resumo do que foi validado no navegador)

Digitação com erro + Backspace (erro permanece), finalização por tempo (5s/30s), finalização por conclusão, modo Treino com "Finalizar" manual, "Sem limite" contando, duração personalizada (45s), CRUD de textos próprios persistido, estatísticas com gráfico, tema claro/escuro persistido, IndexedDB inspecionado diretamente, Groq com chave inválida → mensagem amigável e app segue funcionando, entrada bloqueada após o fim, atalhos/modificadores ignorados.

## Deliberadamente fora do escopo

Mobile prioritário, PWA/service worker, multi-idioma, contas/sincronização, "Precisão Real", bibliotecas de UI/gráficos/roteamento.
