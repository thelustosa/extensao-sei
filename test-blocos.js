// node test-blocos.js
const assert = require('assert');
const { mapearBlocos, blocosOcupados } = require('./blocos.js');

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

console.log('ok');
