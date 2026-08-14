# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Profissionais da AGR que redigem documentos e Resoluções no SEI 5. O público exato e eventuais outros perfis permanecem como decisão aberta.

## Product Purpose

A extensão reduz trabalho manual dentro do editor do SEI: transforma números de processo e documento em links SEI válidos e importa a minuta de Resolução gerada pelo Gestão de Autos IA para os blocos corretos do modelo. Sucesso significa concluir essas tarefas com retorno claro, sem escrever no lugar errado e com uma única operação de desfazer.

## Positioning

Opera diretamente no editor multi-root do SEI 5 e usa os mecanismos reais dos dois sistemas: consulta o protocolo antes de criar um `SEILink` e insere cada trecho da minuta no root correto preservando os estilos do modelo.

## Operating Context

- Extensão Chrome Manifest V3 carregada no SEI 5.x em domínios `*.go.gov.br`.
- O acesso ao Gestão de Autos IA usa a sessão já aberta pelo usuário; nenhuma senha passa pela extensão.
- Linkagem: botão “Linkar protocolos” ou atalho `Ctrl+Shift+K`.
- Importação: busca por processo, seleção da minuta e preenchimento de ementa, considerandos e artigos.

## Capabilities and Constraints

- Suporta o CKEditor 5 do SEI 5; não há suporte declarado ao CKEditor 4.
- Só cria links confirmados pelo endpoint nativo do SEI.
- Ignora roots não editáveis e recusa a importação quando não identifica com segurança os blocos da Resolução.
- Linkagem e importação são agrupadas para que um único `Ctrl+Z` desfaça cada operação completa.
- A importação sobrescreve os três blocos e pede confirmação quando já existe conteúdo.
- O fluxo integrado com a API e a validação em produção ainda constam como pendências.

## Brand Commitments

- Nome: SEI AGR.
- Identidade aprovada pelo proprietário: verde AGR, ouro, branco, selo “sei!” e tipografia sans-serif pesada.
- O botão compacto fica na barra do SEI; o menu suspenso reúne as duas ações e a área de mensagens.
- A referência fornecida nesta conversa fixa as proporções do selo, do botão e do painel.

## Evidence on Hand

- [README.md](README.md): funcionamento, decisões técnicas, limitações e validações conhecidas.
- [content.js](content.js): interface e integração real com o editor.
- [test-visual.js](test-visual.js): banco de estados usando o CSS de produção sob o reset do CKEditor.
- [test-contraste.js](test-contraste.js): pares de cor e limiares WCAG.
- [diagnostico-resolucao.js](diagnostico-resolucao.js): investigação no SEI de treinamento.
- Não há depoimentos, métricas de ganho de tempo ou validação ponta a ponta em produção; trabalhos futuros não devem inventá-los.

## Product Principles

- Escrever somente quando o destino e o protocolo forem conhecidos com segurança.
- Manter toda operação reversível em um único desfazer.
- Prestar contas do que foi tentado, aplicado ou recusado.
- Permanecer dentro do fluxo do editor, sem janelas que cubram o documento.
- Proteger sessão e credenciais por separação entre página, ponte e service worker.

## Accessibility & Inclusion

A interface deve manter contraste WCAG AA, alvos de toque adequados, navegação por teclado, foco visível, anúncios de estado e suporte a `prefers-reduced-motion`.
