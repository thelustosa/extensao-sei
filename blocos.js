// Qual root do editor e qual bloco da Resolucao.
//
// O documento do SEI 5 e multi-root. No modelo de Resolucao da AGR os blocos
// editaveis saem, em ordem visual:
//
//   0  titulo    "RESOLUÇÃO AGR Nº 1, DE 14 DE AGOSTO DE 2026"
//   1  EMENTA    "Elaborar o Texto, Elaborar o Texto, ..."
//   2  CORPO     "Considerando, Considerando, ..., resolve:"   <- os considerandos
//   3  ARTIGOS   "CAPÍTULO I / Seção I / Art.1º ... / DISPOSIÇÕES FINAIS"
//
// Nomes de root nao servem: sao 'txaEditor_<id>' e o id muda a cada documento.
// A identificacao sai de tres sinais, em ordem de confianca:
//
//   1. o estilo do paragrafo: a ementa tem 'Texto_Ementa', so ela;
//   2. a classe do editable: o SEI marca os artigos com
//      'infra-editor__secao-principal';
//   3. a posicao entre os editaveis, como reserva.
//
// O corpo fica so na posicao -- e o editavel logo antes dos artigos. O estilo
// dele ('Texto_Justificado_Recuo_Primeira_Linha') e o mesmo do titulo e do
// bloco de local e data, entao nao distingue.
//
// O modelo ANTIGO tinha um bloco 'RESOLVE:' proprio entre o corpo e os artigos,
// e ele era editavel. O modelo novo nao tem -- o 'resolve:' virou o fim do
// corpo. `_pularResolve` mantem os dois funcionando: e um bloco que nunca e
// destino, e sem pula-lo ele seria escolhido como corpo no modelo antigo.
//
// Funcao pura, separada do content.js, porque e a parte que erra em silencio:
// um mapeamento trocado cola o considerando na ementa. Ver test-blocos.js.

var ESTILO_EMENTA = 'Texto_Ementa';
var CLASSE_ARTIGOS = 'infra-editor__secao-principal';
var RE_SO_RESOLVE = /^resolvem?\s*:?$/i;

// Vocabulario do modelo em branco. Bloco feito so disto pode ser sobrescrito
// sem perguntar; qualquer palavra fora da lista e trabalho do usuario.
//
// Por remocao de tokens, e nao por um regex do texto inteiro: o bloco de
// artigos do modelo novo mistura CAPÍTULO, Seção, XXXX, '[...]', 'Art. (Nº)' e
// 'DISPOSIÇÕES FINAIS', e enumerar isso numa expressao so seria ilegivel e
// quebraria no proximo ajuste do modelo. O vies desta forma e o seguro: token
// que eu nao previ conta como texto do usuario, entao a extensao PERGUNTA em
// vez de sobrescrever calada.
var TOKENS_MODELO = [
    /elaborar o texto/gi,
    /considerando/gi,
    /resolvem?\s*:/gi,
    /cap[íi]tulo\s*(\(\s*n[º°o]?\s*\)|[ivxl]+|\d+)?/gi,
    /se[çc][ãa]o\s*(\(\s*n[º°o]?\s*\)|[ivxl]+|\d+)?/gi,
    /disposi[çc][õo]es\s+finais/gi,
    /art\.?\s*(\(\s*n[º°o]?\s*\)|\d+\s*[º°]?)/gi,
    /esta\s+resolu[çc][ãa]o\s+entra\s+em\s+vigor[^.]*\.?/gi,
    /x{3,}/gi,
    /\[\s*\.\.\.\s*\]/g,
];

// U+200B (zero-width space) aparece no meio e no inicio dos paragrafos do
// modelo, e `trim()` NAO o remove -- ele e categoria Cf, nao espaco em branco.
function texto(root) {
    return String((root && root.texto) || '').replace(/​/g, '').trim();
}

function ehPlaceholder(t) {
    var resto = t;
    for (var i = 0; i < TOKENS_MODELO.length; i++) resto = resto.replace(TOKENS_MODELO[i], ' ');
    // Sobrou letra ou digito? Entao ha texto que o modelo nao explica.
    return !/[0-9a-zà-öø-ÿ]/i.test(resto);
}

function _pularResolve(editaveis, i) {
    while (i >= 0 && RE_SO_RESOLVE.test(texto(editaveis[i]))) i--;
    return i;
}

