# Sistema Eletrônico de Informações - SEI — Link automático

Duas coisas, no editor do SEI: **linka** números de processo e documento em lote, e
**importa** a minuta de Resolução gerada pelo Gestão de Autos IA para os blocos do
modelo.

Status: A extensão vem sendo usada diariamente! Até o momento, está funcionando perfeitamente na versão SEI 5.0.4.
Contribua: Sugestões, melhorias, dicas e feedbacks são muito bem-vindos!

## Linkar protocolos

Com o documento aberto no editor: **Ctrl+Shift+K** ou o botão *"Linkar protocolos"*, no
painel **SEI AGR** à direita da barra de ferramentas. A área de mensagens do painel
presta contas do resultado: quantos números foram tentados, quais viraram link e quais
não têm correspondência no SEI. Um único Ctrl+Z desfaz a operação inteira.

Exemplo — no texto abaixo, só `80773781` e `203600005004296` viram link:

> Dispõe sobre o Auto de Infração nº 11111 (sei Nº **80773781**), em nome da empresa AUTO VIAÇÃO
> BOLINHA LTDA (CNPJ nº 33.333.3333/0001-33), conforme processo nº **203600005004296**.

### Como funciona

Alvo: **SEI 5.x**, que usa CKEditor 5 (build `45.1.0-infra`) — não o CKEditor 4 das
versões antigas do SEI. A API é completamente diferente.

1. [detectar.js](detectar.js) acha candidatos por formato: documento 7–9 dígitos,
   processo 15–17 dígitos ou `12345.678901/2026-99`. A faixa 10–14 fica de fora de
   propósito (telefones); CNPJ, CPF, datas e valores não batem porque seus grupos têm
   no máximo 4 dígitos.
2. [content.js](content.js) varre só os roots **editáveis** — cabeçalho, rodapé de
   referência e separadores são read-only (o SEI os gera do modelo) e ficam de fora.
3. Consulta cada candidato no endpoint `acao_ajax=protocolo_link_editor`
   (`ed.config.get('sei').urlBuscarProtocoloSei`) — o mesmo que o botão nativo usa.
   A resposta é XML: sucesso traz `IdProtocolo`/`ProtocoloFormatado`, número inexistente
   volta `<erros><erro descricao="Protocolo não encontrado.">`. Número que o SEI não
   reconhece é descartado, então não há link inventado.
4. Insere o elemento de modelo `SEILink` com `{ id, text }` via `writer`, dentro de um
   único `model.change`. O `id` é o `id_protocolo` interno devolvido pelo servidor, não
   o número visível — por isso a consulta é obrigatória.

Detalhes que custaram caro e não são óbvios:

- **Os parâmetros vão no corpo do POST, nunca na query string.** A URL já carrega um
  `infra_hash` que o SEI valida; acrescentar parâmetro nela dá *"Tamanho de hash
  inválido"* e o servidor redireciona para o login.
- **O documento é multi-root** (11 roots): `getData()` sem `rootName` lança
  `datacontroller-get-non-existent-root`. A varredura percorre todos.
- **O comando nativo `adicionarLinkProtocoloSei` insere no cursor**, não substitui a
  seleção — por isso o código remove o texto e insere o elemento no lugar, em vez de
  chamar o comando.
- O content script roda com `"world": "MAIN"`, senão não enxerga a instância do editor.

## Importar Resolução Gerada

