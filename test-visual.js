// Banco de teste do painel SEI AGR.
//
// Extrai o CSS REAL de content.js e renderiza o painel DENTRO de um
// .ck-reset_all identico ao do CKEditor do SEI — que e exatamente o que
// atropelava os seletores de classe simples. Se sobreviver aqui, sobrevive
// na toolbar.
//
// Rodar: node test-visual.js   ->   test-visual.html + test-visual.png
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, 'content.js');
const src = fs.readFileSync(REPO, 'utf8');
const ini = src.indexOf('var CSS = [');
const fim = src.indexOf("].join('');", ini);
if (ini < 0 || fim < 0) throw new Error('bloco CSS nao encontrado em content.js');
const M = '#seiAgrMenu';
const B = M + ' button.sei-agr-btn';
const css = new Function('M', 'B', 'return ' + src.slice(ini + 'var CSS = '.length, fim + 1) + ".join('')")(M, B);
if (css.length < 2000) throw new Error('CSS suspeito de estar truncado: ' + css.length);

// Nenhum seletor pode depender so de classe: o reset do CKEditor ganharia.
const frouxos = css.match(/(^|[{},])\s*\.sei-agr-[^{,]*\{/g);
if (frouxos) throw new Error('seletor sem blindagem de id: ' + frouxos.join(' '));

// As cores amostradas dos logos oficiais tem que estar nos tokens.
for (const c of ['#008C59', '#F9DA2A', '#007A4E']) {
  if (!css.includes(c)) throw new Error('cor oficial ausente do CSS: ' + c);
}

const selo = '<span class="sei-agr-selo">sei<i>!</i></span>';
const acao = (cls, marca, rot, extra = '') =>
  `<button type="button" class="sei-agr-btn ${cls}" ${extra}><span class="sei-agr-marca ${marca}">${
    marca === 'sei-agr-marca-spin' ? spinner : marca === 'sei-agr-marca-ok' ? check : ''
  }</span><span class="sei-agr-rotulo">${rot}</span></button>`;

const spinner = '<svg class="sei-agr-spinner" width="15" height="15" viewBox="0 0 24 24" fill="none">' +
  '<circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-opacity=".22" stroke-width="2.5"/>' +
  '<path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
const check = '<svg class="sei-agr-icone-confirmacao" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M5.5 12.5l4.1 4.1 8.9-9"/></svg>';

const painel = (miolo, acoes) => `
<div id="seiAgrMenu" class="sei-agr-menu sei-agr-menu-aberto" style="display:block">
  <button type="button" class="sei-agr-menu-gatilho" aria-expanded="true">${selo}<span class="sei-agr-menu-nome">SEI AGR</span></button>
  <div class="sei-agr-menu-acoes" style="position:static;margin-top:6px">
    <div class="sei-agr-menu-cab">${selo}<span class="sei-agr-menu-cab-nome">SEI<i>AGR</i></span></div>
    <div class="sei-agr-menu-corpo">
      ${acoes || acao('sei-agr-btn-1', 'sei-agr-marca-ponto', 'Linkar protocolos') +
        acao('sei-agr-btn-2', 'sei-agr-marca-ponto', 'Importar Resolução')}
      <div class="sei-agr-area">${miolo}</div>
    </div>
  </div>
</div>`;

const msg = (tipo, titulo, linhas) =>
  `<div class="sei-agr-msg ${tipo}"><span class="sei-agr-msg-titulo">${titulo}</span>` +
  linhas.map((l) => `<span class="sei-agr-msg-corpo">${l}</span>`).join('') + '</div>';

const item = (n, sub) =>
  `<li><button type="button" class="sei-agr-item"><b>${n}</b><span>${sub}</span></button></li>`;

const cena = (titulo, conteudo, classe = '') =>
  `<div class="cena ${classe}"><h3>${titulo}</h3><div class="ck ck-reset_all ck-toolbar">${conteudo}</div></div>`;

const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<title>Banco de teste — painel SEI AGR</title>
<script>if(new URLSearchParams(location.search).has('stress'))document.documentElement.className='stress'</script>
<style>${css}
/* reset do CKEditor 5 (lark), verbatim — o vilao do bug de especificidade */
.ck.ck-reset_all,.ck.ck-reset_all *{word-wrap:break-word;background:transparent;border:0;margin:0;
padding:0;text-decoration:none;vertical-align:middle;transition:none;word-break:normal;
font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#333;line-height:1.4}
body{margin:0;padding:32px;background:#F1F3F0;font-family:system-ui,sans-serif;
display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start}
.cena{display:flex;flex-direction:column;gap:8px}
.cena>h3{margin:0;font:700 11px/1 system-ui;letter-spacing:.16em;text-transform:uppercase;color:#7A807A}
.toolbar{display:flex;align-items:center;width:660px;padding:5px 6px;box-sizing:border-box;
background:#FAFAFA;border:1px solid #CFCFCF;border-radius:3px}
.toolbar .falso{width:26px;height:26px;margin-right:3px;border-radius:3px;background:#E6E6E6;flex:none}
.paleta{display:flex;gap:0}
.paleta div{width:96px;height:64px;display:flex;align-items:flex-end;justify-content:center;
padding-bottom:5px;font:700 10px/1 system-ui;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.icones{display:flex;align-items:flex-end;gap:24px;min-height:148px;padding:0 18px 24px}
.icone-amostra{display:flex;flex-direction:column;align-items:center;gap:10px;color:#7A807A;
font:700 11px/1 system-ui}
.icone-amostra img{display:block}
/* congela as animacoes: a captura pegava o fade-in no meio e lavava as cores */
*{animation:none !important;transition:none !important}
.sei-agr-icone-confirmacao path{stroke-dashoffset:0 !important}
@media(max-width:600px){
body{display:block;padding:24px;background:#F1F3F0}
.cena:not(.mobile-validacao){display:none}
.mobile-validacao{width:100%;margin-bottom:28px}
.mobile-validacao>.ck-toolbar{width:100%}
.mobile-validacao #seiAgrMenu .sei-agr-menu-acoes{width:340px;max-width:340px}
}
html.stress body{display:block;padding:24px;background:#F1F3F0}
html.stress .cena:not(.ckeditor-stress){display:none}
html.stress .ckeditor-stress{display:flex;width:100%;margin-bottom:28px}
html.stress .ckeditor-stress>.ck-toolbar{width:100%}
html.stress #seiAgrMenu .sei-agr-menu-acoes{width:340px;max-width:340px}
</style></head><body>

<div class="cena"><h3>Marca em escala</h3><div class="icones">
${[128, 64, 32, 16].map((s) => `<div class="icone-amostra"><img src="icons/icon-${s}.png" width="${s}" height="${s}" alt=""><span>${s} px</span></div>`).join('')}
</div></div>

<div class="cena"><h3>Paleta oficial (amostrada dos logos)</h3><div class="paleta">
<div style="background:#007A4E">ação #007A4E</div><div style="background:#008C59">AGR #008C59</div><div style="background:#F9DA2A;color:#333;text-shadow:none">AGR #F9DA2A</div>
</div></div>

<div class="cena"><h3>Na toolbar do SEI (alinhado à direita)</h3>
<div class="toolbar ck ck-reset_all">${'<span class="falso"></span>'.repeat(12)}
<div id="seiAgrMenu" class="sei-agr-menu"><button type="button" class="sei-agr-menu-gatilho">${selo}<span class="sei-agr-menu-nome">SEI AGR</span></button></div></div></div>

${cena('Repouso', painel('<span class="sei-agr-area-vazia">Área de mensagens</span>'), 'mobile-validacao')}

${cena('Trabalhando', painel('<div class="sei-agr-msg"><span class="sei-agr-msg-titulo">Linkar protocolos</span><span class="sei-agr-msg-corpo">Consultando 5 números no SEI…</span></div>',
  acao('sei-agr-btn-1', 'sei-agr-marca-spin', 'Vinculando…', 'disabled') +
  acao('sei-agr-btn-2', 'sei-agr-marca-ponto', 'Importar Resolução')))}

${cena('Linkar — resultado', painel(msg('ok', 'Linkar protocolos', [
  '5 números tentados, 3 links aplicados.',
  'Vinculados: <strong class="sei-agr-num">202400006001234</strong>, <strong class="sei-agr-num">202400006005678</strong>, <strong class="sei-agr-num">80773781</strong>',
  'Sem correspondência no SEI: <strong class="sei-agr-num">99999999</strong>, <strong class="sei-agr-num">202300000000001</strong>',
]), acao('sei-agr-btn-1', 'sei-agr-marca-ok', '3 links aplicados') +
    acao('sei-agr-btn-2', 'sei-agr-marca-ponto', 'Importar Resolução')), 'mobile-validacao')}

${cena('Importar — busca e histórico', painel(
  '<div class="sei-agr-busca"><input value="202400006001234" placeholder="Número do processo">' +
  '<p class="sei-agr-busca-ajuda">Digite para buscar ou informe o número completo e pressione Enter.</p></div>' +
  `<ul class="sei-agr-lista">${item('202400006001234', 'Transportes Goiás Ltda · Auto 4471')}${
    item('202400006005678', 'Rodoviária União ME · Auto 4488')}${
    item('202400006009012', 'Expresso Araguaia S.A. · minuta-resolucao-final.pdf')}${
    item('202400006003344', 'Viação Serra Dourada Ltda ME · Auto 4502')}</ul>` +
  '<div class="sei-agr-msg" hidden></div>'), 'mobile-validacao')}

${cena('Importar — concluído', painel(msg('ok', 'Importar Resolução', [
  'Processo <strong class="sei-agr-num">202400006001234</strong>: 3 de 3 blocos preenchidos.',
  'Revise e use "Linkar protocolos" para os números. Ctrl+Z desfaz a importação inteira.',
])))}

${cena('Erro', painel(msg('erro', 'Não foi possível', [
  'Este documento não parece ser uma Resolução: não encontrei os blocos ementa / considerandos / RESOLVE: / artigos.',
])), 'mobile-validacao')}

${cena('CKEditor estreito — mensagem longa', painel(msg('', 'Linkar protocolos', [
  'Nenhum número de processo ou documento no texto.',
])), 'ckeditor-stress')}

${cena('CKEditor estreito — busca real', painel(
  '<div class="sei-agr-busca"><input value="202600005004586" placeholder="Número do processo">' +
  '<p class="sei-agr-busca-ajuda">Digite para buscar ou informe o número completo e pressione Enter.</p></div>' +
  `<ul class="sei-agr-lista">${item('202600029000633', 'VIAÇÃO PARAUNA LTDA · Auto 46188 · SEI_202600…')}${
    item('202600029000695', 'JUAREZ MENDES MELO LTDA · Auto 46193 · SEI_202600…')}${
    item('202600029000640', 'DELTA ONIBUS LTDA · Auto 46165 · SEI_2026002…')}${
    item('202600029001000', 'VIAÇÃO ESTRELA LTDA - EM RECUPERAÇÃO JUDICIAL')}</ul>` +
  '<div class="sei-agr-msg" hidden></div>'), 'ckeditor-stress')}

${cena('CKEditor estreito — resultado longo', painel(msg('erro', 'Linkar protocolos', [
  'Nenhum dos 4 números existe neste SEI.',
  'Tentados: <strong class="sei-agr-num">86976885</strong>, <strong class="sei-agr-num">202600029000695</strong>, <strong class="sei-agr-num">93773781</strong>, <strong class="sei-agr-num">202600029001000</strong>',
])), 'ckeditor-stress')}

</body></html>`;

const saidaHtml = path.join(__dirname, 'test-visual.html');
fs.writeFileSync(saidaHtml, html);

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (fs.existsSync(chrome)) {
  const png = path.join(__dirname, 'test-visual.png');
  const mobile = path.join(__dirname, 'test-visual-mobile.png');
  const ckeditor = path.join(__dirname, 'test-visual-ckeditor.png');
  for (const arquivo of [png, mobile, ckeditor]) {
    try { fs.unlinkSync(arquivo); } catch (e) {}
  }
  const url = 'file:///' + saidaHtml.replace(/\\/g, '/');
  const base = ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
    '--virtual-time-budget=3000'];
  execFileSync(chrome, [...base, '--window-size=1500,1500', '--screenshot=' + png, url], { stdio: 'ignore' });
  execFileSync(chrome, [...base, '--window-size=390,2600', '--screenshot=' + mobile, url], { stdio: 'ignore' });
  execFileSync(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--virtual-time-budget=3000', '--window-size=364,1800', '--screenshot=' + ckeditor, url + '?stress=1'], { stdio: 'ignore' });
  console.log('test-visual.png ' + (fs.statSync(png).size / 1024).toFixed(0) + ' KB');
  console.log('test-visual-mobile.png ' + (fs.statSync(mobile).size / 1024).toFixed(0) + ' KB');
  console.log('test-visual-ckeditor.png ' + (fs.statSync(ckeditor).size / 1024).toFixed(0) + ' KB');
}
console.log('ok — ' + css.length + ' bytes de CSS real, 0 seletores desblindados, 4 cores oficiais presentes');
