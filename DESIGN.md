---
name: Forest Flow
description: Quadro semanal da equipe em uma sala petróleo onde a luz limão é escassa e sempre significa algo.
colors:
  ink-0: '#0a252a'
  ink-1: '#0c2a30'
  ink-2: '#103a41'
  ink-3: '#164850'
  ink-4: '#1d5560'
  line: 'rgba(255, 255, 255, 0.1)'
  line-strong: 'rgba(255, 255, 255, 0.18)'
  glass: 'rgba(255, 255, 255, 0.045)'
  glass-strong: 'rgba(255, 255, 255, 0.08)'
  well: 'rgba(0, 0, 0, 0.22)'
  text: '#f3f6f4'
  text-2: '#a6bdb9'
  text-3: '#7d9a96'
  lime: '#c5f249'
  lime-hover: '#d3f76a'
  lime-soft: 'rgba(197, 242, 73, 0.14)'
  lime-line: 'rgba(197, 242, 73, 0.45)'
  kraft: '#b19873'
  kraft-bright: '#d9bf95'
  kraft-soft: 'rgba(177, 152, 115, 0.18)'
  lilac: '#c1b4ee'
  lilac-soft: 'rgba(193, 180, 238, 0.16)'
  danger: '#f08a7e'
  danger-soft: 'rgba(240, 138, 126, 0.14)'
  danger-text: '#ffd1ca'
  scrim: 'rgba(3, 14, 17, 0.6)'
  ground-glow: '#0f3339'
  lamp-lit: '#1f5d67'
  danger-ink: '#2a0d09'
typography:
  display:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '28px'
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: '-0.02em'
  numeral:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '32px'
    fontWeight: 600
    lineHeight: 1
    letterSpacing: '-0.02em'
    fontVariation: 'tabular-nums'
  headline:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '20px'
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: '-0.01em'
  title:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: '-0.01em'
  body:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  body-sm:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '13px'
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 'normal'
  label:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '13px'
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 'normal'
  caption:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '12px'
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 'normal'
  brand:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '19px'
    fontWeight: 700
    lineHeight: 1
    letterSpacing: '-0.02em'
  root:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '16px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  screen-title:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '24px'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.02em'
  dialog-title:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '22px'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.01em'
  section:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '17px'
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: '-0.01em'
  micro:
    fontFamily: 'Sora, Segoe UI, system-ui, sans-serif'
    fontSize: '11px'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0.02em'
rounded:
  indicator: '2px'
  magnet: '3px'
  focus: '4px'
  chip-sm: '6px'
  note: '7px'
  ctl: '8px'
  card: '10px'
  panel: '14px'
  dialog: '18px'
  pill: '999px'
  round: '50%'
spacing:
  xs: '4px'
  sm: '8px'
  md: '10px'
  base: '12px'
  lg: '14px'
  xl: '16px'
  2xl: '18px'
  3xl: '22px'
  4xl: '26px'
  page: '30px 36px'
