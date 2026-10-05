# Análise Crítica e 100 Sugestões de Melhoria — App de Digitação

**Data:** 27/09/2026 · **Escopo:** análise apenas — nenhuma alteração de código foi feita.

---

## Resumo da análise

A aplicação é um treinador de digitação em React 18 + TypeScript + Vite, 100% offline (IndexedDB), com geração opcional de textos via IA (Groq). O fluxo principal abre direto na digitação (boa decisão — zero fricção), o cronômetro de tempo efetivo com pausa por 3s de inatividade está corretamente implementado e validado, e a página "Evolução" oferece resumo consolidado, gráfico SVG, histórico com exclusão e detalhes por caractere.

**Pontos fortes:** inicialização imediata na prática; reducer puro e testável (49 testes); máquina de estados limpa; tokens de design consistentes no CSS; diálogos acessíveis com focus trap; timer com `font-variant-numeric: tabular-nums`; respeita `prefers-reduced-motion`.

**Principais fragilidades identificadas:**

1. **Campos de configuração órfãos:** `Settings` define tema, tamanhos de fonte, cor de destaque, fundo do card — mas **nenhuma UI expõe essas configurações**. Há tokens de tema escuro completos no CSS que nunca são usados (`data-theme` é fixado em `light`).
2. **Foco do teclado capturado por botões:** após clicar "Reiniciar"/"Finalizar", o botão fica focado e o espaço aciona o botão em vez de digitar (problema real, observado em testes).
3. **Sem feedback de progresso:** não há barra de progresso, WPM ao vivo, nem contagem de erros durante a digitação — o usuário só descobre o desempenho ao final.
4. **Modo `test` morto no código:** `SessionMode` tem `test`/`practice`, `DurationId` tem 9 opções, mas a sessão é sempre `practice` com `duration: null`.
5. **Inutilizável em touch:** a digitação depende de `keydown` no `window`; em celular/tablet não há campo que dispare o teclado virtual.
6. **"Usar" em Meus textos não usa:** o botão fecha o diálogo sem selecionar o texto.
7. **Extras mortos:** `data-warn` no timer (CSS sem uso), badge "Gerado por IA" só no gerenciador, select de nível no painel de IA fixo e sem efeito.

---

## Seção 1 — Interface e experiência do usuário (50 melhorias)

### UX-01. Desfocar botões após clique
**Descrição:** chamar `blur()` no botão após cada clique em "Reiniciar", "Finalizar" e "Trocar texto" (ou mover o foco para `body`).
**Problema/oportunidade:** hoje, clicar em um botão deixa-o focado; o espaço aciona o botão em vez de digitar espaço no texto.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** bug real de usabilidade que quebra o fluxo central da aplicação; correção de 3 linhas com ganho imediato.

### UX-02. Barra de progresso do texto
**Descrição:** barra fina (2–3px) acima ou abaixo do card mostrando `posição / total` de caracteres, na cor de destaque.
**Problema/oportunidade:** em textos longos o usuário não sabe quanto falta; só há o "…" de truncamento.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** feedback de progresso é o feedback visual mais básico esperado em um treinador de digitação.

### UX-03. WPM e precisão ao vivo discretos
**Descrição:** exibir WPM atual e % de precisão ao lado do cronômetro em fonte menor e cor apagada, atualizando pelo mesmo tick.
**Problema/oportunidade:** o desempenho só aparece no fim; um valor ao vivo motiva a manter o ritmo.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** `liveMetrics` já calcula tudo a cada 100ms — é apenas renderizar dois números que já existem.

### UX-04. Cursor piscante no caractere atual
**Descrição:** animação CSS de opacidade (piscar suave, 1s) no sublinhado/elemento do caractere `current`, desativada com `prefers-reduced-motion`.
**Problema/oportunidade:** o sublinhado estático pode passar despercebido, especialmente em pausa.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** melhora o rastreamento visual da posição sem nenhum custo de lógica; já existe estrutura `.char[data-state='current']`.

### UX-05. Rótulo textual "[PAUSA]" junto ao timer
**Descrição:** além do estilo apagado/tracejado, exibir o texto "[PAUSA]" dentro do elemento do timer quando `data-paused` (via pseudo-elemento CSS `::after` ou span condicional).
**Problema/oporunidade:** o estado de pausa é comunicado só por opacidade reduzida — usuários podem achar que o timer travou com defeito.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** a pausa por inatividade é um comportamento incomum; sem rótulo, parece bug. O `aria-label` já diz, mas usuários videntes não leem aria-label.

### UX-06. Dica "Digite para começar" no estado inicial
**Descrição:** mostrar um texto de apoio ("Comece a digitar para iniciar o cronômetro") sob o card ou sobre ele, sumindo na primeira tecla.
**Problema/oportunidade:** a tela abre muda; nada indica que basta digitar (nem que erros não iniciam a contagem).
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** reduz a primeira barreira de uso; o hook já expõe `session.idle`.

### UX-07. Atalhos de teclado + legenda
**Descrição:** `Esc` reinicia a sessão, `Ctrl+Enter` finaliza; legenda discreta de atalhos sob os botões (ou tooltip `title`).
**Problema/oportunidade:** hoje `Esc`/`Tab` são simplesmente ignorados no handler — não há nenhum atalho.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** aplicação de digitação é usada por quem vive no teclado; atalhos são expectativa natural.

### UX-08. Identificar o texto atual acima do card
**Descrição:** linha discreta acima do card com título do texto, origem (Predefinido / Meu / IA) e nível.
**Problema/oportunidade:** o usuário não sabe qual texto está digitando (o título só aparece na escolha).
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** `currentText` já está disponível no `PracticePage`; dá contexto e reforça a variedade de conteúdo.

