// node test-deteccao.js
const assert = require('assert');
const { candidatosProtocolo } = require('./detectar.js');

const nums = (t) => candidatosProtocolo(t).map((c) => c.num);

// Caso real: so o numero SEI do documento e o do processo devem ser candidatos.
assert.deepStrictEqual(
    nums('Dispoe sobre o Auto de Infracao no 45680 (80773781), em nome da empresa ' +
         'AUTO VIACAO GOIANESIA LTDA (CNPJ no 03.641.223/0001-26), conforme processo ' +
         'no 202600005004296.'),
    ['80773781', '202600005004296'],
    'auto de infracao (5 digitos) e CNPJ nao podem virar candidatos');

// Processo no formato mascarado padrao do SEI.
assert.deepStrictEqual(nums('Processo 12345.678901/2026-99 arquivado.'), ['12345.678901/2026-99']);

// Ruido que nao pode virar candidato.
assert.deepStrictEqual(nums('Em 05/03/2026, R$ 1.234.567,89, CPF 123.456.789-00, fone (62) 99999-8888'), []);
assert.deepStrictEqual(nums('Lei no 14.133, de 2021, art. 75'), []);

// Varios numeros no mesmo texto, com offsets corretos.
const c = candidatosProtocolo('doc 80773781 e doc 80773999');
assert.deepStrictEqual(c.map((x) => [x.num, x.start, x.len]), [['80773781', 4, 8], ['80773999', 19, 8]]);

console.log('ok');
