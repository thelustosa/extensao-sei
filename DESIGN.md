---
name: "SEI AGR"
description: "Comando institucional compacto para duas automações seguras no editor do SEI."
colors:
  agr-action: "#007A4E"
  agr-action-hover: "#00663F"
  agr-action-active: "#005434"
  agr-action-text: "#00754A"
  agr-brand: "#008C59"
  agr-gold: "#F9DA2A"
  ink: "#1C231E"
  text: "#39423C"
  muted: "#6E756E"
  border: "#DCDED9"
  field-border: "#858B85"
  divider: "#ECEEE9"
  surface: "#FFFFFF"
  success-surface: "#EFF8F3"
  success-surface-hover: "#E0F1E8"
  success-border: "#C9E2D4"
  error: "#B3261E"
  error-surface: "#FDF3F2"
  error-border: "#EBC9C6"
typography:
  brand:
    fontFamily: "Nunito, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 900
    lineHeight: 1
  trigger:
    fontFamily: "Nunito, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1
  action:
    fontFamily: "Nunito, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Nunito, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.45
  label:
    fontFamily: "Nunito, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.12em"
  helper:
    fontFamily: "Nunito, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  dot: "3px"
  seal: "6px"
  list-item: "8px"
  trigger: "9px"
  control: "10px"
  panel: "14px"
spacing:
  hairline: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  two-xl: "14px"
  three-xl: "16px"
components:
  toolbar-trigger:
    backgroundColor: "{colors.agr-action}"
    textColor: "{colors.surface}"
    typography: "{typography.trigger}"
    rounded: "{rounded.trigger}"
    padding: "0 14px 0 9px"
    height: "32px"
  toolbar-trigger-hover:
    backgroundColor: "{colors.agr-action-hover}"
    textColor: "{colors.surface}"
    typography: "{typography.trigger}"
    rounded: "{rounded.trigger}"
    height: "32px"
  toolbar-trigger-active:
    backgroundColor: "{colors.agr-action-active}"
    textColor: "{colors.surface}"
    typography: "{typography.trigger}"
    rounded: "{rounded.trigger}"
    height: "32px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "0"
    width: "420px"
  action-primary:
    backgroundColor: "{colors.agr-action}"
    textColor: "{colors.surface}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "44px"
  action-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.agr-action-text}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  message-success:
    backgroundColor: "{colors.success-surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  message-error:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "38px"
  process-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.list-item}"
    padding: "8px 10px"
    height: "44px"
---

# Design System: SEI AGR

## Overview

**Creative North Star: "Comando institucional compacto"**

O SEI AGR deve parecer um controle nativo, confiável e discreto dentro da barra do SEI: uma única marca compacta abre acesso seguro às duas automações e à prestação de contas de cada operação. A presença institucional vem da paleta AGR, do selo vazado e da tipografia sans-serif pesada; a eficiência vem da densidade controlada, dos alvos claros e da hierarquia curta.

O sistema é deliberadamente plano e operacional. Superfícies brancas, bordas finas e mudanças tonais comunicam estrutura e estado sem competir com o documento em edição. Verde conduz ação, ouro identifica a marca ou um ponto de estado, e vermelho aparece apenas para erro. A interface rejeita sombra decorativa, janelas que cubram o editor e ornamentação desvinculada da tarefa.

**Key Characteristics:**

- Marca SEI AGR única, compacta e imediatamente reconhecível.
- Densidade operacional com controles de pelo menos 44px nas ações e no toque móvel.
- Superfícies planas, contornadas e encaixadas no ambiente do SEI.
- Estados explícitos por texto, cor, ponto, spinner ou confirmação.
- Contraste WCAG AA e foco visível como parte do caráter visual.

## Colors

A paleta traduz a identidade AGR em um vocabulário funcional: verde institucional para comando, ouro raro para marca e estado, neutros esverdeados para leitura e superfícies sem ruído.

### Primary

- **Verde de Comando AGR** (`agr-action`): fundo de gatilhos, cabeçalhos e ações primárias com texto branco.
- **Verde de Comando Profundo** (`agr-action-hover`, `agr-action-active`): progressão tonal exclusiva para hover, atividade e ação em andamento.
- **Verde de Texto Institucional** (`agr-action-text`): texto e contorno sobre branco quando o contraste precisa ser maior que o verde de marca oferece.

### Secondary

- **Verde de Marca AGR** (`agr-brand`): acento sem texto no ponto da ação secundária e em elementos estritamente marcários.
- **Verde de Prestação de Contas** (`success-surface`, `success-surface-hover`, `success-border`): superfícies, interação e contorno das mensagens e escolhas válidas.

