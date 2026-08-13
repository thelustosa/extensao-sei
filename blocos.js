// Qual root do editor e qual bloco da Resolucao.
//
// O documento do SEI 5 e multi-root. No modelo de Resolucao os 11 roots saem,
// em ordem visual: cabecalho (read-only), titulo/numero, EMENTA,
// CONSIDERANDOS, 'RESOLVE:', ARTIGOS, dois vazios read-only, local e data,
// rodape de endereco, referencia (read-only).
//
// Nomes de root nao dizem nada -- sao 'txaEditor_<id>' gerados pelo SEI, e o id
// muda a cada documento. A identificacao sai de tres sinais, em ordem de
// confianca:
//
//   1. o estilo do paragrafo: a ementa tem 'Texto_Ementa', so ela;
//   2. a classe do editable: o SEI marca os artigos com
//      'infra-editor__secao-principal';
//   3. a posicao em relacao ao bloco 'RESOLVE:', que e o divisor.
//
// Os considerandos ficam so na posicao: o estilo deles
// ('Texto_Justificado_Recuo_Primeira_Linha') e o mesmo do titulo e do bloco de
// local e data, entao nao serve para distinguir. Mas eles sao sempre o ultimo
// bloco editavel antes do 'RESOLVE:'.
//
// Funcao pura, separada do content.js, porque e a parte que erra em silencio:
// um mapeamento trocado cola o considerando na ementa. Ver test-blocos.js.

var ESTILO_EMENTA = 'Texto_Ementa';
var CLASSE_ARTIGOS = 'infra-editor__secao-principal';

var RE_RESOLVE = /^resolve\s*:?$/i;
// O que o modelo do SEI deixa nos blocos ainda nao redigidos. Bloco com isso
// pode ser sobrescrito sem perguntar; qualquer outro texto e trabalho do usuario.
var RE_PLACEHOLDER = /^(elaborar o texto[\s,.;]*)+$|^(considerando[\s,.;]*)+$/i;

// U+200B (zero-width space) aparece no meio e no inicio dos paragrafos do
// modelo, e `trim()` NAO o remove -- ele e categoria Cf, nao espaco em branco.
// Sem tirar daqui, /^considerando/ nao casa com "​Considerando, ..." e o
// bloco em branco passa por "escrito pelo usuario".
function texto(root) {
    return String((root && root.texto) || '').replace(/​/g, '').trim();
}

// roots: [{ nome, editavel, texto, classe, estilo }] em ordem visual.
// `estilo` e o atributo de modelo do primeiro paragrafo do root.
// Retorna { ementa, considerandos, artigos } com os elementos recebidos, ou
// null se a pagina nao for uma Resolucao com esses blocos.
function mapearBlocos(roots) {
    var iResolve = -1;
    for (var i = 0; i < roots.length; i++) {
        if (RE_RESOLVE.test(texto(roots[i]))) { iResolve = i; break; }
    }
    if (iResolve < 0) return null;

    // O 'RESOLVE:' e editavel neste modelo, mas nunca e destino: fica de fora
    // dos dois lados por construcao (o slice o exclui).
    var antes = roots.slice(0, iResolve).filter(function (r) { return r.editavel; });
    var depois = roots.slice(iResolve + 1).filter(function (r) { return r.editavel; });
    // Menos de dois editaveis antes do RESOLVE: nao ha como separar ementa de
    // considerandos, e chutar aqui significa colar no bloco errado.
    if (antes.length < 2 || !depois.length) return null;

    var considerandos = antes[antes.length - 1];

    // Ementa pelo estilo. Sem ele (outro modelo, outra instalacao do SEI), o
    // bloco imediatamente acima dos considerandos -- e NAO o primeiro editavel,
    // que neste modelo e o titulo "Resolução nº 2, de 13 de agosto de 2026".
    var ementa = null;
    for (var j = 0; j < antes.length; j++) {
        if (antes[j].estilo === ESTILO_EMENTA) { ementa = antes[j]; break; }
    }
    if (!ementa) ementa = antes[antes.length - 2];
    if (ementa === considerandos) return null;

    // Artigos pela secao principal que o SEI marca. Sem ela, o primeiro
    // editavel depois do RESOLVE:.
    var artigos = null;
    for (var k = 0; k < depois.length; k++) {
        if (String(depois[k].classe || '').indexOf(CLASSE_ARTIGOS) >= 0) { artigos = depois[k]; break; }
    }
    if (!artigos) artigos = depois[0];

    return { ementa: ementa, considerandos: considerandos, artigos: artigos };
}

// Blocos que ja tem texto do usuario -- os que uma colagem destruiria.
function blocosOcupados(blocos) {
    return ['ementa', 'considerandos', 'artigos'].filter(function (k) {
        var t = texto(blocos[k]);
        return t && !RE_PLACEHOLDER.test(t);
    });
}

if (typeof module !== 'undefined') {
    module.exports = { mapearBlocos: mapearBlocos, blocosOcupados: blocosOcupados };
}
