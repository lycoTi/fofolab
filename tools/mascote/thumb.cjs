// Reduz a imagem de referência para embutir na página (uso: node thumb.cjs entrada.png saida.txt lado [x y lado-do-recorte])
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const [input, output, side, cx, cy, cs] = process.argv.slice(2);
  const b64 = fs.readFileSync(input).toString('base64');
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();
  const data = await page.evaluate(async ([src, n, crop]) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    const [sx, sy, sw, sh] = crop || [0, 0, img.width, img.height];
    c.width = n; c.height = Math.round((sh / sw) * n);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }, ['data:image/png;base64,' + b64, Number(side), cs ? [Number(cx), Number(cy), Number(cs), Number(cs)] : null]);
  fs.writeFileSync(output, data);
  await browser.close();
})();
