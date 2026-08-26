// node test-blocos.js
const assert = require('assert');
const { mapearBlocos, blocosOcupados, estiloDoCorpo, ultimoDoCorpo,
        ehAssinaturaModelo, vaziosDoFim } = require('./blocos.js');

const ZWSP = '​';
const REP = (s, n) => Array(n).fill(s).join(' ');

// ── Modelo NOVO da AGR (SEI de produção) ──────────────────────────────────
// Sem bloco 'RESOLVE:': o "resolve:" virou o fim do corpo. Estrutura lida da
// tela; `estilo` e `classe` são o que o diagnóstico deve confirmar.
const ARTIGOS_EM_BRANCO =
    'CAPÍTULO I XXXXXXXXXXXX Seção I XXXXXXXXXXXX ' +
    'Art.1º ' + REP('Elaborar o Texto,', 20) + ' [...] ' +
    'CAPÍTULO (Nº) DISPOSIÇÕES FINAIS ' +
    'Art. (Nº) Elaborar o Texto, Elaborar o Texto, Elaborar o Texto ... ' +
    'Art. (Nº) Esta Resolução entra em vigor na data de sua publicação.';

const modeloNovo = () => [
    {
        nome: 'cabecalho', editavel: false, estilo: undefined,
        classe: 'ck-read-only infra-editor__readonly',
        texto: 'ESTADO DE GOIÁS AGÊNCIA GOIANA DE REGULAÇÃO, CONTROLE E FISCALIZAÇÃO DE SERVIÇOS PÚBLICOS ASSESSORIA DA SECRETARIA GERAL',
    },
    {
        nome: 'titulo', editavel: true, estilo: 'Texto_Centralizado_Maiusculas', classe: 'ck-content',
        texto: 'RESOLUÇÃO AGR Nº 1, DE 14 DE AGOSTO DE 2026',
    },
    {
        nome: 'ementa', editavel: true, estilo: 'Texto_Ementa', classe: 'ck-content',
        texto: REP('Elaborar o Texto,', 10),
    },
    {
        nome: 'corpo', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha', classe: 'ck-content',
        texto: REP('Considerando,', 18) + ' resolve:',
    },
    {
        nome: 'artigos', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha',
        classe: 'ck-content infra-editor__secao-principal',
        texto: ARTIGOS_EM_BRANCO,
    },
    {
        nome: 'assinatura', editavel: true, estilo: 'Texto_Centralizado', classe: 'ck-content',
        texto: '[Nome do (a) usuário (a)]',
    },
];

let b = mapearBlocos(modeloNovo());
assert.deepStrictEqual([b.ementa.nome, b.considerandos.nome, b.artigos.nome],
    ['ementa', 'corpo', 'artigos'], 'modelo novo (sem RESOLVE:)');

// O título é o 1º editável e não pode virar ementa; a assinatura vem depois
// dos artigos e não pode virar nada.
assert.notStrictEqual(b.ementa.nome, 'titulo');
['ementa', 'considerandos', 'artigos'].forEach((k) =>
    assert.notStrictEqual(b[k].nome, 'assinatura'));

// Sem os marcadores do SEI, a posição entre os editáveis ainda acerta.
b = mapearBlocos(modeloNovo().map((r) => ({ ...r, estilo: 'Generico', classe: 'ck-content' })));
assert.deepStrictEqual([b.ementa.nome, b.considerandos.nome, b.artigos.nome],
    ['ementa', 'corpo', 'artigos'], 'modelo novo sem estilo/classe');