### UX-09. Scroll suave ao trocar a janela de caracteres
**Descrição:** quando a janela de 600 caracteres avança (a cada 200 digitados), animar o reposicionamento em vez de trocar abruptamente.
**Problema/oportunidade:** o corte da janela causa um "salto" visual brusco em textos longos.
**Prioridade:** Baixa · **Esforço:** Médio
**Justificativa:** polimento que reduz desorientação em textos de 800+ caracteres (ex.: gerados pela IA no tamanho "longo").

### UX-10. Garantir linha do caractere atual visível
**Descrição:** rolar o card para manter a linha do caractere `current` visível quando o texto quebra em várias linhas.
**Problema/oportunidade:** em telas baixas (notebook 768px, mobile) a posição atual pode sair da área visível.
**Prioridade:** Alta · **Esforço:** Médio
**Justificativa:** sem isso, textos longos ficam literalmente incompletáveis em telas pequenas.

### UX-11. Feedback de erro mais perceptível
**Descrição:** micro-animação (shake de 2px) ou flash no caractere incorreto ao errar; opcionalmente borda vermelha breve no card.
**Problema/oportunidade:** o vermelho estático não chama atenção; erros consecutivos passam despercebidos durante a digitação rápida.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** percepção imediata do erro é o mecanismo pelo qual se aprende a digitar; respeitar `prefers-reduced-motion`.

### UX-12. Legenda de cores dos estados
**Descrição:** linha fina sob o card: ● pendente · ● correto · ● erro (amostras nas cores reais).
**Problema/oportunidade:** o esquema de cores não é explicado; usuários daltônicos não distinguem verde/vermelho.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** acessibilidade de cores com custo mínimo; ajuda também novos usuários.

### UX-13. Revisar contraste do texto pendente
**Descrição:** testar `--text-faint (#76829f)` sobre o fundo branco do card e, se necessário, escurecer 1 passo (ex.: `#5d6a8a`).
**Problema/oportunidade:** texto pendente em cinza claro sobre branco pode ficar abaixo de 4.5:1 (WCAG AA) no tamanho 26px.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** o texto pendente é 90% do que se vê na tela principal; contraste deficiente cansa a visão.

### UX-14. Espaço visível opcional ("␣")
**Descrição:** opção de exibir espaços pendentes como `␣` esmaecido (o estado `incorrect` do espaço poderia usar o mesmo marcador).
**Problema/oportunidade:** iniciantes não percebem quantos espaços faltam; o erro num espaço é invisível (só a cor muda).
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** o app já usa `␣ (espaço)` no CharStatsDialog — padrão consistente; ajuda no treino de espaçamento.

### UX-15. Tamanho da fonte de digitação configurável
**Descrição:** seletor P/M/G na futura tela de configurações, aplicando `--typing-font-size` (o domínio já tem `typingFontSize`, hoje o valor é fixo `26` no código).
**Problema/oportunidade:** campo existe no modelo de dados e no CSS (`var(--typing-font-size, 26px)`), mas nenhum controle expõe.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** liga dado morto a uma necessidade real (legibilidade em TVs/projetores ou telas pequenas).

### UX-16. Tema escuro
**Descrição:** reativar o seletor de tema usando os tokens dark já completos no `app.css` (`:root[data-theme='dark']`), que hoje são código morto.
**Problema/oportunidade:** treinadores de digitação são usados à noite; o tema claro único força tela clara em ambiente escuro.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** 90% do trabalho já está pronto (tokens + `color-scheme`); falta o toggle e aplicar `settings.theme`.

### UX-17. Cor de destaque configurável
**Descrição:** expor `accentColor`/`caretColor` do domínio como 4–5 amostras de cor na tela de configurações, mapeando para `--accent`/`--caret-underline`.
**Problema/oportunidade:** campos definidos em `Settings` sem qualquer efeito na UI.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** personalização leve, difere apps genéricos; útil para daltônicos trocarem o verde/vermelho do feedback.

### UX-18. Página/central de configurações
**Descrição:** agrupar as opções acima (tema, fonte, cor) num diálogo "Configurações" acessível pela barra superior (ícone de engrenagem).
**Problema/oportunidade:** hoje não há lugar nenhum para ajustar nada; campos do modelo de dados ficam órfãos.
**Prioridade:** Média · **Esforço:** Médio
**Justificativa:** **nó de dependência:** UX-15, UX-16, UX-17 e UX-14 dependem deste contêiner; `useSettings` e persistência já existem.

### UX-19. Botão "Voltar" da Evolução mais claro
**Descrição:** substituir o botão solto no rodapé por destaque no topo (ou voltar automaticamente ao clicar na aba "Praticar", que já existe).
**Problema/oportunidade:** "Voltar" no fim da página duplica a navegação por abas; em histórico longo exige scroll até o fim.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** redundância de navegação confunde a hierarquia; a aba "Praticar" já cumpre o papel.

### UX-20. Tabela de histórico em cartões no mobile
**Descrição:** em telas < 640px, transformar cada linha do histórico em um mini-card empilhado (data + WPM + precisão + ações).
**Problema/oportunidade:** 8 colunas não cabem em 375px; hoje a tabela provavelmente estoura ou comprime a leitura.
**Prioridade:** Alta · **Esforço:** Médio
**Justificativa:** a página Evolução é a segunda mais usada; garantir leitura em celular é ganho real, não cosmético.

### UX-21. Agrupamento por dia no histórico
**Descrição:** separadores de data ("Hoje", "Ontem", "12/09") entre grupos de linhas da tabela.
**Problema/oportunidade:** datas repetidas em sequência poluem a leitura; sessões do mesmo dia não se agrupam visualmente.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** melhora escaneabilidade do histórico sem mudar dados nem ordenação.

### UX-22. Ordenação clicável nas colunas
**Descrição:** clicar no cabeçalho (WPM, Precisão, Data) alterna asc/desc com indicador ▲▼.
**Problema/oportunidade:** hoje a ordem é fixa (data desc, presumida); não dá para ver "meus melhores WPMs".
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** tabela já renderizada em memória; ordenar é trivial e responde perguntas reais ("qual meu melhor dia?").

