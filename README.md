# Sistema Eletrônico de Informações - SEI — Link automático

Duas coisas, no editor do SEI: **linka** números de processo e documento em lote, e
**importa** a minuta de Resolução gerada pelo Gestão de Autos IA para os blocos do
modelo.

Status: A extensão vem sendo usada diariamente! Até o momento, está funcionando perfeitamente na versão SEI 5.0.4.
Contribua: Sugestões, melhorias, dicas e feedbacks são muito bem-vindos!

## Linkar protocolos

Com o documento aberto no editor: **Ctrl+Shift+K** ou o botão *"Linkar protocolos"*, à
direita da barra de ferramentas. Um único Ctrl+Z desfaz a operação inteira.

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

Botão *"Importar Resolução"*, ao lado do primeiro. Abre um modal que lista os
processos recentes do [Gestão de Autos IA](https://github.com/thelustosa/gestao-de-autos-ia)
e aceita a busca por número. Ao escolher um, a minuta é colada nos três blocos do
modelo de Resolução: **ementa**, **considerandos** e **artigos**.

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
   e a **posição** em relação ao bloco `RESOLVE:`, que é o divisor. Os considerandos
   ficam só na posição: o estilo deles (`Texto_Justificado_Recuo_Primeira_Linha`) é o
   mesmo do título e do bloco de local e data.
3. Sem o bloco `RESOLVE:`, ou com menos de dois editáveis antes dele, a importação é
   **recusada**: colar no lugar errado é pior que não colar.
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

- **O primeiro editável antes do `RESOLVE:` não é a ementa, é o título.** No modelo há
  um bloco `Resolução nº 2, de 13 de agosto de 2026` acima dela. A heurística ingênua
  ("primeiro editável") colava a ementa em cima do número da Resolução. Daí o estilo
  `Texto_Ementa` como sinal primário, e "o bloco imediatamente acima dos considerandos"
  como reserva.
- **O `RESOLVE:` é editável**, ao contrário do que o nome read-only sugere. Ele é
  divisor, nunca destino — fica fora dos dois lados por construção.
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
node test-deteccao.js
node test-blocos.js
```

Cobrem a detecção e o mapeamento dos blocos, que são independentes do editor. A camada
de inserção e a de colagem não têm teste automatizado — dependem de uma sessão real do
SEI.

## Pendências

- Sem confirmação antes de aplicar links: um número de 7–9 dígitos que por acaso exista
  como documento no SEI vira link mesmo não sendo o pretendido. O Ctrl+Z cobre por enquanto.
- A importação **sobrescreve** os três blocos. Um Ctrl+Z desfaz tudo, mas só se você
  perceber a tempo — por isso ela pede confirmação quando algum bloco de destino já tem
  texto escrito.
- O mapeamento dos blocos, as duas vias de colagem, a preservação do estilo e o
  Ctrl+Z por bloco foram confirmados no SEI de **treinamento**
  (`45.1.0-infra-202508082051`) com [diagnostico-resolucao.js](diagnostico-resolucao.js).
  Falta a rodada de ponta a ponta com a API do Gestão de Autos IA respondendo — só isso
  exercita o `sw.js`, a `ponte.js` e o modal juntos.
- O filtro de roots usa `contenteditable`, que cobre cabeçalho e rodapé de referência.
  O rodapé de endereço (`txaEditor_657`) é editável e continua sendo varrido — hoje
  inofensivo porque CEP e telefone não batem na regex, mas é um limite conhecido.
- Os botões são anexados à `.ck-toolbar` por seletor de classe. Se o SEI reorganizar a
  barra, eles caem no fallback flutuante (canto inferior direito) em vez de sumir.
- Validado só no SEI de **treinamento**, onde a maioria dos números de teste não existe.
  Falta uma rodada em produção com números reais.
- [diagnostico.js](diagnostico.js) e [diagnostico-resolucao.js](diagnostico-resolucao.js)
  são ferramentas de investigação, não fazem parte da extensão — úteis se o SEI mudar
  de versão.