// roots: [{ nome, editavel, texto, classe, estilo }] em ordem visual.
// `estilo` e o atributo de modelo do primeiro paragrafo do root.
// Retorna { ementa, considerandos, artigos } com os elementos recebidos, ou
// null se a pagina nao tiver os tres blocos identificaveis.
function mapearBlocos(roots) {
    var editaveis = (roots || []).filter(function (r) { return r.editavel; });
    if (editaveis.length < 3) return null;

    var artigos = null;
    for (var k = 0; k < editaveis.length; k++) {
        if (String(editaveis[k].classe || '').indexOf(CLASSE_ARTIGOS) >= 0) { artigos = editaveis[k]; break; }
    }
    if (!artigos) artigos = editaveis[3];
    if (!artigos) return null;
    var iArt = editaveis.indexOf(artigos);

    // Corpo: o editavel logo antes dos artigos, pulando um 'RESOLVE:' solto.
    var iCorpo = _pularResolve(editaveis, iArt - 1);
    if (iCorpo < 1) return null; // precisa sobrar pelo menos o titulo antes

    var ementa = null;
    for (var j = 0; j < editaveis.length; j++) {
        if (editaveis[j].estilo === ESTILO_EMENTA) { ementa = editaveis[j]; break; }
    }
    if (!ementa) ementa = editaveis[1];
    var iEmenta = editaveis.indexOf(ementa);

    // Ordem tem que fechar: ementa antes do corpo, corpo antes dos artigos.
    // Sem isso a extensao colaria em cima do titulo ou do rodape.
    if (!(iEmenta >= 0 && iEmenta < iCorpo && iCorpo < iArt)) return null;

    return { ementa: ementa, considerandos: editaveis[iCorpo], artigos: artigos };
}

// ── Estilo e alcance da colagem, dentro de um bloco ───────────────────────
// Recebem `paragrafos`: [{ estilo, texto }] na ordem do root.

// O estilo do TEXTO CORRIDO do bloco -- o do paragrafo mais longo, nao o do
// primeiro.
//
// O bloco de artigos do modelo novo nao e homogeneo: comeca com 'CAPÍTULO I' e
// 'Seção I' em 'Tabela_Texto_Centralizado', e so os paragrafos 'Art. ...' usam
// 'Texto_Justificado_Recuo_Primeira_Linha_Esp_Simples'. Pegando o primeiro
// paragrafo, os artigos importados sairiam CENTRALIZADOS. A moda tambem erra:
// no modelo em branco ha mais linha de titulo que artigo. O paragrafo mais
// longo e o texto redigido -- titulo de capitulo, '[...]' e linha de assinatura
// sao curtos por natureza.
function estiloDoCorpo(paragrafos) {
    var melhor, maior = -1;
    (paragrafos || []).forEach(function (p) {
        var n = String((p && p.texto) || '').length;
        if (n > maior) { maior = n; melhor = p; }
    });
    return melhor ? melhor.estilo : undefined;
}

// Indice do ultimo paragrafo com o estilo do texto corrido. O que vem depois
// dele nao pode ser substituido.
//
// No modelo novo a ASSINATURA mora dentro do root dos artigos: os ultimos
// paragrafos sao linhas em branco e '[Nome do (a) usuário (a)]', em
// 'Texto_Centralizado'. Substituir o root inteiro apagaria isso junto, sem
// pedir nada a ninguem. -1 = nao achou, e o chamador substitui tudo.
function ultimoDoCorpo(paragrafos, estilo) {
    var ultimo = -1;
    (paragrafos || []).forEach(function (p, i) {
        if (p && p.estilo === estilo) ultimo = i;
    });
    return ultimo;
}

// A linha '[Nome do (a) usuário (a)]' que o modelo deixa no fim do bloco de
// artigos. E marcador do modelo, nao conteudo: quem assina no SEI e a acao
// Assinar, e a linha so atrapalha na minuta importada.
//
// Casa so a forma ENTRE COLCHETES do modelo. Um nome de verdade digitado no
// lugar dela ("JOAO DA SILVA") nao casa, entao reimportar nao apaga assinatura
// que alguem escreveu.
var RE_ASSINATURA_MODELO = /^\[[^\]]*nome[^\]]*usu[áa]rio[^\]]*\]$/i;

function ehAssinaturaModelo(t) {
    return RE_ASSINATURA_MODELO.test(String(t || '').replace(/​/g, '').trim());
}

// Blocos que ja tem texto do usuario -- os que uma colagem destruiria.
function blocosOcupados(blocos) {
    return ['ementa', 'considerandos', 'artigos'].filter(function (k) {
        var t = texto(blocos[k]);
        return t && !ehPlaceholder(t);
    });
}

if (typeof module !== 'undefined') {
    module.exports = {
        mapearBlocos: mapearBlocos,
        blocosOcupados: blocosOcupados,
        estiloDoCorpo: estiloDoCorpo,
        ultimoDoCorpo: ultimoDoCorpo,
        ehAssinaturaModelo: ehAssinaturaModelo,
    };
}