### UX-23. Tooltip no gráfico de evolução
**Descrição:** ao passar o mouse sobre um ponto, mostrar balão com data, WPM e precisão daquela sessão.
**Problema/oportunidade:** o gráfico SVG não permite ler valores individuais; pontos próximos ficam ilegíveis.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** `<title>` nativo no SVG já resolve a versão mínima (esforço ~10 linhas); legibilidade de dados existentes.

### UX-24. Segundo eixo/rótulo de precisão no gráfico
**Descrição:** marcar 0%, 50% e 100% no lado direito (eixo da linha tracejada verde) para dar escala à linha de precisão.
**Problema/oportunidade:** a precisão é plotada em escala própria (0–100) mas só o eixo do WPM tem rótulos — a linha verde não é interpretável.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** falha de leitura de dados que já estão na tela; corrige com 3 `<text>` adicionais.

### UX-25. Estado vazio com chamada para ação
**Descrição:** na página Evolução vazia, botão "Fazer meu primeiro teste" que navega para Praticar.
**Problema/oportunidade:** a mensagem atual explica, mas não oferece o próximo passo — é um beco sem saída.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** primeiro uso é o momento mais frágil do engajamento; CTA direto elimina a fricção.

### UX-26. Botão "Usar" em Meus textos deve selecionar de fato
**Descrição:** "Usar" deve selecionar o texto como atual da prática (comunicar ao `PracticePage` via estado elevado) e fechar o diálogo.
**Problema/oportunidade:** hoje `onUse` só fecha o diálogo — o botão mente sobre o que faz.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** quebra de promessa da interface; fluxo "criei meu texto → quero digitar" está interrompido no último passo.

### UX-27. Confirmação antes de excluir texto próprio
**Descrição:** mesmo padrão de confirmação inline já usado na exclusão de sessões (Confirmar/Cancelar) para excluir textos.
**Problema/oportunidade:** o clique no ícone de lixeira apaga imediatamente e irreversivelmente um texto do usuário.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** perda de dados do usuário é o pior tipo de erro; o padrão de confirmação já existe no código (consistência).

### UX-28. Remover ou habilitar o select de nível no painel de IA
**Descrição:** o select "Nível" do painel IA está fixo em "Básico" com `onLevelChange` vazio — ou remove-lo, ou ligá-lo ao estado real.
**Problema/oportunidade:** controle interativo que não faz nada transmite aplicação mal acabada.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** dead UI é pior que ausência de UI; escolher entre remover (mais simples) ou funcional (mais útil).

### UX-29. Feedback ao salvar texto gerado por IA
**Descrição:** após gerar, além da mensagem, oferecer botão "Digitar agora" que seleciona o texto (depende de UX-26) e um "Gerar outro".
**Problema/oportunidade:** o painel fecha sozinho (`onUseText`) e o usuário precisa caçar o texto em Meus textos.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** fecha o ciclo gerar→digitar sem passos intermediários; mensagem de sucesso já existe, falta o botão.

### UX-30. Desabilitar "Finalizar" até a sessão iniciar de fato
**Descrição:** `Finalizar` hoje habilita com `running`; como erros não iniciam o cronômetro, é possível "finalizar" com tempo 00:00. Adicionar também confirmação rápida.
**Problema/oportunidade:** finalizar sem nenhuma tecla correta gera resultado vazio salvo no histórico.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** evita poluir o histórico com sessões sem sentido; validação de uma linha no `finish`.

### UX-31. Hierarquia visual do ResultCard
**Descrição:** agrupar as 12 métricas: destaque (WPM gigante), secundárias (Precisão, Tempo, Erros) e terciárias (toques brutos/líquidos/totais, corrigidos/permanentes) em blocos separados por subtítulos.
**Problema/oportunidade:** `result-grid` trata tudo igual; o olho não distingue o que importa.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** o resultado é a tela de maior densidade informacional; hierarquia melhora a leitura sem remover nada.

### UX-32. Comparação com o desempenho anterior no resultado
**Descrição:** sob o WPM final, linha discreta: "+3,2 vs. sua média (▲ 8%)" ou "Novo recorde pessoal!".
**Problema/oportunidade:** o número absoluto não tem significado sem referência.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** os dados históricos já estão no IndexedDB; média e melhor WPM são uma consulta.

### UX-33. Animação de entrada do ResultCard
**Descrição:** fade + leve slide-up (200ms) ao exibir o resultado, respeitando `prefers-reduced-motion`.
**Problema/oportunidade:** a troca brusca tela-de-digitação→resultado é abrupta depois de um esforço concentrado.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** recompensa perceptível ao concluir; o sistema de transições do CSS já existe.

### UX-34. Favicon e meta theme-color
**Descrição:** adicionar favicon (o ícone de teclado já existe em `Icons.tsx` — gerar SVG) e `<meta name="theme-color">`.
**Problema/oportunidade:** aba do navegador mostra o ícone padrão do Vite; em mobile a barra não pega a cor do app.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** primeira impressão e identidade; o recurso é da própria app (favicon ausente hoje).

### UX-35. Título da aba dinâmico durante a sessão
**Descrição:** durante a digitação, refletir o cronômetro no `document.title` ("00:42 — Digitação"); restaurar ao terminar.
**Problema/oportunidade:** usuário que alterna de aba perde a noção do tempo.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** detalhe de polimento de custo baixo que reaproveita o tick de 100ms existente.

### UX-36. Landmarks e skip-link
**Descrição:** `<main>` para o conteúdo, `aria-current` nas abas; skip-link "Pular para o conteúdo".
**Problema/oportunidade:** a estrutura atual usa apenas `div` genérica; leitores de tela não têm pontos de salto.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** acessibilidade estrutural básica; `role="tablist"` já existe — falta completar o padrão.

