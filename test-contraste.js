// WCAG 2.1: luminancia relativa e razao de contraste dos pares REAIS do painel.
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const L = (h) => { const n = parseInt(h.slice(1), 16);
  return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
const r = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// [o que, frente, fundo, minimo]. Minimo 3.0 = elemento grafico/borda (WCAG 1.4.11);
// 4.5 = texto. O logotipo "SEI AGR" e isento (WCAG 1.4.3, excecao de logotipos).
const pares = [
  ['rotulo do botao primario',   '#FFFFFF', '#007A4E', 4.5],
  ['rotulo do botao em hover',   '#FFFFFF', '#00663F', 4.5],
  ['rotulo do botao ocupado',    '#FFFFFF', '#00663F', 4.5],
  ['rotulo do gatilho',          '#FFFFFF', '#007A4E', 4.5],
  ['foco do gatilho',            '#1C231E', '#FAFAFA', 3.0],
  ['rotulo do botao secundario', '#00754A', '#FFFFFF', 4.5],
  ['borda do botao secundario',  '#00754A', '#FFFFFF', 3.0],
  ['borda do campo de busca',    '#858B85', '#FFFFFF', 3.0],
  ['titulo da mensagem',         '#00754A', '#EFF8F3', 4.5],
  ['corpo da mensagem',          '#39423C', '#EFF8F3', 4.5],
  ['numero em destaque',         '#1C231E', '#EFF8F3', 4.5],
  ['titulo de erro',             '#B3261E', '#FDF3F2', 4.5],
  ['corpo de erro',              '#39423C', '#FDF3F2', 4.5],
  ['texto de apoio / vazio',     '#6E756E', '#FFFFFF', 4.5],
  ['subtitulo do item da lista', '#6E756E', '#FFFFFF', 4.5],
  ['numero do item da lista',    '#1C231E', '#FFFFFF', 4.5],
  ['botao secundario desabil.',  '#6E756E', '#FFFFFF', 4.5],
  ['borda da mensagem (marca)',  '#008C59', '#EFF8F3', 3.0],
  ['ponto do botao (amarelo)',   '#F9DA2A', '#007A4E', 3.0],
];
let falhas = 0;
for (const [nome, fg, bg, min] of pares) {
  const v = r(fg, bg), ok = v >= min;
  if (!ok) falhas++;
  console.log((ok ? 'OK  ' : 'RUIM') + '  ' + v.toFixed(2).padStart(5) + ':1  (min ' + min.toFixed(1) + ')  ' + nome);
}
// Isentos: o lockup da marca, como o design especifica. WCAG 1.4.3 exclui
// logotipos, e 1.4.11 so alcanca grafico necessario a compreensao — o selo e
// aria-hidden e o botao ja diz "SEI AGR" por escrito. Medidos so para nao
// passarem despercebidos. O selo e branco a 16% sobre o verde: composto #298F6A.
console.log('\nisentos (lockup da marca, conforme o design):');
console.log('  "AGR" ouro sobre o cabecalho ... ' + r('#F9DA2A', '#007A4E').toFixed(2) + ':1');
console.log('  selo vazado sobre o verde ...... ' + r('#298F6A', '#007A4E').toFixed(2) + ':1');
console.log(falhas ? '\n' + falhas + ' par(es) reprovado(s)' : '\ntodos os ' + pares.length + ' pares passam');
process.exit(falhas ? 1 : 0);