components:
  button-primary:
    backgroundColor: '{colors.lime}'
    textColor: '{colors.ink-0}'
    typography: '{typography.label}'
    rounded: '{rounded.ctl}'
    padding: '0 18px'
    height: '40px'
  button-primary-hover:
    backgroundColor: '{colors.lime-hover}'
    textColor: '{colors.ink-0}'
  button-primary-ghost-invalid:
    backgroundColor: 'transparent'
    textColor: '{colors.lime}'
  button-secondary:
    backgroundColor: '{colors.glass}'
    textColor: '{colors.text}'
    typography: '{typography.label}'
    rounded: '{rounded.ctl}'
    padding: '0 16px'
    height: '40px'
  button-secondary-hover:
    backgroundColor: '{colors.glass-strong}'
    textColor: '{colors.text}'
  button-text:
    backgroundColor: 'transparent'
    textColor: '{colors.text-2}'
    typography: '{typography.label}'
    rounded: '{rounded.chip-sm}'
    padding: '6px 8px'
  button-text-hover:
    backgroundColor: '{colors.lime-soft}'
    textColor: '{colors.lime}'
  button-icon:
    backgroundColor: '{colors.glass}'
    textColor: '{colors.text-2}'
    rounded: '{rounded.ctl}'
    padding: '8px'
  button-danger:
    backgroundColor: 'transparent'
    textColor: '{colors.danger}'
    typography: '{typography.label}'
    rounded: '{rounded.ctl}'
    padding: '0 14px'
    height: '40px'
  button-danger-confirm:
    backgroundColor: '{colors.danger}'
    textColor: '#2a0d09'
  input:
    backgroundColor: '{colors.well}'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    rounded: '{rounded.ctl}'
    padding: '11px 13px'
  input-focus:
    backgroundColor: 'rgba(0, 0, 0, 0.3)'
    textColor: '{colors.text}'
  input-readonly:
    backgroundColor: 'rgba(255, 255, 255, 0.03)'
    textColor: '{colors.text-2}'
  card-task:
    backgroundColor: '{colors.ink-2}'
    textColor: '{colors.text}'
    rounded: '{rounded.card}'
    padding: '14px 16px 12px'
  card-task-hover:
    backgroundColor: '{colors.ink-3}'
    textColor: '{colors.text}'
  column:
    backgroundColor: 'rgba(0, 0, 0, 0.16)'
    textColor: '{colors.text-2}'
    rounded: '{rounded.panel}'
    padding: '8px'
  sidebar-glass:
    backgroundColor: '{colors.glass}'
    textColor: '{colors.text-2}'
    padding: '26px 16px 20px'
    width: '236px'
  stats-glass:
    backgroundColor: '{colors.glass}'
    textColor: '{colors.text-2}'
    rounded: '{rounded.panel}'
    padding: '18px 20px'
  panel-side:
    backgroundColor: '{colors.ink-1}'
    textColor: '{colors.text}'
    padding: '22px 26px'
    width: '520px'
  dialog:
    backgroundColor: '{colors.ink-1}'
    textColor: '{colors.text}'
    rounded: '{rounded.dialog}'
    padding: '22px 26px'
    width: 'min(1040px, 100%)'
  auth-card:
    backgroundColor: '{colors.ink-1}'
    textColor: '{colors.text}'
    rounded: '{rounded.dialog}'
    padding: '34px 36px 30px'
    width: 'min(440px, 100%)'
  chip-member:
    backgroundColor: '{colors.glass}'
    textColor: '{colors.text-2}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '0 12px 0 10px'
    height: '32px'
  chip-count:
    backgroundColor: 'rgba(255, 255, 255, 0.07)'
    textColor: '{colors.text-2}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '2px 8px'
  chip-priority-high:
    backgroundColor: '{colors.kraft-soft}'
    textColor: '{colors.kraft-bright}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '2px 9px'
  chip-coordinator:
    backgroundColor: '{colors.lilac-soft}'
    textColor: '{colors.lilac}'
    typography: '{typography.caption}'
    rounded: '{rounded.pill}'
    padding: '5px 11px'
  nav-item:
    backgroundColor: 'transparent'
    textColor: '{colors.text-2}'
    typography: '{typography.label}'
    rounded: '{rounded.ctl}'
    padding: '0 12px 0 14px'
    height: '42px'
  nav-item-active:
    backgroundColor: '{colors.lime-soft}'
    textColor: '{colors.lime}'
  block-note:
    backgroundColor: '{colors.kraft-soft}'
    textColor: '{colors.kraft-bright}'
    typography: '{typography.body-sm}'
    rounded: '7px'
    padding: '9px 11px'
  toast:
    backgroundColor: 'rgba(12, 42, 48, 0.9)'
    textColor: '{colors.text}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '12px 18px'
  avatar:
    backgroundColor: '{colors.lilac}'
    textColor: '#ffffff'
    rounded: '{rounded.round}'
    size: '36px'
---

# Design System: Forest Flow

## Overview

**Creative North Star: "Luz na fábrica à noite"**

O Forest Flow é uma sala petróleo depois do expediente: o chão é o Verde Escuro da Forest Paper (`ink-0`) com profundidade feita de dois gradientes radiais fixos e duas luzes ambiente lentas (uma na cor de quem está usando, outra roxa) que derivam por 46–58 s e param quando a aba fica oculta. Dentro dessa sala a luz limão é escassa de propósito: ela aparece só onde há ação (o único botão sólido da tela), estado ativo (aba, foco, caret, seleção) ou confirmação (toast, histórico, luminária acesa). Tudo o que precisa ser lido fica em papel opaco (`ink-1`/`ink-2`); o vidro existe só na casca (trilho lateral, faixa de resumo, scrims e toast), nunca em cartão ou formulário.