### UX-37. Respeitar `prefers-color-scheme` na primeira visita
**Descrição:** antes das configurações existirem, aplicar tema conforme o sistema operacional na primeira carga.
**Problema/oportunidade:** hoje `data-theme` é forçado para `light` sempre.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** depende de UX-16; melhora a primeira impressão sem adicionar UI.

### UX-38. Botões de ícone com tooltip
**Descrição:** adicionar `title` (ou tooltip CSS) nos botões de editar/excluir de Meus textos, que hoje só têm `aria-label`.
**Problema/oportunidade:** ícones de lápis e lixeira sem tooltip exigem tentativa-e-erro do usuário vidente.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** duplica o `aria-label` existente; consistência entre affordance visual e semântica.

### UX-39. Reduzir a largura máxima em telas ultra-anchas
**Descrição:** o `max-width: 1080px` é bom, mas o card de digitação em monitores 4K fica com linhas longíssimas; limitar o texto a ~70–80 caracteres por linha (max-width do `.typing-text`).
**Problema/oportunidade:** linhas de digitação longas demais prejudicam o retorno visual do olho.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** prática padrão em apps de digitação (typinator/monkeytype limitam a ~60 chars visíveis).

### UX-40. Espaçamento do timer em telas muito estreitas
**Descrição:** em <480px o timer ocupa linha inteira centralizada; considerar inline menor à esquerda com progresso à direita.
**Problema/oportunidade:** a linha do timer consome ~70px de altura em telas onde cada pixel conta.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** aproveita melhor a área de digitação em celular (junto com UX-22 de touch).

### UX-41. Teclado virtual em dispositivos touch
**Descrição:** ao tocar no card de digitação, focar um `<input>` invisível que recebe `keydown` (o handler global já funciona — basta o input existir para abrir o teclado do SO).
**Problema/oportunidade:** hoje a aplicação é **impossível de usar** em celular/tablet.
**Prioridade:** Alta · **Esforço:** Médio
**Justificativa:** maior oportunidade de público da aplicação; o handler de teclado centralizado torna a mudança isolada. **Depende com:** UX-20 e UX-40 (pacote mobile).

### UX-42. Indicador "…"-de-truncamento mais claro
**Descrição:** substituir o "…" texto por um gradiente de fade na borda do card indicando continuação.
**Problema/oportunidade:** o "…" inline lê-se como parte do texto.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** remove ambiguidade entre conteúdo e affordance de corte.

### UX-43. Estados de hover/focus nos chips de sugestão de tema
**Descrição:** os chips já têm hover; adicionar `:focus-visible` específico e `aria-pressed` em vez da classe `chip-active`.
**Problema/oportunidade:** seleção comunicada só por cor; teclado não recebe feedback distinto.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** padrão correto de ARIA para toggles; melhora acessibilidade do painel IA.

### UX-44. Placeholder do campo de tema com exemplo real
**Descrição:** trocar "Ex.: exploração espacial" por um exemplo que bata com as sugestões mostradas (ex.: "esportes, culinária, viagens…").
**Problema/oportunidade:** coerência entre placeholder e chips — hoje são exemplos diferentes.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** microconsistência que reduz ruído cognitivo no painel de IA.

### UX-45. Dialog com `aria-labelledby`
**Descrição:** dar `id` ao `<h2 class="dialog-title">` e referenciar em `aria-labelledby` (em vez de `aria-label` duplicado).
**Problema/oportunidade:** padrão ARIA correto para diálogos; evita dessincronia entre título visível e label.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** correção técnica de acessibilidade centralizada num único componente (Dialog é usado em 4 lugares).

### UX-46. Scroll da tabela char-table com colunas alinhadas
**Descrição:** `.char-table` usa `display:block` com `max-height` — as colunas perdem alinhamento com muitas linhas; usar wrapper `div` com overflow.
**Problema/oportunidade:** bug visual latente no modal de detalhes por caractere (sessões com 20+ caracteres distintos).
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** defeito real de renderização em dados comuns; correção de CSS puro.

### UX-47. Mensagem de erro da IA mais acionável
**Descrição:** em caso de erro, além da mensagem, botão "Tentar novamente" inline (hoje é preciso reencontrar o botão Gerar).
**Problema/oportunidade:** erros de rede/API são o caso de uso normal do painel IA (requer internet).
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** o estado `error` já existe; transformar a mensagem em ação reduz o custo de retentativa.

### UX-48. Impedir perda de sessão ao fechar a aba
**Descrição:** `beforeunload` quando `status === 'running'` e pelo menos uma tecla digitada, avisando que a sessão será perdida.
**Problema/oportunidade:** fechar a aba por acidente descarta uma sessão em andamento sem aviso.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** protege o dado mais valioso em construção (sessão longa de treino); hook já expõe `running`.

### UX-49. Foco no primeiro campo ao abrir diálogos
**Descrição:** ao abrir Meus textos, focar "Novo texto"; ao abrir o painel IA, focar o campo tema (o Dialog foca o container hoje).
**Problema/oportunidade:** navegação por teclado exige vários Tabs até o primeiro controle útil.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** refina o focus trap já bem implementado; ganho direto para usuários de teclado.

### UX-50. Contraste do indicador de pausa
**Descrição:** `opacity: 0.45` no timer pausado pode cair abaixo do contraste mínimo; usar cor `--text-muted` em vez de opacidade, mantendo o traçado.
**Problema/oportunidade:** o próprio indicador de estado fica ilegível justamente quando precisa comunicar.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** acessibilidade do estado mais incomum da aplicação; combina com UX-05.

---

## Seção 2 — Recursos e funcionalidades (50 melhorias)

