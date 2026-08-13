// Candidatos a protocolo SEI num texto livre.
// Ordem das alternativas importa: a mais longa primeiro.
//   \d{5}\.\d{6}/\d{4}-\d{2}  -> processo no formato mascarado padrao (12345.678901/2026-99)
//   \d{15,17}                 -> processo sem mascara (ex.: GO -> 202600005004296)
//   \d{7,9}                   -> numero SEI do documento (ex.: 80773781)
// A faixa 10-14 fica de fora de proposito: e onde caem telefones e CEP+DDD.
// CNPJ/CPF/datas/valores nao batem porque seus grupos tem no maximo 4 digitos.
// A validacao final e do servidor do SEI: candidato que nao resolve e descartado.
var RE_PROTOCOLO = /\b(\d{5}\.\d{6}\/\d{4}-\d{2}|\d{15,17}|\d{7,9})\b/g;

function candidatosProtocolo(texto) {
    var out = [];
    var m;
    RE_PROTOCOLO.lastIndex = 0;
    while ((m = RE_PROTOCOLO.exec(texto)) !== null) {
        out.push({ num: m[0], start: m.index, len: m[0].length });
    }
    return out;
}

// O processo a que o documento pertence, lido do rodape de referencia que o SEI
// gera do modelo: "Referência: Processo nº 202600005004559". E o processo do
// documento, e nao um numero que por acaso apareca no texto redigido -- por
// isso a marca 'Referência' e obrigatoria antes de cair na varredura generica.
//
// O `config.get('sei')` do editor NAO serve para isso: o `idProcedimento` de la
// e o id interno do SEI (ex.: 8455633), nao o numero visivel do processo.
var RE_REFERENCIA = /Refer[êe]ncia:\s*Processo\s*n[º°o]?\s*([\d.\/-]{15,25})/i;

function processoDeReferencia(texto) {
    var m = String(texto || '').match(RE_REFERENCIA);
    if (m) return m[1];
    // Reserva, para modelo de documento sem esse rodape: o primeiro numero com
    // cara de processo (>= 15 digitos), nunca um numero de documento.
    var achados = candidatosProtocolo(texto || '')
        .filter(function (c) { return c.num.replace(/\D/g, '').length >= 15; });
    return achados.length ? achados[0].num : '';
}

if (typeof module !== 'undefined') module.exports = {
    RE_PROTOCOLO: RE_PROTOCOLO,
    candidatosProtocolo: candidatosProtocolo,
    processoDeReferencia: processoDeReferencia,
};