A densidade é de ferramenta de uso diário: corpo em 14 px, cartões de 14×16 px de respiro, hairlines de 1 px em branco 10 % separando tudo. Cada status tem uma tinta única (andamento = limão, bloqueado = kraft, concluído = roxo) usada no ícone da placa, no resumo, no painel e no pulso da coluna; a cor da pessoa é dado dela (escolhida em Integrantes) e aparece apenas como um ímã de 22×6 no canto do cartão e como avatar sólido. O movimento é curto e só na montagem: subida de 12 px com ease-out exponencial, escalonada em 50 ms, desligada depois que o quadro assenta e por completo em `prefers-reduced-motion`.

O que a construção recusou e não deve voltar: o kanban cinza-claro de SaaS, o dark mode com neon em todo canto, o verde `#24563e` do site antigo (não é da marca), bordas grossas de cor por responsável e qualquer logo da empresa (a marca é o símbolo próprio do app em `src/Brand.tsx`).

**Key Characteristics:**

- Chão `ink-0` com gradiente radial e duas luzes ambiente desfocadas (blur 80 px, opacidade 0,16/0,12), pausadas fora de vista.
- Vidro (branco 4,5 % + blur 16–18 px + hairline) só na casca; papel opaco onde se lê.
- Limão como luz escassa: um botão sólido por tela, aba ativa, foco, confirmação.
- Uma tinta por status: limão, kraft, roxo; cor do responsável só como ímã 22×6 e avatar.
- Sora variável self-hosted, única família, números tabulares.
- Motion: `cubic-bezier(0.16, 1, 0.3, 1)`, 160/260/600 ms, escalonamento 50 ms, entrada só na montagem.

## Colors

Paleta oficial da Forest Paper sobre uma rampa petróleo de cinco degraus, com cada acento diluído em uma versão "soft" (14–18 % de alfa) para fundos e uma "line" (45 %) para contornos.

### Primary

- **Verde Claro / Limão** (`lime`): a luz da sala. Botão primário sólido, aba ativa e seu indicador, anel de foco (`outline: 2px`), caret, `::selection`, ícone da placa "Em andamento", bolinha da linha do tempo no histórico, ícone do toast, cúpula da luminária acesa. A versão clara `lime-hover` só no hover do botão primário.
- **Limão suave** (`lime-soft`): fundo do indicador de navegação, hover do botão de texto e do "Adicionar atividade", halo de foco dos campos (`0 0 0 3px`), coluna como alvo de soltar, aviso de sucesso.
- **Limão linha** (`lime-line`): borda do formulário de integrante, do toast e do botão primário em estado fantasma (login inválido), borda do cartão de perfil em hover.

### Secondary

- **Bege Kraft** (`kraft` / `kraft-bright`): bloqueio e atenção, aceso enquanto durar. `kraft-bright` é a versão legível em texto (nota de bloqueio, "Alta prioridade", ícone da placa "Bloqueado", número do resumo quando há bloqueio, rótulo do motivo obrigatório); `kraft` puro só em bordas (coluna bloqueada como alvo de soltar) e no pulso da placa.
- **Kraft suave** (`kraft-soft`): fundo da nota de bloqueio, do selo de prioridade alta, do aviso de importação e do ícone de resumo "Precisam de atenção".

### Tertiary

- **Roxo Destaque / Lilás** (`lilac`): coordenação e concluído. Ícone da placa "Concluído", selo "Coordenação", ícone do workspace, cor-padrão de `--member-color`, segunda luz ambiente.
- **Lilás suave** (`lilac-soft`): fundo dos selos de coordenação e do ícone de resumo "Concluídas".

### Neutral

