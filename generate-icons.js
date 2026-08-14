// Rasteriza os SVGs da marca nos quatro tamanhos usados pelo Chrome.
// Rodar: node generate-icons.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!fs.existsSync(chrome)) throw new Error('Google Chrome não encontrado em ' + chrome);

for (const size of [16, 32, 64, 128]) {
  const svg = path.join(__dirname, 'icons', `icon-${size}.svg`);
  const png = path.join(__dirname, 'icons', `icon-${size}.png`);
  try { fs.unlinkSync(png); } catch (e) {}
  execFileSync(chrome, [
    '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', `--window-size=${size},${size}`,
    '--screenshot=' + png, 'file:///' + svg.replace(/\\/g, '/'),
  ], { stdio: 'ignore' });
  const bytes = fs.statSync(png).size;
  if (bytes < 100) throw new Error(`PNG ${size}px parece inválido`);
  console.log(`icon-${size}.png ${bytes} bytes`);
}