### Tertiary

- **Ouro AGR** (`agr-gold`): exclamação do selo e ponto da ação primária; nunca sustenta texto corrido.

### Neutral

- **Tinta Institucional** (`ink`): números, valores e foco de alta ênfase.
- **Texto Operacional** (`text`): corpo das mensagens e leitura funcional.
- **Texto Recuado** (`muted`): ajuda, vazio, placeholder, metadados e estado desabilitado.
- **Contorno de Superfície** (`border`), **Contorno de Campo** (`field-border`) e **Divisor Suave** (`divider`): três intensidades de separação para painel, entrada e regiões internas.
- **Branco de Superfície** (`surface`): fundo do painel, campos e ação secundária.

### Semantic feedback

- **Vermelho de Recusa** (`error`): título de erro e sinal explícito de operação recusada.
- **Superfície de Recusa** (`error-surface`, `error-border`): fundo e contorno reservados a mensagens de erro.

**The Contrast Before Brand Rule.** O verde de marca não recebe texto branco; controles textuais usam o verde de comando e preservam o verde de marca apenas como acento.

**The Gold Is a Signal Rule.** O ouro aparece somente no lockup e em pontos de estado; sua raridade mantém o sinal legível.

## Typography

**Display Font:** não há papel display; esta é uma interface de operação compacta.

**Body Font:** Nunito, com fallback para system-ui, Segoe UI, Roboto, Helvetica e Arial.

**Character:** A sans arredondada e pesada aproxima a identidade institucional sem perder a leitura rápida. Peso, caixa e espaçamento — não tamanho excessivo — formam a hierarquia.

### Hierarchy

- **Brand** (900, 16px, 1): lockup SEI AGR no cabeçalho do painel.
- **Trigger** (800, 13px, 1): nome SEI AGR na barra do desktop.
- **Action** (800, 14px, 1.2): rótulos das duas automações e seus estados em andamento ou conclusão.
- **Body** (600, 13px, 1.45): mensagens, detalhes operacionais e texto-base do painel.
- **Label** (800, 11px, 0.12em, caixa alta): títulos curtos de mensagem e classificação de estado.
- **Helper** (600, 11px, 1.4): orientação de busca e metadados secundários.

**The Weight Builds Hierarchy Rule.** Em uma área compacta, altere primeiro peso, caixa e cor; não introduza títulos grandes nem uma segunda família tipográfica.

**The Numbers Stay Stable Rule.** Processos, documentos e contagens usam numerais tabulares e peso 800 para facilitar conferência visual.

## Layout

O gatilho ocupa o extremo direito da toolbar e abre o painel alinhado à direita, 6px abaixo. No desktop, o controle mede 32px de altura; o selo interno mede 22px. O painel tem 420px de largura quando há espaço, reduz-se fluidamente até `100vw - 24px` em contextos estreitos e usa canto de 14px. Seu cabeçalho é uma faixa verde de 58px — selo de 30px mais 14px de respiro vertical — e o corpo usa 16px de padding e 10px entre blocos.

As duas ações têm altura mínima de 44px. A área de mensagens começa após 4px, separada por linha e 12px de respiro superior, e preserva ao menos 120px para retorno, busca e histórico. O corpo do painel rola dentro da viewport e não ultrapassa `100vh - 160px`; listas internas rolam após 200px.

Em larguras de até 600px, o hit area do gatilho cresce para 44px e contém um quadrado visual verde de 32px, mantendo a marca compacta sem sacrificar toque. O nome some, o painel passa a `min(420px, 100vw - 24px)`, e o campo de busca cresce para 44px com texto de 16px. Quando a toolbar não está disponível, o conjunto flutua no canto inferior direito, respeitando 16px e safe areas. O conteúdo interno sempre normaliza `white-space`, limita o eixo horizontal e quebra mensagens longas; apenas metadados de lista truncam deliberadamente.

**The Editor Remains Primary Rule.** O painel se ancora à toolbar ou ao canto e nunca se transforma em modal sobre o documento.

## Elevation & Depth

O sistema não usa sombras. Profundidade é comunicada por sobreposição posicional, contorno de 1px, faixa de cabeçalho e mudança tonal de superfícies. A entrada do painel move 4px e desvanece; mensagens apenas desvanecem. Esses movimentos explicam origem e atualização, sem simular elevação física.

**The Flat Institutional Surface Rule.** Superfícies permanecem planas em repouso e em interação; não adicionar sombra decorativa a painel, botão, mensagem, campo ou item.

## Shapes

