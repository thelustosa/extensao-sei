// Gera o sei-agr-extensao.zip, o pacote que o Gestão de Autos IA serve em
// /download/extensao. Rodar: node empacotar.js
//
// A lista de arquivos sai do PRÓPRIO manifest.json — content_scripts, service
// worker e icons — mais o README. Digitar a lista à mão foi o que produziu
// quatro pacotes seguidos sem a pasta icons/, e um manifest que declara
// "icons": {...} apontando para arquivo ausente faz o Chrome RECUSAR a
// extensão inteira, com um erro que só aparece na hora de instalar.
//
// bsdtar (C:\Windows\System32\tar.exe), e não Compress-Archive do PowerShell:
// este último grava os caminhos com barra INVERTIDA ('icons\icon-16.png'),
// e o formato ZIP exige barra normal — o Chrome não encontraria os ícones.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const raiz = __dirname;
const SAIDA = 'sei-agr-extensao.zip';
const TAR = 'C:/Windows/System32/tar.exe';

const manifest = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));

const arquivos = ['manifest.json', 'README.md'];
(manifest.content_scripts || []).forEach((cs) => arquivos.push(...(cs.js || [])));
if (manifest.background && manifest.background.service_worker) {
    arquivos.push(manifest.background.service_worker);
}
arquivos.push(...Object.values(manifest.icons || {}));

// Sem duplicata (o mesmo script pode aparecer em dois content_scripts) e em
// ordem estável, para o zip não mudar sozinho entre execuções.
const lista = [...new Set(arquivos)].sort();

const faltando = lista.filter((f) => !fs.existsSync(path.join(raiz, f)));
if (faltando.length) {
    throw new Error('arquivo declarado no manifest e ausente no disco: ' + faltando.join(', '));
}

fs.rmSync(path.join(raiz, SAIDA), { force: true });
execFileSync(TAR, ['-a', '-c', '-f', SAIDA, ...lista], { cwd: raiz, stdio: 'inherit' });

console.log(`${SAIDA}: ${lista.length} arquivos`);
lista.forEach((f) => console.log('  ' + f));