- **Verde Escuro / chão** (`ink-0`): fundo do documento, `theme-color`, texto sobre limão.
- **Papel 1** (`ink-1`): painel lateral, diálogo de importação, cartão de login, formulário de integrante, fundo das opções de `select`, barra fixa de ações.
- **Papel 2** (`ink-2`): cartões de tarefa, registros de integrante, opções de perfil, comentários, bloco de continuidade.
- **Papel 3 / 4** (`ink-3`, `ink-4`): hover dos cartões e perfis; `ink-4` é só a cor do scrollbar fino.
- **Poço** (`well`, preto 22 %): fundo de campos de texto, busca e filtro; escurece para preto 30 % em foco.
- **Hairline** (`line`) e **hairline forte** (`line-strong`): toda divisória, borda de cartão e coluna (`line`); bordas de controles, campos e painéis (`line-strong`).
- **Vidro** (`glass`, `glass-strong`): casca e botões secundários; `glass-strong` no hover e no seletor de semana.
- **Texto** (`text`), **texto secundário** (`text-2`, verde-acinzentado), **texto terciário** (`text-3`, placeholder, rodapé, legendas).
- **Perigo** (`danger`, `danger-soft`, `danger-text`): só exclusão e mensagens de erro; nunca para status do quadro.
- **Scrim** (`scrim`, preto-petróleo 60 %, 70 % no diálogo): fundo dos overlays com blur de 3–4 px.

### Named Rules

**The Scarce Light Rule.** Existe uma única superfície limão sólida por tela (o botão primário). Todo outro limão é linha, texto, halo ou fundo a 14 %. Se duas áreas sólidas de limão aparecem juntas, uma delas está errada.

**The One Ink Per Status Rule.** Em andamento é limão, Bloqueado é kraft, Concluído é lilás, em todo lugar (placa, resumo, painel, pulso). Nenhum status usa vermelho; `danger` é só para excluir e para erro de sistema.

**The Member Magnet Rule.** A cor do integrante é dado do usuário (escolhida em Integrantes, sugestões em `src/Members.tsx`), e aparece no cartão apenas como ímã de 22×6 px no canto superior esquerdo, como avatar sólido redondo, como ponto de 9 px no chip de filtro e como luz ambiente de quem está logado. Nunca como borda grossa, nunca como fundo de cartão.

## Typography

**Display Font:** Sora (variável 100–800, self-hosted em `/fonts/sora-latin.woff2`, com Segoe UI, system-ui, sans-serif)
**Body Font:** Sora (mesma família)
**Label/Mono Font:** não há; números usam `font-variant-numeric: tabular-nums` global.

**Character:** Uma família só, geométrica e levemente técnica, com pesos 300 (o "flow" da marca), 400 (corpo), 500 (rótulos, botões secundários, navegação), 600 (títulos, botão primário, números) e 700 (marca e iniciais de avatar). `font-synthesis: none` evita pesos falsos. Títulos têm `letter-spacing` negativo (−0,01 em, −0,02 em nos maiores) e `text-wrap: balance`.

### Hierarchy

- **Display** (600, 28 px, 1.15, −0,02 em): título da aba no topo (`h1`); cai para 24 px abaixo de 640 px e no cartão de login.
- **Numeral** (600, 32 px, 1, tabular): os quatro números da faixa de resumo, com contagem animada de 600 ms na montagem; 26 px no celular.
- **Headline** (600, 20–22 px, 1.3): título do painel lateral (20), cabeçalho de Integrantes (20), do diálogo de importação (22), do formulário de integrante (18).
- **Title** (600, 15 px, 1.4): título do cartão de tarefa e do registro de integrante; 17 px no `h2` de seção do quadro; 14 px nas placas de coluna, `h3` do painel e nome de perfil.
- **Body** (400, 14 px, 1.5): corpo do documento, campos, comentários, checklist, navegação.
- **Body small** (400, 13 px, 1.55): descrição do cartão (clamp de 3 linhas), rodapé do cartão, subtítulos, avisos, chips de integrante.
- **Label** (500, 13 px): rótulos de campo em `text-2`, com o texto do rótulo em limão dentro de painéis e formulários.
- **Caption** (500–600, 12 px): contagens em pílula, selos de prioridade/papel, rodapé da página, dicas sob campos, data do histórico. O mínimo do sistema é 11 px, usado só no sub-rótulo da marca, no selo "Coordenação" e no cabeçalho "Bloqueio" da nota.
- **Brand** (700, 19 px, 1, −0,02 em): "forest" em 700 + "flow" em 300, com "Forest Paper" em 11 px/500 kraft-bright abaixo.

### Named Rules

**The Tabular Numbers Rule.** Todo número (contagens, datas, resumo) é tabular por herança do `:root`; nenhuma superfície desliga isso.

**The No Uppercase Rule.** O sistema não usa caixa alta nem letter-spacing positivo acima de 0,04 em; hierarquia vem de peso e cor, não de tracking.

