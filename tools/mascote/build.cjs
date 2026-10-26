// Monta a página final: sprites e imagens de referência entram no template (uso: node build.cjs)
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const html = read('template.html')
  .replace('/*SPRITES*/', read('sprites.json'))
  .replace('/*REF_NATAL*/', read('ref-fofodeck-natal.txt').trim())
  .replace('/*REF*/', read('ref-fofodeck.txt').trim());
fs.writeFileSync(path.join(dir, 'mascote-fofolab.html'), html);
console.log('ok', Math.round(html.length / 1024) + ' KB');