Os cantos formam uma escala curta e funcional. O painel usa raio de 14px; controles e mensagens, 10px; o gatilho, 9px; itens de lista e o selo maior, 8px; o selo compacto, 6px. Pontos de estado são círculos de 6px obtidos com raio de 3px. Bordas são sólidas, sem brilho, gradiente ou recorte ornamental.

**The Nested Radius Rule.** A maior curva pertence ao contêiner; elementos internos reduzem progressivamente o raio e nunca ficam mais arredondados que o painel.

## Components

### Brand Seal

O selo é um lockup vazado, não uma reprodução do logotipo oficial do SEI. Usa branco translúcido sobre verde, “sei” em branco e exclamação em ouro; um respiro óptico de `0.1em` separa a palavra da exclamação. Mede 22px no gatilho e 30px no cabeçalho.

### Toolbar Trigger

- **Shape:** cápsula compacta de cantos suavemente curvos (9px), 32px de altura no desktop.
- **Default:** verde de comando com selo de 22px, gap de 8px e rótulo branco pesado.
- **Hover / Active:** escurece por dois degraus tonais; não se desloca e não ganha sombra.
- **Focus:** contorno de 2px em tinta institucional com offset de 2px.
- **Mobile:** hit area quadrado de 44px com quadrado visual de 32px; exibe apenas o selo.

### Panel

- **Corner Style:** superfície contida de até 420px com raio de 14px e clipping dos filhos.
- **Header:** faixa verde de 58px com selo de 30px e lockup branco/ouro.
- **Body:** coluna com 16px de padding, gap de 10px e rolagem limitada à viewport.
- **Shadow Strategy:** nenhuma sombra; uma borda neutra de 1px define o limite.

### Buttons

- **Shape:** largura total, altura mínima de 44px e raio de 10px.
- **Primary:** verde de comando, texto branco, padding de 12px por 14px e ponto ouro.
- **Secondary:** branco, texto e borda verde institucional de 2px, padding de 10px por 12px e ponto verde de marca.
- **Hover / Active:** mudança tonal de fundo; foco por outline de 2px e offset de 2px.
- **Working / Complete:** o ponto se torna spinner de 15px ou check de 16px; o rótulo descreve a operação, nunca apenas “aguarde”.
- **Disabled:** ação primária usa verde profundo; secundária permanece branca com texto e borda recuados.

### Status Messages

- **Style:** bloco de raio 10px, padding de 12px por 14px, borda de 1px e gap interno de 4px.
- **Success / Informational:** superfície verde suave, título verde institucional em caixa alta e corpo em texto operacional.
- **Error:** superfície rosada, borda rosada e título vermelho; o corpo mantém a mesma cor de texto para leitura.
- **Data:** números e contagens usam tinta institucional, peso 800 e numerais tabulares.

### Inputs / Fields

- **Style:** campo branco de 38px, borda visível de 1px, raio de 10px, padding horizontal de 12px e numerais tabulares.
- **Focus:** outline verde de 2px com offset de 1px e borda no mesmo verde.
- **Placeholder / Help:** texto recuado, pesos 600 e tamanhos compactos.
- **Mobile:** altura de 44px e corpo de 16px para toque e leitura confortável.

### Process List Item

- **Style:** botão de largura total, altura mínima de 44px, fundo transparente, raio de 8px e padding de 8px por 10px.
- **Hierarchy:** número em 13px/800 com numerais tabulares; subtítulo em 11.5px/600, truncado em uma linha.
- **Hover / Focus:** superfície verde suave; foco é desenhado internamente para não cortar na lista rolável.

## Do's and Don'ts

### Do:

- **Do** manter uma única marca SEI AGR como porta de entrada para as duas automações.
- **Do** preservar o gatilho desktop de 32px e o hit area móvel de 44px com quadrado visual de 32px.
- **Do** usar verde de comando quando houver texto branco e reservar verde de marca e ouro a acentos sem texto corrido.
- **Do** comunicar toda operação com rótulo explícito, ponto, spinner, check ou mensagem correspondente.
- **Do** manter foco visível, contraste AA e suporte a `prefers-reduced-motion` em qualquer novo estado.

### Don't:

- **Don't** adicionar sombras, gradientes, brilho ou elevação decorativa.
- **Don't** transformar o painel em modal, drawer amplo ou janela que cubra o documento.
- **Don't** usar o ouro como fundo de controle, texto corrido ou decoração abundante.
- **Don't** colocar texto branco sobre o verde de marca; esse par não atinge o contraste requerido.
- **Don't** criar uma terceira ação de mesmo peso sem rever a arquitetura compacta do comando.