## Layout

Casca em grade de duas colunas: trilho fixo de 236 px (sticky, altura da viewport) + conteúdo `minmax(0, 1fr)` com largura máxima de 1760 px, centrado, respiro de 30 px em cima e 36 px nas laterais. O conteúdo é uma pilha vertical com `gap: 22px` (cabeçalho da página, linha da semana, faixa de resumo, toolbar do quadro, legenda de responsáveis, quadro) e um rodapé empurrado para o fim com `margin-top: auto`.

O quadro é `repeat(3, minmax(260px, 1fr))` com `gap: 16px` e altura mínima `max(480px, 100vh − 360px)`; cada coluna tem 8 px de respiro interno e cartões empilhados com `gap: 10px`. O resumo é uma grade de 4 colunas separadas por hairlines internas. Reunião é duas colunas iguais com `gap: 18px`. Formulários usam `field-row` de 2 colunas com `gap: 14px` (18×20 px no formulário de integrante; `2fr 1fr 1fr 1fr` na importação).

Ritmo de espaçamento observado: 4 / 8 / 10 / 12 / 14 / 16 / 18 / 22 / 26 px. Padding interno de painel e diálogo é 22–24 px vertical × 26 px horizontal; cartões 14×16 px; controles 40 px de altura (44 px no botão de login e na navegação do celular).

Breakpoints:

- **≤ 1180 px**: trilho encolhe para 204 px, conteúdo com 24 px de respiro, busca com 150 px, quadro com `gap: 12px`.
- **≤ 920 px**: trilho vira rail de 72 px só com ícones (22 px) e avatar; resumo em 2×2; quadro rola horizontalmente com colunas de 250 px; reunião em uma coluna.
- **≤ 640 px**: trilho vira barra inferior fixa (fundo `ink-0` a 96 %, sem vidro); sem luzes ambiente nem luminária; `backdrop-filter` desligado em tudo; quadro em uma coluna; painel e diálogo com 16–18 px de respiro; formulários em uma coluna. Confirmado no PRODUCT.md: o uso real é desktop; o celular só precisa continuar legível.

## Elevation & Depth

Híbrido de camadas tonais e sombras com offset e blur. A profundidade de base vem da rampa `ink-0 → ink-1 → ink-2 → ink-3` (cada camada opaca que sobe fica um degrau mais clara) e de hairlines de 1 px. O vidro (`backdrop-filter: blur(16–18px)` sobre branco 4,5 %) é exclusivo da casca: trilho, faixa de resumo, scrims (blur 3–4 px) e toast (blur 14 px). Cartões ficam quase planos em repouso (`0 1px 2px` preto 30 %) e sobem 2 px com `shadow-1` no hover; painéis, diálogos, cartão de login e toast usam `shadow-2` fixa. Luz é a outra forma de profundidade: halo de foco em limão 14 %, spotlight que segue o cursor na faixa de resumo (limão 10 %) e nas opções de perfil (branco 10 %), glow do avatar de perfil, drop-shadow limão sob a marca.

### Shadow Vocabulary

