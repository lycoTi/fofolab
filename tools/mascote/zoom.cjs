// Página com alguns sprites ampliados 10x, lado a lado (uso: node tools/mascote/zoom.cjs id1 id2 ...)
const fs = require('fs');
const path = require('path');
const ids = process.argv.slice(2);
const all = JSON.parse(fs.readFileSync(path.join(__dirname, 'sprites.json'), 'utf8'));
const svg = (s) => {
  let rects = '';
  s.A.forEach((row, y) => { for (let x = 0; x < 32; x++) { const c = row[x]; if (c === '.') continue; let n = 1; while (row[x + n] === c) n++; rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${s.palette[c]}"/>`; x += n - 1; } });
  return `<svg width="320" height="320" viewBox="0 0 32 32" shape-rendering="crispEdges">${rects}</svg>`;
};
const html = `<body style="background:#020617;margin:0;padding:12px;display:flex;gap:12px;flex-wrap:wrap">${ids.map((id) => svg(all.find((s) => s.id === id))).join('')}</body>`;
fs.writeFileSync(path.join(__dirname, 'zoom.html'), html);
