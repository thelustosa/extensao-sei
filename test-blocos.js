// node test-blocos.js
const assert = require('assert');
const { mapearBlocos, blocosOcupados } = require('./blocos.js');

// Os 11 roots reais do modelo de Resolução do SEI 5.0.4, como o
// diagnostico-resolucao.js os devolveu (SEI de treinamento, CKEditor
// 45.1.0-infra-202508082051). Textos abreviados; estilo, classe e ordem são os
// do dump. Este é o caso que importa: se ele passar, a extensão acerta.
const ZWSP = '​';
const REP = (s, n) => Array(n).fill(s).join(' ');

const modeloReal = () => [
    {
        nome: 'txaEditor_647', editavel: false, estilo: undefined,
        classe: 'ck ck-content ck-editor__editable ck-read-only infra-editor__readonly infra-doc',
        texto: 'ESTADO DE GOIÁS SECRETARIA DE ESTADO DA ADMINISTRAÇÃO',
    },
    {
        nome: 'txaEditor_648', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha',
        classe: 'ck ck-content ck-editor__editable infra-doc',
        texto: 'Resolução nº 2, de 13 de agosto de 2026',
    },
    {
        nome: 'txaEditor_658', editavel: true, estilo: 'Texto_Ementa',
        classe: 'ck ck-content ck-editor__editable infra-doc ck-focused',
        texto: REP('Elaborar o Texto,', 20),
    },
    {
        nome: 'txaEditor_653', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha',
        classe: 'ck ck-content ck-editor__editable infra-doc',
        texto: ZWSP + REP('Considerando,' + ZWSP, 24),
    },
    {
        nome: 'txaEditor_651', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha_Esp15',
        classe: 'ck ck-content ck-editor__editable infra-doc',
        texto: 'RESOLVE:',
    },
    {
        nome: 'txaEditor_655', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha',
        classe: 'ck ck-content ck-editor__editable infra-editor__secao-principal infra-doc',
        texto: REP('Elaborar o Texto,', 60),
    },
    { nome: 'txaEditor_661', editavel: false, estilo: undefined, classe: 'ck-read-only', texto: '' },
    {
        nome: 'txaEditor_663', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha',
        classe: 'ck ck-content ck-editor__editable infra-doc',
        texto: 'CONSELHO DE DESENVOLVIMENTO DO ESTADO, em GOIANIA - GO, aos 13 dias do mês de agosto de 2026.',
    },
    { nome: 'txaEditor_662', editavel: false, estilo: undefined, classe: 'ck-read-only', texto: '' },
    {
        nome: 'txaEditor_657', editavel: true, estilo: undefined,
        classe: 'ck ck-content ck-editor__editable infra-doc',
        texto: 'CONSELHO DE DESENVOLVIMENTO DO ESTADO CEP 74000-000 - GOIANIA - GO',
    },
    {
        nome: 'txaEditor_708', editavel: false, estilo: undefined, classe: 'ck-read-only',
        texto: 'Referência: Processo nº 202600005004559 SEI 8441792',
    },
];

let b = mapearBlocos(modeloReal());
assert.deepStrictEqual(
    [b.ementa.nome, b.considerandos.nome, b.artigos.nome],
    ['txaEditor_658', 'txaEditor_653', 'txaEditor_655'],
    'modelo real do SEI');

// O título ("Resolução nº 2, de …") é o PRIMEIRO editável e não é a ementa.
// Foi o erro que o diagnóstico pegou: sem o estilo, a heurística "primeiro
// editável antes do RESOLVE:" colava a ementa em cima do número da Resolução.
assert.notStrictEqual(b.ementa.nome, 'txaEditor_648');
// E o rodapé de endereço, editável, não pode ser confundido com os artigos —
// é a classe infra-editor__secao-principal que decide.
assert.notStrictEqual(b.artigos.nome, 'txaEditor_657');

// O 'RESOLVE:' vem editável neste modelo: é divisor, nunca destino.
[b.ementa.nome, b.considerandos.nome, b.artigos.nome].forEach((n) =>
    assert.notStrictEqual(n, 'txaEditor_651'));