### F-01. Modo teste com duração
**Descrição:** reativar o modo `test` (código já suporta `time-up` e `durationSeconds`): 15/30/60s com texto aberto; ao expirar, resultado automático.
**Problema/oportunidade:** `SessionMode`/`DurationId`/`finishReason='time-up'` existem e são testados, mas nunca acessíveis — WPM comparável exige tempo fixo.
**Prioridade:** Alta · **Esforço:** Médio
**Justificativa:** WPM de sessão livre (texto curto) não é comparável entre sessões; modo cronometrado é o padrão da categoria. Reaproveita 100% da lógica existente.

### F-02. Meta diária
**Descrição:** meta configurável (ex.: 3 sessões ou 5 minutos de tempo efetivo/dia) com barra na página Evolução.
**Problema/oportunidade:** não há motivo para voltar amanhã; o tempo efetivo já medido é a unidade perfeita de meta.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** usa a métrica própria da aplicação (tempo efetivo) — coerente com a proposta.

### F-03. Sequência de dias (streak)
**Descrição:** contador de dias consecutivos com pelo menos 1 sessão, exibido no topo da Evolução.
**Problema/oportunidade:** retenção; os dados (`finishedAt`) já permitem calcular.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** gamificação leve, cálculo trivial sobre dados existentes. **Agrupa com:** F-02 e F-33 (pacote de motivação).

### F-04. Consistência de cadência
**Descrição:** métrica de variação do intervalo entre teclas (coeficiente de variação) no resultado e na evolução — digitação fluente tem cadência regular.
**Problema/oportunidade:** WPM alto com cadência irregular indica " rajadas + pausas"; hoje isso é invisível.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** os intervalos já são processados pelo reducer (`lastActiveAt`); basta acumular os gaps. Métrica diferenciadora do app.

### F-05. WPM bruto vs. líquido no resultado
**Descrição:** exibir os dois: bruto (caracteres/tempo sem descontar erros) e líquido (atual).
**Problema/oportunidade:** a diferença entre os dois quantifica o custo dos erros — insight de treino clássico.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** ambos os dados já existem (`grossKeystrokes`, tempo efetivo); apenas aritmética de exibição.

### F-06. Média móvel no gráfico de evolução
**Descrição:** linha de tendência (média de 5 sessões) sobreposta ao gráfico, além dos pontos brutos.
**Problema/oportunidade:** pontos individuais variam muito; a tendência real fica invisível.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** um `<path>` extra no SVG existente; responde "estou melhorando?" com honestidade.

### F-07. Comparação no resultado: "melhor que X% das suas sessões"
**Descrição:** percentil da sessão atual sobre o histórico pessoal.
**Problema/oportunidade:** dá significado absoluto ao resultado atual.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** consulta simples sobre `resultsRepo`; complementa UX-32.

### F-08. Exportar histórico (CSV/JSON)
**Descrição:** botão na Evolução para baixar todas as sessões em CSV (ou JSON completo).
**Problema/oportunidade:** dados presos num IndexedDB invisível; usuário não pode fazer backup nem analisar fora.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** `getAllResults` já existe; exportação é `Blob` + download. Combate a desconfiança "onde meus dados estão?".

### F-09. Importar/backup de textos
**Descrição:** exportar/importar "Meus textos" (JSON) no gerenciador.
**Problema/oportunidade:** textos criados morrem se o navegador for limpo; sem caminho de migração entre dispositivos.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** complemento natural do F-08; mesmo mecanismo técnico.

### F-10. Mapa de calor de teclas (todas as sessões)
**Descrição:** agregado de `charStats` de todo o histórico: teclas mais problemáticas acumuladas, exibidas como tabela/heat simples na Evolução.
**Problema/oportunidade:** o CharStatsDialog é por sessão; a visão agregada ("meu ç falha há 3 semanas") não existe.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** soma simples sobre dados já persistidos; transforma histórico em diagnóstico duradouro.

### F-11. Texto de treino a partir dos erros
**Descrição:** botão "Treinar minhas teclas fracas" que monta um texto-síntese com os caracteres de maior taxa de erro (ou gera via IA com esses caracteres no prompt).
**Problema/oportunidade:** o diagnóstico (F-10) hoje não leva a nenhuma ação.
**Prioridade:** Média · **Esforço:** Médio
**Justificativa:** fecha o ciclo diagnóstico→treino; geração local de pseudo-palavras é suficiente. **Depende de:** F-10.

### F-12. Texto aleatório / surpresa
**Descrição:** botão "Texto aleatório" (do nível atual) que sorteia entre presets + meus textos, direto na prática.
**Problema/oportunidade:** com 1 texto por subtema, a variedade exige navegação manual; a surpresa combate a monotonia.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** `allTexts` já está montado no `PracticePage`; sorteio é uma linha.

### F-13. Repetir o mesmo texto ("treinar este texto")
**Descrição:** no resultado, botão dedicado "Digitar este texto novamente" (além de Reiniciar, que já faz isso — explicitar no label).
**Problema/oportunidade:** memorização de texto é técnica real de treino (reduz WPM de decodificação e isola a digitação).
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** funcionalidade existe (Reiniciar); melhoria é de nomenclatura/descoberta.

### F-14. Modo rígido: erro bloqueia o avanço
**Descrição:** opção em que tecla incorreta NÃO avança a posição (é ignorada até acertar) — treino de precisão pura.
**Problema/oportunidade:** hoje errar avança e exige backspace; modo rígido é treino clássico de precisão.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** branch no `reduceCharacter` (uma linha de lógica) + flag nas configurações; reducer puro facilita testar.

### F-15. Modo sem backspace
**Descrição:** sessão em que Backspace é desabilitado (erros ficam permanentes) para treinar "digitar certo de primeira".
**Problema/oportunidade:** complemento do modo rígido; isola a habilidade de acertar sem correção.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** interceptação no `handleKeyDown` com flag; métricas de erros permanentes já existem e ganham propósito.

