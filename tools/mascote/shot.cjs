// Tira um print de um HTML local com o Edge (uso: node tools/mascote/shot.cjs entrada.html saida.png [largura])
const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const [input, output, width = '1400'] = process.argv.slice(2);
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
  await page.goto('file:///' + path.resolve(input).replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: output, fullPage: true });
  await browser.close();
})();
