// Ícone de 16 px do Fofo (só a cabeça com o fone): desenho próprio, porque o Fofo inteiro em 16 px vira borrão.
// Saídas: public/favicon-fofolab.svg (favicon pixel a pixel) e tools/mascote/icone-1024.png (fonte dos ícones do app
// de desktop: `npx tauri icon tools/mascote/icone-1024.png`, ampliado 64× sem suavização).
// Uso: node tools/mascote/icon.cjs
const fs = require('fs');
const path = require('path');

const S = 16;
const blank = () => Array.from({ length: S }, () => Array(S).fill('.'));
const inEl = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
function fillEl(g, cx, cy, rx, ry, ch, onlyOn) {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (inEl(x, y, cx, cy, rx, ry) && (!onlyOn || onlyOn.includes(g[y][x]))) g[y][x] = ch;
}
const px = (g, list, ch) => list.forEach(([x, y]) => { if (g[y] && g[y][x] !== undefined) g[y][x] = ch; });
function outline(g) {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (g[y][x] !== '.') continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] && g[y + dy][x + dx] !== '.')) out[y][x] = 'o';
  }
  return out;
}
const over = (base, top) => base.map((r, y) => r.map((c, x) => (top[y][x] !== '.' ? top[y][x] : c)));

// 1) Cabeça, orelhas, sombra e focinho
const head = blank();
fillEl(head, 8, 9.8, 6.2, 5.2, 'f');
fillEl(head, 3.9, 4.2, 1.8, 1.8, 'f');
fillEl(head, 12.1, 4.2, 1.8, 1.8, 'f');
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (head[y][x] === 'f' && (x - 8) * 0.4 + (y - 9.8) * 0.9 > 3) head[y][x] = 'F';
px(head, [[3, 4], [4, 4], [11, 4], [12, 4]], 'E');
fillEl(head, 8, 12, 2.8, 1.8, 'c', ['f', 'F']);
let g = outline(head);
// 2) Rosto: olhos com brilho, nariz e bochechas
px(g, [[5, 9], [10, 9]], 'e');
px(g, [[5, 8], [10, 8]], 'w');
px(g, [[7, 11], [8, 11]], 'e');
px(g, [[4, 11], [11, 11]], 'b');
// 3) Fone: arco por cima da cabeça (atrás das orelhas) e as conchas dos lados
const phones = blank();
fillEl(phones, 8, 7.6, 7.6, 5.8, 'K');
fillEl(phones, 8, 7.6, 6.2, 4.6, '.', ['K']);
for (let y = 8; y < S; y++) for (let x = 0; x < S; x++) phones[y][x] = '.';
for (let y = 8; y <= 12; y++) { phones[y][1] = 'K'; phones[y][14] = 'K'; phones[y][2] = 'j'; phones[y][13] = 'j'; }
px(phones, [[1, 8], [14, 8]], 'u');
const withPhones = over(g, outline(phones));
// As orelhas ficam na frente do arco, como no Fofo grande
g = withPhones.map((r, y) => r.map((c, x) => (head[y][x] !== '.' && y <= 5 && (x <= 5 || x >= 10) ? g[y][x] : c)));

const palette = {
  o: '#3a2116', f: '#e8893a', F: '#b45e28', c: '#fbe7cb', e: '#1b100b', w: '#ffffff', b: '#f2876b', E: '#d2632b',
  K: '#5b616c', u: '#858c98', j: '#3a3e47',
};
console.log(g.map((r) => r.join('')).join('\n'));

// 4) Favicon SVG: pixel a pixel (sem imagem embutida)
let rects = '';
g.forEach((row, y) => {
  for (let x = 0; x < S; x++) {
    const c = row[x];
    if (c === '.') continue;
    let n = 1;
    while (row[x + n] === c) n++;
    rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${palette[c]}"/>`;
    x += n - 1;
  }
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges">${rects}</svg>\n`;
const root = path.join(__dirname, '../..');
fs.writeFileSync(path.join(root, 'public/favicon-fofolab.svg'), svg);

// 5) PNG de 1024 px pelo Edge (canvas sem suavização), para o `tauri icon`
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();
  const data = await page.evaluate(([grid, pal]) => {
    const scale = 64;
    const canvas = document.createElement('canvas');
    canvas.width = 16 * scale;
    canvas.height = 16 * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    grid.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '.') return;
      ctx.fillStyle = pal[c];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }));
    return canvas.toDataURL('image/png');
  }, [g.map((r) => r.join('')), palette]);
  fs.writeFileSync(path.join(__dirname, 'icone-1024.png'), Buffer.from(data.split(',')[1], 'base64'));
  await browser.close();
  console.log('ok: public/favicon-fofolab.svg e tools/mascote/icone-1024.png');
})();