### F-16. Retenção/paginação do histórico
**Descrição:** carregar o histórico em blocos de 50, com botão "carregar mais"; opcionalmente auto-podar sessões muito antigas.
**Problema/oportunidade:** `getAllResults` carrega tudo; após meses de uso a página Evolução pesa e a tabela cresce sem fim.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** crescimento inevitável do uso bem-sucedido; paginação client-side é suficiente.

### F-17. Limpar todos os dados
**Descrição:** botão "Apagar todo o histórico" com dupla confirmação, nas configurações.
**Problema/oportunidade:** não há como reiniciar do zero (teste de outra pessoa, recomeço de treino).
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** `clearAll` no resultsRepo é trivial; completa o controle do usuário sobre os próprios dados (com F-08).

### F-18. Estatísticas agrupadas por texto e nível
**Descrição:** na Evolução, aba/seção "por texto" e "por nível": WPM médio por texto digitado, progresso por nível.
**Problema/oportunidade:** `textId`, `textTitle` e `level` já são salvos em cada resultado e nunca usados na análise.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** dados coletados e ignorados; agrupar responde "qual texto me fez mal?" e "estou pronto para o próximo nível?".

### F-19. Latência média por caractere no charStats
**Descrição:** além de tentativas/erros, registrar o intervalo médio de digitação por caractere esperado.
**Problema/oportunidade:** distingue "erro frequente" de "lento mas seguro" — dois problemas de treino diferentes.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** os timestamps de cada tecla já passam pelo reducer; acumular média por `codePoint` é extensão natural do `charStats` (schema novo, compatível com dados antigos).

### F-20. Próximo texto sugerido (fila de prática)
**Descrição:** ao concluir um texto, sugerir automaticamente o próximo do mesmo subtema com botão "Continuar sequência".
**Problema/oportunidade:** reduz a fricção entre sessões consecutivas (resultado → escolher → digitar).
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** a estrutura de temas/subtemas já dá a ordem natural; botão no ResultCard.

### F-21. Texto personalizado colado rapidamente
**Descrição:** botão "Colar texto" na tela de prática: textarea + "Digitar isto" (sem salvar obrigatoriamente em Meus textos).
**Problema/oportunidade:** para digitar um parágrafo avulso (um e-mail, um trecho), o caminho hoje é criar texto no gerenciador com título e nível.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** caso de uso frequente e real; sessão descartável usa `createSession` diretamente. Distinto do TextsManager (que persiste).

### F-22. Lembrar o último texto selecionado
**Descrição:** persistir `selectedTextId` (IndexedDB/localStorage) e reabrir a prática com ele.
**Problema/oportunidade:** a aplicação sempre reabre no preset 1 do primeiro tema, mesmo que o usuário esteja num ciclo de treino de outro texto.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** continuidade de sessão é expectativa básica; persistência de 1 chave.

### F-23. Prévia do texto antes de iniciar
**Descrição:** na escolha de texto, expandir o card (ou modal) mostrando o texto completo antes de começar.
**Problema/oportunidade:** a escolha mostra só 80 caracteres — iniciar um texto ruim (muito técnico, com erros) é surpresa desagradável.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** evita trocas no meio do caminho; `content` já está no card.

### F-24. Contagem regressiva opcional ao iniciar
**Descrição:** opção "3-2-1" antes da primeira tecla contar (para quem posiciona as mãos) — desligada por padrão.
**Problema/oportunidade:** a contagem começa na 1ª tecla correta (bom), mas usuários de teste cronometrado (F-01) gostam de largada sinalizada.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** só faz sentido junto com F-01; **depende de:** F-01.

### F-25. Marcos e conquistas
**Descrição:** badges simples: primeira sessão, 10 sessões, WPM 40/60/80, precisão 98%, streak 7 dias.
**Problema/oportunidade:** nada celebra progresso de longo prazo; a Evolução mostra números, não narrativa.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** cálculo sobre dados existentes; mantém a aplicação motivadora sem virar jogo. **Agrupa com:** F-02/F-03.

### F-26. Nível sugerido automaticamente
**Descrição:** com base no WPM/precisão médios recentes, sugerir "Tente o nível Intermediário" na escolha de texto.
**Problema/oportunidade:** o conceito de nível existe nos dados (e nos textos predefinidos), mas nada orienta a progressão.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** usa os limiares clássicos de WPM; dados e níveis já existem — falta a regra de sugestão.

### F-27. Análise de erro por tecla vizinha (ABNT)
**Descrição:** classificar erros como "tecla adjacente no teclado" vs. "erro de acento" vs. "inversão" no diagnóstico por caractere.
**Problema/oportunidade:** app tem foco ABNT (acentos reforçados na IA) — dizer "seu problema é o cedilha / é trocar mão esquerda" é insight acionável único.
**Prioridade:** Média · **Esforço:** Médio
**Justificativa:** mapa do teclado ABNT é tabela estática; roda sobre `charStats` e `entries`. Diferencial técnico do app.

### F-28. Sugestões de treino no painel Evolução
**Descrição:** card "Diagnóstico": 1–3 frases geradas localmente ("Seu 'ç' tem 22% de erro — vale um treino focado"; "Sua cadência cai em textos longos").
**Problema/oportunidade:** dados ricos, leitura exigente; interpretar sozinho é trabalho do usuário.
**Prioridade:** Média · **Esforço:** Médio
**Justificativa:** é a camada de "inteligência" que valoriza todo o resto; regras locais (sem IA). **Depende de:** F-10, F-19.

### F-29. Detalhes completos da sessão no histórico
**Descrição:** além do modal por caractere, visão do texto digitado com marcações de erros daquela sessão (replay estático).
**Problema/oportunidade:** para revisar onde errou num texto específico, hoje não há como — os dados `errorPositions`/`entries` não são persistidos.
**Prioridade:** Baixa · **Esforço:** Médio
**Justificativa:** exige persistir o mapa de posições (schema novo); útil para usuários avançados, por isso prioridade menor.