- **Repouso do cartão** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3)`): cartão de tarefa parado.
- **shadow-1** (`box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28), 0 10px 28px rgba(0, 0, 0, 0.28)`): hover de cartão, registro de integrante e opção de perfil; formulário de integrante em repouso.
- **shadow-2** (`box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4), 0 28px 60px rgba(0, 0, 0, 0.4)`): painel lateral, diálogo de importação, cartão de login, toast.
- **Halo de foco** (`box-shadow: 0 0 0 3px rgba(197, 242, 73, 0.14)` + borda limão): campos, busca e filtro em foco.
- **Halo de destino** (`box-shadow: 0 0 0 4px rgba(197, 242, 73, 0.12)`; kraft 14 % na coluna Bloqueado): coluna recebendo um cartão arrastado.
- **Glow primário** (`0 6px 18px rgba(197, 242, 73, 0.25)` + `inset 0 1px 0` branco 35 %): hover do botão primário.
- **Luminária acesa** (`0 0 10px 3px rgba(197, 242, 73, 0.75), 0 0 40px 10px rgba(197, 242, 73, 0.3)`): lâmpada do login após autenticar.

### Named Rules

**The Glass Shell Rule.** `backdrop-filter` só aparece em trilho, faixa de resumo, scrims e toast. Cartão, coluna, painel, diálogo e formulário são opacos (`ink-1`/`ink-2`); se um texto longo está sobre vidro, está no lugar errado.

**The Lift On Hover Rule.** Superfícies clicáveis sobem 1–2 px e trocam `line` por `line-strong` no hover; a sombra responde ao estado, nunca é decoração em repouso (exceto painéis flutuantes, que já nascem elevados).

## Shapes

Cantos arredondados em quatro degraus proporcionais à escala do elemento: 8 px em controles (botões, campos, itens de navegação, ícone do workspace a 7 px), 10 px em cartões e registros, 14 px em painéis, colunas e opções de perfil, 18 px em diálogos e no cartão de login. Elementos de contagem, selos, chips de integrante e o toast são pílulas (999 px); avatares, pontos e swatches são círculos. O anel de foco tem 4 px de raio.

Bordas são sempre hairlines de 1 px (`line` ou `line-strong`); as únicas bordas que mudam de estilo são tracejadas, e significam "lugar vazio ou em trânsito": o "Adicionar atividade", o cartão sendo arrastado, a coluna pronta para receber, a instrução de soltar e campos somente leitura. O ímã do responsável é um retângulo 22×6 de raio 3 px. A luminária é uma cúpula trapezoidal via `clip-path: polygon(32% 0, 68% 0, 100% 100%, 0 100%)` com haste de 2 px; o cone de luz é um `conic-gradient` de 38° mascarado para o chão.

## Components

### Buttons

Confiantes e baixos: altura fixa de 40 px, texto 500–600, feedback de 160 ms.

- **Shape:** cantos de controle (8 px); botão de texto e ações de perfil usam 6 px.
- **Primary:** limão sólido com texto `ink-0`, 600, `padding: 0 18px`, `min-width: 132px`, linha interna de luz (`inset 0 1px 0` branco 35 %). É a única superfície limão sólida da tela. No login, enquanto o formulário é inválido e a sala está apagada, ele vira fantasma (transparente, texto limão, `inset 0 0 0 1px lime-line`).
- **Hover / Focus:** hover clareia para `lime-hover`, sobe 1 px e ganha o glow limão; `:active` volta a 0 e encolhe para 0,985; `:disabled` a 55 % sem sombra. Foco segue o anel global (limão 2 px, offset 2 px).
- **Secondary:** vidro (`glass`) com borda `line-strong`, texto 500, `padding: 0 16px`; hover para `glass-strong` e borda branco 30 %.
- **Text:** só texto em `text-2`, `padding: 6px 8px`; hover em limão sobre `lime-soft`.
- **Icon:** 8 px de padding, borda `line`, fundo `glass`, ícone em `text-2`.
- **Danger:** transparente com borda `danger` a 35 %; em modo confirmar fica sólido `danger` com texto `#2a0d09`. Fica à esquerda (`margin-right: auto`) para longe do salvar.
- **Busy:** `data-busy` esconde o texto e desenha um spinner de 18 px (borda 2 px, 0,8 s linear) na cor do texto do botão.

### Chips

- **Integrante (filtro):** pílula de 32 px, vidro + hairline, ponto de 9 px na cor da pessoa com anel branco 12 %; hover sobe 1 px; selecionado usa `color-mix(in srgb, var(--member-color) 28%, transparent)` com borda na cor da pessoa.
- **Contagem:** pílula branco 7–8 %, 12 px/600, `padding: 2px 8px`; dentro da aba ativa vira limão 18 % com texto limão.
- **Alta prioridade:** pílula kraft (`kraft-soft` + `kraft-bright`), 12 px/600.
- **Coordenação / papel:** pílula lilás (`lilac-soft` + `lilac`), 12 px/500; papel comum em branco 7 %.
- **Selo "você"** no registro de integrante: pílula `lime-soft` + limão, 11 px/600.

### Cards / Containers