Botão *"Importar Resolução"*, logo abaixo do primeiro no mesmo painel. A busca e o
histórico de processos recentes do [Gestão de Autos IA](https://github.com/thelustosa/gestao-de-autos-ia)
abrem na própria área de mensagens — sem janela sobre o editor. Ao escolher um processo,
a minuta é colada nos três blocos do modelo de Resolução: **ementa**, **considerandos**
e **artigos**, e a conclusão aparece no mesmo lugar.

Depois de importar, use *"Linkar protocolos"*: os números vêm crus de propósito, e é
o Ctrl+Shift+K que os transforma em Link SEI.

### Como funciona

1. `GET /api/processo/<número>/resolucao` devolve `{ementa, considerandos, artigos}`
   como HTML — a minuta já fatiada nos blocos (`core.doc_gen.dividir_documento`, no
   lado do Gestão de Autos IA).
2. [blocos.js](blocos.js) decide qual root é qual bloco. Nomes de root não servem:
   são `txaEditor_<id>` e o id muda a cada documento. A identificação sai de três
   sinais, em ordem de confiança — o **estilo** do parágrafo (`Texto_Ementa` é só da
   ementa), a **classe** do editable (`infra-editor__secao-principal` marca os artigos)
   e a **posição entre os editáveis**, como reserva. O corpo fica só na posição, por
   ser o editável logo antes dos artigos: o estilo dele
   (`Texto_Justificado_Recuo_Primeira_Linha`) é o mesmo do título e da assinatura.
3. A importação é **recusada** se a ordem não fechar (ementa antes do corpo, corpo
   antes dos artigos) ou se houver menos de três editáveis: colar no lugar errado é
   pior que não colar. O que ela viu vai para o console.
4. A ordenação dos roots sai de `compareDocumentPosition`, não de `getRootNames()` —
   essa devolve a ordem de registro, que não é garantidamente a visual.
5. A colagem usa as **mesmas duas etapas do Ctrl+V**, sem disparar o evento: o HTML sobe
   pelo `data.processor.toView` + `data.toModel(…, '$clipboardHolder')` (o upcast que o
   `ClipboardPipeline` usa, e o que converte `class` no atributo `estilo` do SEI), e
   entra por `model.insertContent(fragmento, range)` — o passo `contentInsertion` do
   próprio pipeline. Assim o texto herda a formatação que o modelo do SEI já definiu no
   parágrafo de destino, e o **range é explícito**, em vez de adivinhado pela seleção.
6. As três inserções ficam num único `model.change`, e os fragmentos são todos
   convertidos **antes** dele: um Ctrl+Z desfaz a importação inteira, e se a conversão de
   um bloco estourar, o documento não foi tocado.

Detalhes que só apareceram medindo no editor de verdade:

- **O modelo mudou no meio do caminho, e o divisor sumiu.** O modelo antigo (SEI de
  treinamento) tinha um bloco `RESOLVE:` próprio entre o corpo e os artigos, e o
  mapeamento usava ele de divisor. O modelo atual da AGR não tem: o `resolve:` virou o
  fim do corpo (`Considerando, …, resolve:`). Por isso os sinais primários passaram a
  ser o estilo e a classe, com a posição de reserva — e `_pularResolve` mantém os dois
  modelos funcionando, porque no antigo o `RESOLVE:` **era editável** e seria escolhido
  como corpo por ser "o editável logo antes dos artigos".
- **O primeiro editável não é a ementa, é o título.** Existe um bloco
  `RESOLUÇÃO AGR Nº 1, DE 14 DE AGOSTO DE 2026` acima dela. A heurística ingênua
  ("primeiro editável") colava a ementa em cima do número da Resolução.
- **O bloco de artigos não é homogêneo, e isso quebra duas coisas.** Ele começa com
  `CAPÍTULO I` e `Seção I` em `Tabela_Texto_Centralizado`; só os parágrafos `Art. …`
  usam `Texto_Justificado_Recuo_Primeira_Linha_Esp_Simples`. Tirar o estilo do
  **primeiro** parágrafo fazia os artigos importados saírem centralizados. A moda também
  erra — no modelo em branco há 7 linhas centralizadas contra 3 de artigo. `estiloDoCorpo`
  usa o parágrafo **mais longo**: título de capítulo, `[...]` e linha de assinatura são
  curtos por natureza; o texto redigido não.
- **A assinatura mora dentro do bloco de artigos.** Os últimos parágrafos de
  `txaEditor_655` são linhas em branco e `[Nome do (a) usuário (a)]`, em
  `Texto_Centralizado`. Um `createRangeIn(root)` apagaria isso em bloco, sem avisar. Por
  isso o range vai só até o **último parágrafo com o estilo do texto corrido**
  (`ultimoDoCorpo`); o que vem depois fica. Da cauda, `limparCauda` remove duas coisas, nesta
  ordem: a linha `[Nome do (a) usuário (a)]` — marcador do modelo, não conteúdo, já que
  quem assina no SEI é a ação *Assinar* — e depois os parágrafos vazios que sobram no
  fim, que sem ela virariam espaço solto no fim do documento. A ordem importa: a
  assinatura fica **entre** os vazios, então só depois de tirá-la os três ficam
  contíguos e saem juntos. `ehAssinaturaModelo` casa só a forma entre colchetes (um nome
  de verdade escrito no lugar dela não casa, então reimportar não apaga assinatura que
  alguém digitou), e `vaziosDoFim` para no primeiro parágrafo com conteúdo — vazio no
  **meio** do texto é do autor — e nunca devolve o índice 0, porque um root sem nenhum
  filho é inválido no modelo do CKEditor.
- **"Bloco em branco" é decidido por vocabulário, não por um regex do texto todo.**
  O bloco de artigos do modelo novo mistura `CAPÍTULO I`, `Seção I`, `XXXXX`, `[...]`,
  `Art. (Nº)`, `DISPOSIÇÕES FINAIS` e a cláusula de vigência. `ehPlaceholder` remove os
  tokens conhecidos e pergunta se sobrou alguma letra. O viés dessa forma é o seguro:
  token não previsto conta como texto do usuário, então a extensão **pergunta** em vez
  de sobrescrever calada.
- **Disparar o evento de colagem não permite escolher o root.** O `ClipboardPipeline`
  insere onde está a seleção do **documento**, que é única num editor multi-root. Mover
  essa seleção para outro root antes de disparar não funciona: `el.focus()` é assíncrono
  e o CKEditor ressincroniza a seleção a partir do DOM depois, desfazendo o
  `setSelection`. O resultado foi as três colagens caindo **todas** no root da seção
  principal, e cada uma **duplicada** — a verificação olhava o root pretendido, não via
  mudança, e ainda tentava a segunda via. Ainda por cima reportava "recusou a colagem"
  depois de ter escrito. A cura é não disparar evento nenhum e passar o range para o
  `insertContent`.
- **Substituir o root inteiro preserva o estilo; colar no fim dele não.** Com o conteúdo
  todo selecionado (`createRangeIn`), os dois parágrafos colados saíram em
  `Texto_Justificado_Recuo_Primeira_Linha`, o estilo do destino. Com o cursor colapsado
  no fim do root, o segundo parágrafo saiu como `Texto_Centralizado_Maiusculas` — aí o
  CKEditor cria parágrafo novo e o plugin `Estilo` lhe dá o próximo estilo da tabela
  dele, não o do destino. Por isso o range cobre o bloco inteiro (o que também faz
  reimportar **substituir** em vez de empilhar), e `comEstilo` leva a classe do destino
  nos `<p>` colados: uma linha, para o caso de a minuta trazer mais parágrafos do que o
  bloco tem.
- **`trim()` não remove U+200B.** Os parágrafos em branco dos considerandos vêm com esse
  caractere (categoria Cf, não espaço em branco) entre cada "Considerando,". Sem tratá-lo,
  o modelo em branco era lido como "texto do usuário" e pedia confirmação à toa.
- **O número do processo vem do rodapé de referência**, não do `config.get('sei')` — o
  `idProcedimento` de lá é o id interno do SEI (`8455633`), não o número visível
  (`202600005004559`). `processoDeReferencia` em [detectar.js](detectar.js) lê
  `Referência: Processo nº <n>` e exige essa marca antes de cair numa varredura genérica,
  para que um processo *citado* no corpo do texto não vença o processo do documento.

Sobre autenticação e rede — o ponto que define a arquitetura:

- **Nenhuma senha passa pela extensão.** O login é feito no site do Gestão de Autos IA,
  normalmente. [sw.js](sw.js) lê o cookie JWT via `chrome.cookies` e o repassa como
  `Authorization: Bearer`. O backend aceita as duas vias
  (`JWT_TOKEN_LOCATION = ["cookies", "headers"]`), e o cookie, sendo `SameSite=Lax`,
  nunca viajaria sozinho numa requisição cross-site.
- **O fetch mora no service worker, não no content script.** No MV3 o fetch de um
  content script segue o CORS da *página* — precisaria de
  `Access-Control-Allow-Origin` no backend. O do service worker, coberto por
  `host_permissions`, não precisa: a API não muda nada para atender a extensão.
- [ponte.js](ponte.js) existe porque `"world": "MAIN"` não enxerga `chrome.runtime`.
  Ele roda no mundo ISOLATED e só repassa mensagens. O token **nunca** chega ao
  contexto da página do SEI; o que trafega pela ponte são três ações de leitura.
- A URL da API é `https://gestao-autos.duckdns.org`, sobrescrevível com
  `chrome.storage.local.set({apiBase: 'http://127.0.0.1:8080'})` para testar local — e o
  `set` tem que rodar no console do **service worker** da extensão, não no de uma página.
  `127.0.0.1` e `localhost` são origens distintas: o login precisa ser feito no mesmo
  host do `apiBase`, senão o cookie fica no outro e o `chrome.cookies` não o encontra.
  Os `host_permissions` vão sem porta de propósito — assim valem para qualquer uma.

## Instalação (modo desenvolvedor)

`chrome://extensions` → *Modo do desenvolvedor* → *Carregar sem compactação* → esta pasta.

Os `matches` do [manifest.json](manifest.json) estão restritos a `*.go.gov.br`.

## Teste

```
node test-deteccao.js     # detecção dos números
node test-blocos.js       # mapeamento dos blocos da Resolução
node test-contraste.js    # contraste WCAG de todos os pares de cor do painel
node test-visual.js       # renderiza o painel → test-visual.html + .png
```

Os dois primeiros cobrem a detecção e o mapeamento dos blocos, independentes do editor.

[test-visual.js](test-visual.js) extrai o CSS **real** de `content.js` e renderiza as seis
telas do painel dentro de um `.ck-reset_all` idêntico ao do CKEditor — que é justamente o
que atropela seletor de classe simples. Ele falha se algum seletor perder a blindagem de
id ou se uma cor oficial sumir dos tokens. Com o Chrome instalado, também gera o PNG.

A camada de inserção e a de colagem não têm teste automatizado — dependem de uma sessão
real do SEI.

### Paleta

Verde `#008C59` e ouro `#F9DA2A`, amostrados pixel a pixel do brasão da AGR. O selo
`sei!` é vazado — branco a 16% sobre o verde, com a exclamação em ouro — como no design,
e não uma reprodução do logo do SEI.

O verde da marca só rende 4,29:1 com texto branco, abaixo do mínimo, então quem carrega
texto usa `#007A4E` (5,4:1) e a marca fica nos acentos. `test-contraste.js` guarda essa
decisão e lista à parte o que é isento por ser lockup de marca.

## Pendências

- Sem confirmação antes de aplicar links: um número de 7–9 dígitos que por acaso exista
  como documento no SEI vira link mesmo não sendo o pretendido. O Ctrl+Z cobre por enquanto.
- A importação **sobrescreve** os três blocos. Um Ctrl+Z desfaz tudo, mas só se você
  perceber a tempo — por isso ela pede confirmação quando algum bloco de destino já tem
  texto escrito.
- O mapeamento e a colagem foram medidos nos dois modelos: o de treinamento
  (`45.1.0-infra-202508082051`, com bloco `RESOLVE:`) e o da AGR
  (`45.1.0-infra-202602092037`, sem ele). Nos dois, cada bloco recebeu o seu conteúdo,
  sem vazar para os outros, com os roots não-alvo intactos e um Ctrl+Z desfazendo tudo.
  No da AGR, depois das correções: os artigos saem em
  `Texto_Justificado_Recuo_Primeira_Linha_Esp_Simples` (e não no
  `Tabela_Texto_Centralizado` do primeiro parágrafo) e a cauda do bloco sobrevive à
  substituição, com a linha `[Nome do (a) usuário (a)]` removida à parte. Rodar [diagnostico-resolucao.js](diagnostico-resolucao.js)
  é o jeito de refazer essa medição quando o modelo mudar de novo.
- **Falta a rodada de ponta a ponta contra a produção** do Gestão de Autos IA — a
  importação real, com a API respondendo, no modelo novo.
- O filtro de roots usa `contenteditable`, que cobre cabeçalho e rodapé de referência.
  O rodapé de endereço (`txaEditor_657`) é editável e continua sendo varrido — hoje
  inofensivo porque CEP e telefone não batem na regex, mas é um limite conhecido.
- O painel é anexado à `.ck-toolbar` por seletor de classe. Se o SEI reorganizar a
  barra, ele cai no fallback flutuante (canto inferior direito) em vez de sumir.
- Validado só no SEI de **treinamento**, onde a maioria dos números de teste não existe.
  Falta uma rodada em produção com números reais.
- [diagnostico.js](diagnostico.js) e [diagnostico-resolucao.js](diagnostico-resolucao.js)
  são ferramentas de investigação, não fazem parte da extensão — úteis se o SEI mudar
  de versão.