// ── Fallback posicional: outro modelo, sem os marcadores do SEI ────────────
const semMarcadores = modeloReal().map((r) => ({ ...r, estilo: 'Generico', classe: 'ck-content' }));
b = mapearBlocos(semMarcadores);
assert.deepStrictEqual(
    [b.ementa.nome, b.considerandos.nome, b.artigos.nome],
    ['txaEditor_658', 'txaEditor_653', 'txaEditor_655'],
    'sem estilo/classe, a posição em torno do RESOLVE: ainda acerta');

// ── Documento já redigido: a identificação não pode depender do placeholder ──
b = mapearBlocos([
    { nome: 'cab', editavel: false, texto: 'AGÊNCIA GOIANA DE REGULAÇÃO' },
    { nome: 'tit', editavel: true, estilo: 'Texto_Justificado_Recuo_Primeira_Linha', texto: 'Resolução nº 9' },
    { nome: 'em', editavel: true, estilo: 'Texto_Ementa', texto: 'Dispõe sobre o Auto de Infração nº 45680 (80773781).' },
    { nome: 'con', editavel: true, estilo: 'x', texto: 'O Conselho Regulador da AGR, no uso de suas atribuições' },
    { nome: 'res', editavel: false, texto: 'RESOLVE:' },
    { nome: 'art', editavel: true, classe: 'infra-editor__secao-principal', texto: 'Art. 1º. Anular o Auto.' },
]);
assert.deepStrictEqual([b.ementa.nome, b.considerandos.nome, b.artigos.nome], ['em', 'con', 'art']);

// ── Recusas: colar no lugar errado é pior que não colar ────────────────────
assert.strictEqual(mapearBlocos([
    { nome: 'cab', editavel: false, texto: 'AGR' },
    { nome: 'corpo', editavel: true, texto: 'Um ofício qualquer, sem RESOLVE.' },
]), null, 'documento que não é Resolução');

assert.strictEqual(mapearBlocos([
    { nome: 'r1', editavel: true, texto: 'Elaborar o Texto.' },
    { nome: 'rR', editavel: false, texto: 'RESOLVE:' },
    { nome: 'rA', editavel: true, texto: 'Elaborar o Texto.' },
]), null, 'um editável só antes do RESOLVE: não separa ementa de considerandos');

assert.strictEqual(mapearBlocos([
    { nome: 'r1', editavel: true, texto: 'Elaborar o Texto.' },
    { nome: 'r2', editavel: true, texto: 'Considerando,' },
    { nome: 'rR', editavel: false, texto: 'RESOLVE:' },
]), null, 'sem bloco editável depois do RESOLVE: não há onde colar os artigos');

assert.strictEqual(mapearBlocos([]), null);

// ── blocosOcupados: o que a colagem destruiria ─────────────────────────────
// Os considerandos em branco vêm com U+200B entre cada "Considerando," e
// trim() não remove esse caractere. Sem tratá-lo, o modelo em branco pedia
// confirmação como se o usuário já tivesse escrito.
b = mapearBlocos(modeloReal());
assert.deepStrictEqual(blocosOcupados(b), [], 'modelo em branco não pede confirmação');

// O innerText real dos considerandos: U+200B nas junções e U+00A0 (&nbsp;)
// depois de cada vírgula, exatamente como saiu do dump do editor.
const consideandosReais = ZWSP + 'Considerando, ' + ZWSP + 'Considerando, '
    + ZWSP + 'Considerando, ' + ZWSP + 'Considerando.';
const comNbsp = modeloReal();
comNbsp[3].texto = consideandosReais;
assert.deepStrictEqual(blocosOcupados(mapearBlocos(comNbsp)), [],
    'ZWSP + NBSP do modelo em branco não contam como texto do usuário');

const comTexto = modeloReal();
comTexto[5].texto = 'Art. 1º. Anular o Auto de Infração nº 45680.';
assert.deepStrictEqual(blocosOcupados(mapearBlocos(comTexto)), ['artigos'],
    'texto do usuário pede confirmação');

const soEmenta = modeloReal();
soEmenta[2].texto = 'Dispõe sobre o Auto de Infração nº 45680.';
assert.deepStrictEqual(blocosOcupados(mapearBlocos(soEmenta)), ['ementa']);

console.log('ok');