### F-30. PWA completo (offline de verdade)
**Descrição:** manifest + service worker para instalar e abrir sem rede (o claim "100% offline" hoje vale só depois do primeiro load, sem garantia).
**Problema/oportunidade:** app 100% offline por design merece instalação na barra/phone; Vite torna simples (vite-plugin-pwa).
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** alinha a promessa do produto com a realidade técnica; melhora carregamento recorrente (cache-first).

### F-31. Compartilhar resultado
**Descrição:** botão "Copiar resultado" (texto formatado: WPM, precisão, tempo) usando `navigator.clipboard`.
**Problema/oportunidade:** nenhum caminho de compartilhamento; apps da categoria vivem de comparação social.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** custo mínimo; opcionalmente `navigator.share` em mobile (junto com UX-41).

### F-32. Busca e ordenação em Meus textos
**Descrição:** campo de busca por título/conteúdo e ordenação (recentes, nível) na lista de textos.
**Problema/oportunidade:** com IA gerando textos, a lista cresce rápido e fica sem ferramentas de localização.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** consequência direta do recurso de IA existente; filtro em memória.

### F-33. Histórico de textos gerados por IA com favoritos
**Descrição:** marcar ★ em textos (meus ou de IA) e filtro "favoritos"; os favoritos aparecem no topo da escolha.
**Problema/oportunidade:** textos bons gerados se perdem no meio da lista; "favorito" é a curadoria mais simples possível.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** campo booleano no `TextEntry` + filtro; melhora o ciclo de reuso do conteúdo de IA.

### F-34. Regenerar variação do mesmo tema
**Descrição:** no painel de IA, botão "Gerar variação" que reusa tema+filtros da última geração (evita reconfigurar).
**Problema/oportunidade:** gerar 3 textos do mesmo tema exige refazer tudo hoje.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** estado do formulário já está em memória no componente; botão extra de custo mínimo.

### F-35. Meta de precisão mínima na sessão
**Descrição:** configuração opcional "repetir texto se precisão < 95%": o resultado sugere (não força) repetir.
**Problema/oportunidade:** velocidade sem precisão não é progresso; nenhuma regra atual incentiva o equilíbrio.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** mensagem condicional no ResultCard; respeita autonomia do usuário.

### F-36. Gráfico semanal (média por dia)
**Descrição:** alternar o gráfico entre "por sessão" e "por dia" (média de WPM/precisão do dia) — suaviza e reduz pontos duplicados de datas.
**Problema/oportunidade:** quem faz 5 sessões/dia vê 5 pontos com o mesmo rótulo de data — ilegível.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** agregação sobre `results` já carregados; mesmo componente SVG com parâmetro.

### F-37. Filtro de período na Evolução
**Descrição:** seletor "últimos 7 / 30 / 90 dias / tudo" que filtra resumo, gráfico e histórico de uma vez.
**Problema/oportunidade:** o resumo mistura sessões de meses atrás com as de hoje; progresso recente fica diluído.
**Prioridade:** Alta · **Esforço:** Pequeno
**Justificativa:** único filtro de contexto que a página precisa; aplica-se a todos os blocos existentes (memo já recalcula).

### F-38. Ver resultado imediatamente após "time-up"
**Descrição:** no modo teste (F-01), transição automática para o ResultCard com destaque "Tempo esgotado".
**Problema/oportunidade:** fluxo já suportado pelo reducer (`finishReason='time-up'` testado); falta só a experience completa.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** parte do pacote F-01; **depende de:** F-01.

### F-39. Aviso de texto incompleto no resultado
**Descrição:** se finalizou manualmente com texto pela metade, ResultCard mostra "Você digitou 43% do texto" com contexto.
**Problema/oportunidade:** sessões manuais parciais entram no histórico sem sinalização — distorcem médias comparadas com sessões completas.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** `charsCorrect/charsTotal` já está no card; falta o enquadramento interpretativo.

### F-40. Atalho Enter no resultado
**Descrição:** no estado `finished`, Enter dispara "Novo teste" (reiniciar) — evita ir ao mouse a cada sessão.
**Problema/oportunidade:** o foco fica órfão após finalizar; fluxo repetitivo exige clique.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** microciclo de treino (digitar→ver→repetir) é o loop central da aplicação; Enter é o atalho natural.

### F-41. Persistir o modo de prática escolhido
**Descrição:** com F-01, lembrar se o usuário estava em teste cronometrado ou prática livre (campo `defaultMode` já existe em `Settings`, órfão).
**Problema/oportunidade:** mais um campo do domínio sem efeito; continuidade entre visitas.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** liga dado morto com esforço mínimo. **Depende de:** F-01.

### F-42. Palavras concluídas ao vivo
**Descrição:** contador discreto "12/48 palavras" junto ao WPM ao vivo (UX-03).
**Problema/oportunidade:** progresso em unidades significativas; motiva mais que caracteres.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** `completedWords` já existe em `metrics.ts` — só exibir.

### F-43. Detecção de digitação sem olhar o texto (modo escuro do texto)
**Descrição:** modo "texto oculto": caracteres corretos viram asteriscos/borrados, forçando digitar lendo o texto de referência em painel separado.
**Problema/oportunidade:** treino avançado de ditado interno; diferencial educacional.
**Prioridade:** Baixa · **Esforço:** Médio
**Justificativa:** recurso avançado opcional; só depois do básico polido.

### F-44. Duas mãos / aquecimento guiado
**Descrição:** sequência de "aquecimento" de 30s (ex.: home row → letras comuns → palavra) antes da sessão, opcional.
**Problema/oportunidade:** digitar frio infla os erros das primeiras linhas e distorce a média da sessão.
**Prioridade:** Baixa · **Esforço:** Médio
**Justificativa:** melhora a qualidade dos dados das sessões (e o desempenho real); geração local de sequências.

