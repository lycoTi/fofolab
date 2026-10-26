// Confere a página em 375 px: rolagem horizontal e print do topo
const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage({ viewport: { width: 375, height: 900 } });
  await p.goto('file:///' + path.join(__dirname, 'mascote-fofolab.html').split(path.sep).join('/'));
  await p.waitForTimeout(300);
  console.log('scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth));
  await p.screenshot({ path: path.join(__dirname, 'look-mobile.png'), clip: { x: 0, y: 0, width: 375, height: 1100 }, fullPage: true });
  await b.close();
})();
