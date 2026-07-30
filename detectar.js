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

if (typeof module !== 'undefined') module.exports = { RE_PROTOCOLO: RE_PROTOCOLO, candidatosProtocolo: candidatosProtocolo };