// ── Modelo ANTIGO (SEI de treinamento), com bloco 'RESOLVE:' editável ─────
// Continua funcionando: o RESOLVE: é pulado na escolha do corpo, senão ele
// seria o "editável logo antes dos artigos".
const modeloAntigo = () => [
    { nome: 'txaEditor_647', editavel: false, texto: 'ESTADO DE GOIÁS' },
    { nome: 'txaEditor_648', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha', texto: 'Resolução nº 2, de 13 de agosto de 2026' },
    { nome: 'txaEditor_658', editavel: true, estilo: 'Texto_Ementa', texto: REP('Elaborar o Texto,', 20) },
    { nome: 'txaEditor_653', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha', texto: ZWSP + REP('Considerando,' + ZWSP, 24) },
    { nome: 'txaEditor_651', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha_Esp15', texto: 'RESOLVE:' },
    { nome: 'txaEditor_655', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha', classe: 'infra-editor__secao-principal', texto: REP('Elaborar o Texto,', 60) },
    { nome: 'txaEditor_661', editavel: false, texto: '' },
    { nome: 'txaEditor_663', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha', texto: 'CONSELHO, em GOIANIA - GO, aos 13 dias do mês de agosto de 2026.' },
    { nome: 'txaEditor_657', editavel: true, texto: 'CEP 74000-000 - GOIANIA - GO' },
    { nome: 'txaEditor_708', editavel: false, texto: 'Referência: Processo nº 202600005004559 SEI 8441792' },
];
b = mapearBlocos(modeloAntigo());
assert.deepStrictEqual([b.ementa.nome, b.considerandos.nome, b.artigos.nome],
    ['txaEditor_658', 'txaEditor_653', 'txaEditor_655'], 'modelo antigo, com RESOLVE:');
// O RESOLVE: nunca é destino.
['ementa', 'considerandos', 'artigos'].forEach((k) =>
    assert.notStrictEqual(b[k].nome, 'txaEditor_651'));

// ── Documento já redigido: identificar não depende do placeholder ─────────
b = mapearBlocos([
    { nome: 'cab', editavel: false, texto: 'AGÊNCIA GOIANA DE REGULAÇÃO' },
    { nome: 'tit', editavel: true, estilo: 'x', texto: 'RESOLUÇÃO AGR Nº 9' },
    { nome: 'em', editavel: true, estilo: 'Texto_Ementa', texto: 'Dispõe sobre o Auto de Infração nº 45680 (80773781).' },
    { nome: 'cor', editavel: true, estilo: 'x', texto: 'O Conselho Regulador da AGR, no uso de suas atribuições, resolve:' },
    { nome: 'art', editavel: true, classe: 'infra-editor__secao-principal', texto: 'Art. 1º. Anular o Auto.' },
]);
assert.deepStrictEqual([b.ementa.nome, b.considerandos.nome, b.artigos.nome], ['em', 'cor', 'art']);

// ── Recusas: colar no lugar errado é pior que não colar ───────────────────
assert.strictEqual(mapearBlocos([
    { nome: 'cab', editavel: false, texto: 'AGR' },
    { nome: 'corpo', editavel: true, texto: 'Um ofício qualquer.' },
]), null, 'editáveis de menos');

assert.strictEqual(mapearBlocos([
    { nome: 'tit', editavel: true, texto: 'Título' },
    { nome: 'art', editavel: true, classe: 'infra-editor__secao-principal', texto: 'Art. 1º' },
    { nome: 'fim', editavel: true, texto: 'rodapé' },
]), null, 'artigos logo depois do título: não sobra bloco para o corpo');

// Ementa marcada DEPOIS dos artigos: ordem incoerente, recusa em vez de chutar.
assert.strictEqual(mapearBlocos([
    { nome: 'tit', editavel: true, texto: 'Título' },
    { nome: 'a', editavel: true, texto: 'algo' },
    { nome: 'art', editavel: true, classe: 'infra-editor__secao-principal', texto: 'Art. 1º' },
    { nome: 'em', editavel: true, estilo: 'Texto_Ementa', texto: 'ementa fora de lugar' },
]), null, 'ordem incoerente');

assert.strictEqual(mapearBlocos([]), null);
assert.strictEqual(mapearBlocos(null), null);

// ── blocosOcupados: o que a colagem destruiria ────────────────────────────
// Modelo novo em branco: os três blocos são só vocabulário do modelo. Inclui o
// bloco de artigos, que é o mais complexo — CAPÍTULO, Seção, XXXX, '[...]',
// 'Art. (Nº)', DISPOSIÇÕES FINAIS e a cláusula de vigência.
assert.deepStrictEqual(blocosOcupados(mapearBlocos(modeloNovo())), [],
    'modelo novo em branco não pede confirmação');
assert.deepStrictEqual(blocosOcupados(mapearBlocos(modeloAntigo())), [],
    'modelo antigo em branco também não');

// U+200B do modelo em branco não conta como texto do usuário.
let m = modeloNovo();
m[3].texto = ZWSP + 'Considerando, ' + ZWSP + 'Considerando, ' + ZWSP + 'Considerando, resolve:';
assert.deepStrictEqual(blocosOcupados(mapearBlocos(m)), []);

// Texto do usuário em qualquer bloco pede confirmação.
m = modeloNovo();
m[4].texto = 'Art. 1º. Ratificar a decisão de Primeira Instância proferida pela Câmara.';
assert.deepStrictEqual(blocosOcupados(mapearBlocos(m)), ['artigos']);

m = modeloNovo();
m[2].texto = 'Dispõe sobre o Auto de Infração nº 45680.';
assert.deepStrictEqual(blocosOcupados(mapearBlocos(m)), ['ementa']);

m = modeloNovo();
m[3].texto = 'O Conselho Regulador da AGR, no uso de suas atribuições, resolve:';
assert.deepStrictEqual(blocosOcupados(mapearBlocos(m)), ['considerandos']);

// ── estiloDoCorpo / ultimoDoCorpo ─────────────────────────────────────────
// Os 17 parágrafos reais do bloco de artigos (txaEditor_655), do dump do SEI
// 45.1.0-infra-202602092037. É o bloco heterogêneo do modelo, e o que expôs os
// dois defeitos: o estilo saía do 1º parágrafo (centralizado) e a substituição
// pegava o root inteiro (apagando a assinatura, que mora aqui dentro).
const CENTRAL = 'Tabela_Texto_Centralizado';
const ARTIGO = 'Texto_Justificado_Recuo_Primeira_Linha_Esp_Simples';
const RECUO = 'Texto_Justificado_Recuo_Primeira_Linha';
const ARTIGOS_655 = [
    { estilo: CENTRAL, texto: 'CAPÍTULO I' },
    { estilo: CENTRAL, texto: 'XXXXXXXXXXXXX' },
    { estilo: CENTRAL, texto: '' },
    { estilo: CENTRAL, texto: 'Seção I' },
    { estilo: CENTRAL, texto: 'XXXXXXXXXXXXX' },
    { estilo: CENTRAL, texto: '' },
    { estilo: ARTIGO, texto: 'Art.1º ' + REP('Elaborar o Texto,', 20) },
    { estilo: RECUO, texto: '[...]' },
    { estilo: RECUO, texto: '' },
    { estilo: CENTRAL, texto: 'CAPÍTULO (Nº)DISPOSIÇÕES FINAIS' },
    { estilo: 'Tabela_Texto_8', texto: '' },
    { estilo: ARTIGO, texto: 'Art. (Nº) Elaborar o Texto, Elaborar o Texto, Elaborar o Texto ...' },
    { estilo: ARTIGO, texto: 'Art. (Nº) Esta Resolução entra em vigor na data de sua publicação.' },
    { estilo: RECUO, texto: '' },
    { estilo: RECUO, texto: '' },
    { estilo: 'Texto_Centralizado', texto: '[Nome do (a) usuário (a)]' },
    { estilo: 'Texto_Centralizado', texto: '' },
];

// O 1º parágrafo é 'Tabela_Texto_Centralizado' — usá-lo centralizaria os
// artigos importados. O mais longo é o 'Art.1º ...', que dá o estilo certo.
assert.strictEqual(estiloDoCorpo(ARTIGOS_655), ARTIGO, 'estilo dos artigos');
assert.notStrictEqual(estiloDoCorpo(ARTIGOS_655), CENTRAL);
// A moda também erraria: há 7 centralizados contra 3 de artigo.
assert.strictEqual(ARTIGOS_655.filter((p) => p.estilo === CENTRAL).length, 7);
assert.strictEqual(ARTIGOS_655.filter((p) => p.estilo === ARTIGO).length, 3);

// A substituição para no último 'Art.' (índice 12). Os índices 13..16 — linhas
// em branco e '[Nome do (a) usuário (a)]' — ficam.
assert.strictEqual(ultimoDoCorpo(ARTIGOS_655, ARTIGO), 12, 'alcance para antes da assinatura');
assert.strictEqual(ARTIGOS_655[15].texto, '[Nome do (a) usuário (a)]');

// Blocos homogêneos: o alcance cobre tudo, como antes.
const EMENTA_658 = [
    { estilo: 'Texto_Ementa', texto: REP('Elaborar o Texto,', 20) },
    { estilo: 'Texto_Ementa', texto: '' },
];
assert.strictEqual(estiloDoCorpo(EMENTA_658), 'Texto_Ementa');
assert.strictEqual(ultimoDoCorpo(EMENTA_658, 'Texto_Ementa'), 1);

const CORPO_653 = [
    { estilo: RECUO, texto: ZWSP + REP('Considerando,', 24) + ' resolve:' },
    { estilo: RECUO, texto: '' },
];
assert.strictEqual(estiloDoCorpo(CORPO_653), RECUO);
assert.strictEqual(ultimoDoCorpo(CORPO_653, RECUO), 1);

// Documento já redigido: o estilo vem do artigo mais longo, não do capítulo.
assert.strictEqual(estiloDoCorpo([
    { estilo: CENTRAL, texto: 'CAPÍTULO I' },
    { estilo: ARTIGO, texto: 'Art. 1º. Ratificar a decisão de Primeira Instância proferida pela Câmara de Julgamento.' },
]), ARTIGO);

// Degenerados: sem parágrafo, sem estilo, estilo inexistente.
assert.strictEqual(estiloDoCorpo([]), undefined);
assert.strictEqual(estiloDoCorpo(null), undefined);
assert.strictEqual(ultimoDoCorpo(ARTIGOS_655, 'Estilo_Que_Nao_Existe'), -1,
    '-1 faz o chamador substituir o root inteiro');
assert.strictEqual(ultimoDoCorpo(null, ARTIGO), -1);

// ── ehAssinaturaModelo: a linha que a importação apaga ────────────────────
// Exatamente como veio no dump do SEI.
assert.ok(ehAssinaturaModelo('[Nome do (a) usuário (a)]'));
// Variações de espaçamento e acentuação do modelo.
assert.ok(ehAssinaturaModelo('[Nome do(a) usuario(a)]'));
assert.ok(ehAssinaturaModelo('  [Nome do (a) usuário (a)]  '));
assert.ok(ehAssinaturaModelo(ZWSP + '[Nome do (a) usuário (a)]'));

// Assinatura de verdade NÃO casa: reimportar não pode apagar o que alguém
// escreveu no lugar do marcador.
assert.ok(!ehAssinaturaModelo('JOÃO DA SILVA'));
assert.ok(!ehAssinaturaModelo('Presidente do Conselho Regulador'));
// Nem outras linhas entre colchetes do modelo.
assert.ok(!ehAssinaturaModelo('[...]'));
assert.ok(!ehAssinaturaModelo('[Cargo do (a) usuário (a)]'));
// Nem texto que só menciona a palavra sem ser o marcador.
assert.ok(!ehAssinaturaModelo('Nome do usuário: João'));
assert.ok(!ehAssinaturaModelo(''));
assert.ok(!ehAssinaturaModelo(null));

// No bloco de artigos real, é a única linha que sai.
assert.deepStrictEqual(
    ARTIGOS_655.filter((p) => ehAssinaturaModelo(p.texto)).map((p) => p.texto),
    ['[Nome do (a) usuário (a)]']);

// ── vaziosDoFim: o espaço solto que sobra depois da assinatura ────────────
// O estado real do bloco de artigos logo depois da colagem e da remoção da
// assinatura: dois artigos e três parágrafos em branco.
const NBSP = ' ';
assert.deepStrictEqual(
    vaziosDoFim([
        { texto: 'Art. 1º. Ratificar a decisão.' },
        { texto: 'Art. 2º. Entra em vigor.' },
        { texto: '' },
        { texto: '' },
        { texto: '' },
    ]),
    [4, 3, 2], 'de trás pra frente, para os índices anteriores seguirem válidos');

// Vazio no MEIO do texto é do autor, não do modelo: para no primeiro com conteúdo.
assert.deepStrictEqual(vaziosDoFim([
    { texto: 'Art. 1º.' }, { texto: '' }, { texto: 'Art. 2º.' },
]), []);

// ZWSP e nbsp contam como vazio — o modelo usa os dois de espaçador.
assert.deepStrictEqual(vaziosDoFim([
    { texto: 'Art. 1º.' }, { texto: ZWSP }, { texto: NBSP + ' ' },
]), [2, 1]);

// Nunca devolve o índice 0: um root sem nenhum filho é inválido no CKEditor.
assert.deepStrictEqual(vaziosDoFim([{ texto: '' }, { texto: '' }]), [1]);
assert.deepStrictEqual(vaziosDoFim([{ texto: '' }]), []);
assert.deepStrictEqual(vaziosDoFim([]), []);
assert.deepStrictEqual(vaziosDoFim(null), []);

// A ordem importa: a assinatura fica ENTRE os vazios, então só depois de
// removê-la os três ficam contíguos no fim e saem juntos.
const CAUDA_REAL = [
    { texto: 'Art. 1º. Ratificar a decisão.' },
    { texto: 'Art. 2º. Entra em vigor.' },
    { texto: '' },
    { texto: '' },
    { texto: '[Nome do (a) usuário (a)]' },
    { texto: '' },
];
assert.deepStrictEqual(vaziosDoFim(CAUDA_REAL), [5],
    'com a assinatura no meio, só o último vazio sai');
assert.deepStrictEqual(
    vaziosDoFim(CAUDA_REAL.filter((p) => !ehAssinaturaModelo(p.texto))),
    [4, 3, 2], 'removida a assinatura, os três saem');

console.log('ok');

