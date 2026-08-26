// node test-pacote.js
//
// O sei-agr-extensao.zip versionado é o que o Gestão de Autos IA serve em
// /download/extensao — é ele que as pessoas instalam. Duas maneiras de ele
// estar errado sem ninguém perceber, e as duas já aconteceram:
//
//   1. faltar um arquivo que o manifest declara. Um "icons": {...} apontando
//      para PNG ausente faz o Chrome RECUSAR a extensão inteira, e o erro só
//      aparece na hora de instalar;
//   2. estar velho. O pacote publicado ficou doze dias atrás do código, então
//      quem baixava recebia a versão que ainda exigia o bloco 'RESOLVE:' e
//      recusava o modelo novo do SEI.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const raiz = __dirname;
const ZIP = path.join(raiz, 'sei-agr-extensao.zip');
const TAR = 'C:/Windows/System32/tar.exe';

assert.ok(fs.existsSync(ZIP), 'sei-agr-extensao.zip não existe — rode node empacotar.js');

const manifest = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));

// Tudo que o manifest declara: os scripts de conteúdo, o service worker e os
// ícones. É a mesma derivação de empacotar.js, escrita de novo de propósito —
// um teste que importasse a lista do empacotador validaria o empacotador
// contra si mesmo.
const declarados = ['manifest.json'];
(manifest.content_scripts || []).forEach((cs) => declarados.push(...(cs.js || [])));
if (manifest.background && manifest.background.service_worker) {
    declarados.push(manifest.background.service_worker);
}
declarados.push(...Object.values(manifest.icons || {}));

const dentro = execFileSync(TAR, ['-tf', ZIP], { cwd: raiz, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);

// (1) Nada declarado pode faltar.
const faltando = [...new Set(declarados)].filter((f) => !dentro.includes(f));
assert.deepStrictEqual(faltando, [], 'arquivos do manifest ausentes no zip');

// O ZIP exige barra normal. Compress-Archive do PowerShell grava barra
// invertida, e aí o Chrome não encontra 'icons/icon-16.png'.
assert.deepStrictEqual(dentro.filter((f) => f.includes('\\')), [],
    'caminhos com barra invertida no zip');

// (2) O conteúdo tem que ser o da árvore, não uma cópia velha.
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'seiagr-'));
try {
    execFileSync(TAR, ['-xf', ZIP, '-C', tmp], { cwd: raiz });
    const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    const velhos = dentro.filter((f) => sha(path.join(raiz, f)) !== sha(path.join(tmp, f)));
    assert.deepStrictEqual(velhos, [],
        'zip desatualizado em relação à árvore — rode node empacotar.js');
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`ok — ${dentro.length} arquivos, todos do manifest presentes e atualizados`);