- **Cartão de tarefa:** opaco `ink-2`, hairline `line`, 10 px, `padding: 14px 16px 12px`, sombra de repouso. Ímã 22×6 na cor do responsável em `top: 18px; left: 16px`; linha superior (`task-top`) com 32 px de recuo à esquerda, restrito (cadeado 14 px) e seta `ArrowUpRight` de 15 px que só aparece no hover em limão. Rodapé com hairline, avatar 24 px + nome em `text-2` e prazo em `text` 500. Em Concluído o título cai para `text-2`. Arrastando: opacidade 0,4 e borda tracejada. Entrada: `rise` 0,5 s com `calc(min(var(--i), 12) * 50ms)`, desligada por `is-settled`.
- **Nota de bloqueio:** bloco `kraft-soft` dentro do cartão, 7 px, com cabeçalho "Bloqueio" em 11 px/600 gerado por `::before`.
- **Coluna:** preto 16 % + hairline, 14 px, 8 px de respiro; placa com ícone na tinta do status + nome 14 px/600 + contagem; pulso `plate-pulse` de 0,9 s na tinta do status quando recebe cartão; alvo de soltar acende em `lime-soft`/limão (kraft na coluna Bloqueado).
- **Faixa de resumo:** vidro de 14 px com 4 células separadas por hairline, ícone em caixa 38×38 de 10 px tingida pela tinta do status, número 32 px com contagem animada; spotlight limão segue o cursor.
- **Painel lateral (tarefa):** 520 px, `ink-1` opaco, borda esquerda `line-strong`, `shadow-2`, desliza 28 px em 0,36 s sobre scrim de 60 % com blur 3 px. Cabeçalho com subtítulo na tinta do status (`data-status`); no bloqueado, o rótulo e o campo de motivo obrigatório ficam em kraft. Ações fixas no rodapé (`position: sticky`), fundo `ink-1`.
- **Diálogo de importação:** `min(1040px, 100%)`, 18 px, `ink-1`, `pop` 0,32 s sobre scrim 70 % blur 4 px; rodapé em preto 12 %.
- **Registro de integrante:** `ink-2`, 10 px, avatar 42 px; formulário em `ink-1` com borda `lime-line` e `shadow-1`.
- **Toast:** pílula fixa inferior, `rgba(12, 42, 48, 0.9)` + blur 14 px + borda `lime-line`, ícone limão, entra de baixo em 0,4 s.

### Inputs / Fields

- **Style:** rótulo 13 px/500 em `text-2` com o texto do rótulo em limão; campo de bloco com `margin-top: 8px`, fundo poço (preto 22 %), borda `line-strong`, 8 px, `padding: 11px 13px`, 14 px/1.45; placeholder em `text-3`; `select` sem aparência nativa com chevron SVG em `text-2` à direita (`padding-right: 36px`); textarea redimensionável, mínimo 72 px; checkbox nativo 18 px com `accent-color` limão.
- **Focus:** borda limão + halo `0 0 0 3px lime-soft`, fundo escurece para preto 30 %. Busca e filtro aplicam o mesmo via `:focus-within`.
- **Error / Disabled:** erro em bloco `danger-soft` com borda `danger` 35 % e texto `danger-text`, sobe com `rise` 0,3 s; somente leitura usa borda tracejada e fundo branco 3 %; no painel bloqueado o motivo obrigatório ganha borda kraft 60 % e fundo kraft 8 %.
- **Cor do integrante:** `input[type=color]` 46×40 no poço, prévia circular 34 px, oito sugestões de 24 px (`src/Members.tsx`) com anel branco quando escolhida.

### Navigation

- **Trilho:** vidro de 236 px com marca (símbolo 36 px + "forestflow" + "Forest Paper"), caixa do workspace (preto 14 %, ícone lilás "TI" 30×30), lista de abas com `gap: 4px` e perfil ao pé (avatar 36 px, nome, cargo, "Trocar perfil"/"Sair" em 32 px/12 px).
- **Item:** 42 px, 14 px/500 em `text-2`, ícone lucide 19 px; hover para `text`; ativo em limão 600 com contagem limão. O indicador é uma única placa `lime-soft` de 42 px com traço limão 3×18 à esquerda que desliza `translateY(índice × 46px)` em 260 ms.
- **Mobile (≤ 640 px):** barra inferior fixa com itens de 44 px; indicador some e a aba ativa usa fundo `lime-soft` direto.

### Ícones