### F-45. Sessão válida: critério mínimo
**Descrição:** configuração "só contar sessões com ≥ X caracteres" (ex.: 100) para o resumo da Evolução.
**Problema/oportunidade:** sessões de teste de 2 teclas puxam a média para baixo e poluem o histórico.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** filtro no `summary` existente; dá significado estatístico ao "WPM médio".

### F-46. Cronômetro configurável de pausa por inatividade
**Descrição:** expor os 3s de `IDLE_PAUSE_MS` como configuração (2s / 3s / 5s) para usuários mais lentos.
**Problema/oportunidade:** iniciante reais pausam > 3s entre palavras e veem o timer piscar em pausa constantemente — pode frustrar.
**Prioridade:** Baixa · **Esforço:** Pequeno
**Justificativa:** constante já centralizada em `timing.ts`; depende da central de configurações (UX-18).

### F-47. Teclado numérico e símbolos nos presets
**Descrição:** adicionar textos predefinidos com números, datas e pontuação densa (hoje os 8 presets são quase só prosa).
**Problema/oportunidade:** a IA tem filtro "com números", mas o conteúdo predefinido não treina a linha numérica.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** conteúdo estático (novo arquivo de dados); completa a cobertura de treino offline sem depender de IA.

### F-48. Comparação entre sessões do mesmo texto
**Descrição:** no histórico, sessões do mesmo `textId` agrupáveis; ver "2ª vez neste texto: +12 WPM".
**Problema/oportunidade:** repetir texto é técnica (F-13) — medir a melhora no mesmo texto é a métrica mais justa de progresso.
**Prioridade:** Média · **Esforço:** Pequeno
**Justificativa:** `textId` já persistido; agrupamento na tabela e no detalhe.

### F-49. Espaço de prática sem texto (digitação livre com contagem)
**Descrição:** modo "digite o que quiser" que mede WPM/precisão do fluxo livre (sem alvo), terminando por Finalizar.
**Problema/oportunidade:** nem todo momento de uso é treino estruturado; medir o dia a dia real tem valor.
**Prioridade:** Baixa · **Esforço:** Médio
**Justificativa:** exige variante do reducer sem `target` (validação vira aceitar-tudo); manter separado do modo normal para não poluir.

### F-50. Detecção de layout de teclado
**Descrição:** inferir layout (ABNT vs. US) pelos caracteres digitados quando erros em acentos se concentram, e ajustar dicas de treino.
**Problema/oportunidade:** app focado em ABNT assume o layout; usuários com teclado US recebem erros "falsos" de acento.
**Prioridade:** Baixa · **Esforço:** Médio
**Justificativa:** refinamento do diagnóstico (F-27); só vale a pena depois do básico do diagnóstico existir.

---

## Agrupamentos e dependências identificadas

| Pacote | Itens | Racional |
|---|---|---|
| **Configurações (fundação)** | UX-18 + UX-14, 15, 16, 17, 46, F-41, F-45, F-46 | Criar a central de configurações uma vez e ligar todos os campos órfãos do domínio `Settings` |
| **Mobile/touch** | UX-41 + UX-20, UX-40, F-31 (share) | Input virtual é a peça-chave; o resto adapta layout para o novo público |
| **Histórico/evolução** | UX-20, 22, 23, 24, 37 + F-16, F-36, F-37, F-48 | Mesma página, mesmo conjunto de dados — implementar em levas na página Evolução |
| **Motivação/gamificação** | F-02, F-03, F-25 + UX-32, UX-33 | Meta, streak e marcos compartilham cálculos sobre `finishedAt` |
| **Diagnóstico de erros** | F-10, F-11, F-19, F-27, F-28, F-50 | Heatmap → latência → análise ABNT → sugestões; cadeia progressiva sobre `charStats` |
| **Modo teste cronometrado** | F-01 + F-24, F-38, F-41 | Reativação do modo `test` com seus complementos de fluxo |
| **Ciclo gerar→digitar (IA)** | UX-26, UX-29, UX-47 + F-32, F-33, F-34 | Consertar "Usar" é o pré-requisito; os demais refinam o fluxo de conteúdo |

---

## Conclusão — principais oportunidades

1. **Consertar as promessas quebradas da interface** (Alta, esforço mínimo): botão "Usar" que não usa (UX-26), select de nível que não muda nada (UX-28), botões que capturam o espaço (UX-01), exclusão sem confirmação (UX-27). São defeitos de confiança com correções triviais — o melhor custo/benefício de toda a lista.
2. **Dar visibilidade ao progresso durante a digitação** (Alta): barra de progresso (UX-02), WPM ao vivo (UX-03) e rótulo de pausa (UX-05) usam dados que já são calculados a cada 100ms — pura renderização.
3. **Tornar a aplicação utilizável em celular** (Alta): teclado virtual (UX-41) + histórico em cartões (UX-20) multiplicam o público possível; hoje a aplicação é desktop-only na prática.
4. **Ativar o modo teste cronometrado** (Alta, F-01): todo o suporte (`time-up`, durações, WPM comparável) já existe no código e nos testes — falta conectar a UI. É o recurso que dá significado comparativo às estatísticas.
5. **Transformar histórico em diagnóstico** (Médio): heatmap de teclas (F-10) → treino focado (F-11) → sugestões automáticas (F-28). É o caminho para a aplicação "ensinar", não apenas medir — diferencial competitivo real, construído inteiramente sobre dados que já são coletados hoje.
6. **Ligar os campos órfãos do domínio** (Médio): tema escuro, tamanho de fonte, cor de destaque, modo padrão — o modelo de dados e o CSS já têm quase tudo; falta a central de configurações (UX-18) como contêiner.
