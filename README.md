# SEI AGR — Link automático

Detecta números de processo e documento no texto do editor do SEI e aplica o **Link SEI**
em lote, sem precisar inserir um por um pelo diálogo nativo.

## Como usar

Com o documento aberto no editor: **Ctrl+Shift+K** ou o botão *"Link SEI auto"*, à
direita da barra de ferramentas. Um único Ctrl+Z desfaz a operação inteira.

Exemplo — no texto abaixo, só `80773781` e `202600005004296` viram link:

> Dispõe sobre o Auto de Infração nº 45680 (**80773781**), em nome da empresa AUTO VIAÇÃO
> GOIANÉSIA LTDA (CNPJ nº 03.641.223/0001-26), conforme processo nº **202600005004296**.

## Como funciona

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

## Instalação (modo desenvolvedor)

`chrome://extensions` → *Modo do desenvolvedor* → *Carregar sem compactação* → esta pasta.

Os `matches` do [manifest.json](manifest.json) estão restritos a `*.go.gov.br`.

## Teste

```
node test-deteccao.js
```

Cobre a detecção, que é independente do editor. A camada de inserção não tem teste
automatizado — depende de uma sessão real do SEI.

## Pendências

- Sem confirmação antes de aplicar: um número de 7–9 dígitos que por acaso exista como
  documento no SEI vira link mesmo não sendo o pretendido. O Ctrl+Z cobre por enquanto.
- O filtro de roots usa `contenteditable`, que cobre cabeçalho e rodapé de referência.
  O rodapé de endereço (`txaEditor_657`) é editável e continua sendo varrido — hoje
  inofensivo porque CEP e telefone não batem na regex, mas é um limite conhecido.
- O botão é anexado à `.ck-toolbar` por seletor de classe. Se o SEI reorganizar a barra,
  ele cai no fallback flutuante (canto inferior direito) em vez de sumir.
- Validado só no SEI de **treinamento**, onde a maioria dos números de teste não existe.
  Falta uma rodada em produção com números reais.
- [diagnostico.js](diagnostico.js) é ferramenta de investigação, não faz parte da
  extensão — útil se o SEI mudar de versão.