lucide-react com o traço padrão de 2 px nos tamanhos usados no código: 14 (cadeado restrito, lápis), 15 (seta do cartão, trocar/sair, mais no adicionar), 16 (busca, filtro, calendário, mais), 17 (chevrons da semana, confirmação), 18 (mais no primário, ícones de resumo), 19 (navegação; 22 no rail), 20 (fechar painel), 22 (vazio). Ícones herdam a tinta do contexto e nunca usam cor própria. Marca e favicon são o mesmo SVG próprio (folha com fluxo, 36×36, raio 9).

### Acender a sala (assinatura)

A luminária do login é a marca em forma de objeto: haste de 2 px (`line → line-strong`), cúpula trapezoidal 124×38 em `#174a52 → #0f363c` com filete limão 40 % na base, lâmpada de 12 px em limão 35 % e cone de luz `conic-gradient` de 38° mascarado, apagado. Focar um campo acende a lâmpada a 70 % e o cone a 40 %; a senha aceita (`is-lit`) acende cúpula, lâmpada (glow duplo) e cone (`lamp-on`, 600 ms, `scaleY(0.5 → 1)`), e a borda do cartão tinge de limão 35 %. Os perfis surgem em cartões `ink-2` de 14 px com avatar 56 px na cor da pessoa, tilt 3D de até ±4° (`perspective(700px)`, só com ponteiro fino e sem reduced-motion) e spotlight branco 10 %, escalonados `índice × 70 ms + 200 ms`. Escolher o perfil tinge `--member-color` na raiz (luz ambiente e avatar) e monta a casca em sequência: trilho (`rise-x` 600 ms), cabeçalho (+60 ms), semana (+100 ms), resumo (+140 ms, números contando), toolbar (+180 ms), legenda (+200 ms), quadro (+220 ms) e cartões (50 ms cada, até o 12.º).

## Do's and Don'ts

### Do:

- **Do** reservar o limão sólido para uma única superfície por tela (o botão primário); o resto do limão é linha, texto ou fundo a 14 %.
- **Do** colorir status com uma tinta só em todos os lugares: andamento limão, bloqueado kraft (`kraft-bright` em texto), concluído lilás.
- **Do** mostrar a cor do integrante apenas como ímã 22×6, avatar sólido, ponto de 9 px no chip e luz ambiente; ela é dado do usuário, não token do sistema.
- **Do** usar vidro (`glass` + `backdrop-filter`) só na casca; cartões, painéis, diálogos e formulários são `ink-1`/`ink-2` opacos.
- **Do** separar com hairlines de 1 px (`line`, `line-strong`) e elevar no hover (1–2 px + `shadow-1`), nunca em repouso.
- **Do** animar só na montagem com `cubic-bezier(0.16, 1, 0.3, 1)`: 160 ms feedback, 260 ms painéis e indicador, 600 ms acender; escalonar em 50 ms; marcar `is-settled` depois para que atualizações de dados não reanimem.
- **Do** respeitar `prefers-reduced-motion` (todas as durações a 0,01 ms, luzes ambiente removidas, tilt desligado) e pausar as luzes ambiente com a aba oculta (`is-hidden`).
- **Do** manter Sora como única família, self-hosted, com números tabulares e `font-synthesis: none`.
- **Do** desenhar foco com o anel global limão de 2 px (offset 2 px) ou, em campos, borda limão + halo de 3 px.

### Don't:

- **Don't** usar o verde `#24563e` do site antigo, cinzas claros de SaaS nem neon limão espalhado como decoração.
- **Don't** usar vermelho para status do quadro; `danger` existe só para excluir e para erro de sistema.
- **Don't** desenhar a cor do responsável como borda grossa, faixa lateral ou fundo do cartão.
- **Don't** aplicar `backdrop-filter` em cartão, coluna, painel ou formulário, nem abaixo de 640 px.
- **Don't** usar caixa alta, tracking positivo acima de 0,04 em ou uma segunda família tipográfica; o mínimo de corpo é 12 px (11 px só em selos e sub-rótulos já existentes).
- **Don't** reanimar entradas em atualização de dados, nem usar duração acima de 600 ms fora das luzes ambiente (46–58 s) e do shimmer de carregamento (1,4 s).
- **Don't** usar o logo da Forest Paper ou sugerir que o símbolo do app é o logo corporativo; a marca é a folha com fluxo de `src/Brand.tsx`.
- **Don't** colocar sombras com offset sem blur nem bordas acima de 1 px (exceto o anel de 2 px dos swatches e o traço de 3 px do indicador de navegação).
