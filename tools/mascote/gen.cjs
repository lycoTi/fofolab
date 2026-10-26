// Gerador dos sprites 32×32 do Fofo (base e roupas), desenhados pixel a pixel em grades de caracteres.
// Saída: sprites.json (quadros A e B + olhos fechados de cada roupa) e preview.html (conferência rápida).
// Regras de desenho e de uso: .agents/rules/identidade-fofolab.md
const fs = require('fs');
const path = require('path');
const W = 32, H = 32;
const blank = () => Array.from({ length: H }, () => Array(W).fill('.'));
const clone = (g) => g.map((r) => r.slice());
const inEl = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
function fillEl(g, cx, cy, rx, ry, ch, onlyOn) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (inEl(x, y, cx, cy, rx, ry) && (!onlyOn || onlyOn.includes(g[y][x]))) g[y][x] = ch;
}
function fillRect(g, x0, y0, x1, y1, ch, onlyOn) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
    if (g[y] && g[y][x] !== undefined && (!onlyOn || onlyOn.includes(g[y][x]))) g[y][x] = ch;
}
const px = (g, list, ch) => list.forEach(([x, y]) => { if (g[y] && g[y][x] !== undefined) g[y][x] = ch; });
function outline(g, ch = 'o') {
  const out = clone(g);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== '.') continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const v = g[y + dy] && g[y + dy][x + dx];
      return v && v !== '.' && v !== ch;
    });
    if (near) out[y][x] = ch;
  }
  return out;
}
const over = (base, top) => base.map((r, y) => r.map((c, x) => (top[y][x] !== '.' ? top[y][x] : c)));
const under = (base, glow) => base.map((r, y) => r.map((c, x) => (c === '.' ? glow[y][x] : c)));
const mapCells = (g, fn) => g.map((r, y) => r.map((c, x) => fn(c, x, y)));

// 1) Corpo do hamster: silhueta (corpo + bochechas + orelhas), sombra, creme, contorno
function hamsterBody({ ears = true } = {}) {
  const g = blank();
  fillEl(g, 16, 19.5, 10, 9.5, 'f');
  fillEl(g, 7.4, 18, 3.1, 2.7, 'f');
  fillEl(g, 24.6, 18, 3.1, 2.7, 'f');
  if (ears) { fillEl(g, 9, 10.6, 2.4, 2.3, 'f'); fillEl(g, 23, 10.6, 2.4, 2.3, 'f'); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== 'f') continue;
    const nx = (x + 0.5 - 16) / 10, ny = (y + 0.5 - 19.5) / 9.5;
    const d = nx * 0.4 + ny * 0.92;
    if (d > 0.6) g[y][x] = 'F';
    else if (d < -0.58) g[y][x] = 'h';
  }
  fillEl(g, 16, 23.4, 6.6, 6, 'c', ['f', 'F', 'h']);
  fillRect(g, 13, 18, 18, 19, 'c', ['f', 'F', 'h']);
  fillEl(g, 7.9, 19.4, 2.3, 1.2, 'c', ['f', 'F', 'h']);
  fillEl(g, 24.1, 19.4, 2.3, 1.2, 'c', ['f', 'F', 'h']);
  fillEl(g, 16, 17.6, 3.3, 2, 'c', ['f', 'F', 'h']);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (g[y][x] === 'c' && (y >= 28 || (y >= 26 && x >= 19) || (y >= 19 && x >= 21 && y <= 20) || (y >= 19 && x >= 25))) g[y][x] = 'C';
  if (ears) px(g, [[8, 10], [9, 10], [22, 10], [23, 10], [8, 11], [23, 11]], 'E');
  fillEl(g, 11.4, 28.7, 2.6, 1.4, 'k');
  fillEl(g, 20.6, 28.7, 2.6, 1.4, 'k');
  return outline(g);
}
function face(g, { blush = true } = {}) {
  px(g, [[11, 14], [19, 14]], 'w');
  px(g, [[12, 14], [11, 15], [12, 15], [20, 14], [19, 15], [20, 15]], 'e');
  px(g, [[11, 12], [12, 12], [19, 12], [20, 12]], 'm');
  px(g, [[15, 16], [16, 16]], 'e');
  px(g, [[14, 17], [17, 17]], 'm');
  px(g, [[15, 18], [16, 18]], 'p');
  if (blush) px(g, [[9, 16], [10, 16], [21, 16], [22, 16]], 'b');
  return g;
}
// Olhos fechados: a fileira de cima volta ao pelo e a de baixo vira um traço
function blinkOverlay(sprite, furSource, tallEyes = false) {
  const o = blank();
  const upper = tallEyes ? [[11, 13], [12, 13], [19, 13], [20, 13]] : [];
  [...upper, [11, 14], [12, 14], [19, 14], [20, 14]].forEach(([x, y]) => { o[y][x] = furSource[y][x]; });
  [[11, 15], [12, 15], [19, 15], [20, 15]].forEach(([x, y]) => { o[y][x] = 'e'; });
  return o;
}
function headphones(g, body) {
  const hp = blank();
  fillEl(hp, 16, 12.6, 11, 6.2, 'K');
  fillEl(hp, 16, 12.6, 9.3, 4.7, '.', ['K']);
  fillRect(hp, 0, 13, 31, 31, '.');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (hp[y][x] === 'K' && y <= 7) hp[y][x] = 'u';
  fillEl(hp, 5.1, 14.6, 2.2, 3, 'K');
  fillEl(hp, 26.9, 14.6, 2.2, 3, 'K');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (hp[y][x] !== 'K' || y < 12) continue;
    if (x === 6 || x === 25) hp[y][x] = 'j';
    else if ((x === 4 || x === 26) && y <= 14) hp[y][x] = 'u';
  }
  const hpLayer = outline(hp);
  let out = over(g, hpLayer);
  // As orelhas ficam na frente do arco, como no desenho do FofoDeck; só onde o arco passou, para não apagar a sobrancelha
  out = out.map((r, y) => r.map((c, x) => {
    const nearEar = [[9, 10.6], [23, 10.6]].some(([ex, ey]) => Math.hypot(x + 0.5 - ex, y + 0.5 - ey) <= 3.5);
    return nearEar && y <= 12 && body[y][x] !== '.' && hpLayer[y][x] !== '.' ? g[y][x] : c;
  }));
  return out;
}
function glowLayer(cx, cy, r1, r2) {
  const g = blank();
  fillEl(g, cx, cy, r2, r2, 'q');
  fillEl(g, cx, cy, r1, r1, 'g');
  return g;
}

const DIGITS = { 2: ['###', '..#', '###', '#..', '###'], 5: ['###', '#..', '###', '..#', '###'] };
function fofodeck(frame) {
  const body = hamsterBody();
  const furBeforeFace = clone(body);
  let g = clone(body);
  face(g);
  g = headphones(g, body);
  const clock = blank();
  fillRect(clock, 19, 21, 29, 28, 'A');
  fillRect(clock, 20, 22, 28, 27, 'D');
  fillRect(clock, 29, 21, 29, 28, 'a');
  fillRect(clock, 19, 28, 29, 28, 'a');
  [['2', 21], ['5', 25]].forEach(([d, x0]) => DIGITS[d].forEach((row, dy) => [...row].forEach((c, dx) => { if (c === '#') clock[22 + dy][x0 + dx] = frame === 'B' && d === '5' && dy === 4 && dx === 0 ? 'D' : 'Y'; })));
  fillRect(clock, 23, 20, 25, 20, 'K');
  g = over(g, outline(clock));
  g = grip(g, 29.8, 24.5, [[28, 23], [28, 25]]);
  const note = blank();
  const up = frame === 'B' ? 1 : 0;
  px(note, [[28, 3 - up], [28, 4 - up], [28, 5 - up], [28, 6 - up], [27, 7 - up], [28, 7 - up], [27, 8 - up], [26, 8 - up], [26, 7 - up], [29, 3 - up], [30, 4 - up], [30, 5 - up]], 'Y');
  g = over(g, note);
  return { grid: g, fur: furBeforeFace };
}

// 2) Direção 1: fazendeiro (chapéu de palha e muda no vaso)
function farmer(frame) {
  const body = hamsterBody();
  const furBeforeFace = clone(body);
  let g = clone(body);
  face(g);
  g = headphones(g, body);
  const hat = blank();
  fillEl(hat, 16, 6.6, 6, 4.4, 'H');
  fillRect(hat, 0, 7, 31, 31, '.');
  fillEl(hat, 16, 8.1, 11.6, 1.7, 'H');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (hat[y][x] !== 'H') continue;
    if (y === 6 && x >= 10 && x <= 21) hat[y][x] = 'G';
    else if (y === 8 || (y < 6 && x >= 19)) hat[y][x] = 'J';
    else if ((y < 6 && x <= 12) || (y === 7 && x <= 9)) hat[y][x] = 'I';
  }
  g = over(g, outline(hat));
  const sway = frame === 'B' ? 1 : 0;
  const plant = blank();
  fillRect(plant, 15, 20, 15, 22, 'l');
  fillEl(plant, 13.4 - sway * 0.6, 20.3, 2, 1.15, 'L');
  fillEl(plant, 17.7 + sway * 0.4, 19.6 - sway * 0.4, 1.7, 1.05, 'L');
  px(plant, [[12, 20], [17, 19]], 'I');
  const pot = blank();
  fillRect(pot, 11, 23, 20, 24, 't');
  fillRect(pot, 12, 25, 19, 26, 't');
  fillRect(pot, 12, 23, 19, 23, 'd');
  fillRect(pot, 18, 25, 19, 26, 'T');
  fillRect(pot, 19, 24, 20, 24, 'T');
  const paws = blank();
  fillEl(paws, 10.6, 24.6, 1.5, 1.2, 'k');
  fillEl(paws, 21.4, 24.6, 1.5, 1.2, 'k');
  g = over(g, outline(plant));
  g = over(g, outline(pot));
  g = over(g, outline(paws));
  return { grid: g, fur: furBeforeFace };
}

// 3) Direção 2: explorador (mochila com saco de dormir, lenço e lanterna)
function explorer(frame) {
  const back = blank();
  fillRect(back, 19, 9, 27, 18, 'P');
  fillRect(back, 26, 10, 27, 18, 'Q');
  fillRect(back, 19, 12, 25, 12, 'Q');
  px(back, [[22, 13], [22, 14]], 'Y');
  fillEl(back, 23.5, 7.4, 5.6, 1.9, 'R');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (back[y][x] === 'R' && y >= 8) back[y][x] = 'r';
  px(back, [[20, 6], [20, 7], [20, 8], [26, 6], [26, 7], [26, 8]], 'Q');
  let g = outline(back);
  const body = hamsterBody();
  const furBeforeFace = clone(body);
  const faced = clone(body);
  face(faced);
  g = headphones(over(g, faced), over(blank(), body));
  const scarf = blank();
  fillRect(scarf, 11, 20, 20, 20, 'S');
  fillRect(scarf, 13, 21, 18, 21, 'S');
  fillRect(scarf, 14, 22, 17, 22, 's');
  fillRect(scarf, 15, 23, 16, 23, 's');
  px(scarf, [[19, 20], [20, 20]], 's');
  g = over(g, outline(scarf));
  // Lanterna pendurada do lado esquerdo, segura pela alça
  const lamp = blank();
  fillRect(lamp, 2, 23, 6, 23, 'X');
  fillRect(lamp, 2, 24, 6, 27, 'Y');
  fillRect(lamp, 2, 28, 6, 28, 'X');
  fillRect(lamp, 6, 24, 6, 27, 'x');
  px(lamp, [[3, 22], [4, 21], [5, 22]], 'x');
  if (frame === 'B') px(lamp, [[4, 25], [4, 26]], 'Z');
  else px(lamp, [[4, 24], [4, 25], [4, 26], [3, 26]], 'Z');
  g = over(g, outline(lamp));
  g = grip(g, 4.5, 20.4, [], 1.4, 1.1);
  g = under(g, frame === 'B' ? glowLayer(4.5, 25.5, 4.2, 6) : glowLayer(4.5, 25.5, 4.8, 6.8));
  return { grid: g, fur: furBeforeFace };
}

// 4) Direção 3: estudante da madrugada (capuz, óculos redondos, livro e vela)
function night(frame) {
  const cloak = blank();
  fillEl(cloak, 16, 21, 12, 10.2, 'N');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (cloak[y][x] === 'N' && (x >= 22 || y >= 28)) cloak[y][x] = 'n';
  let g = outline(cloak);
  const body = hamsterBody({ ears: false });
  const furBeforeFace = clone(body);
  face(body, { blush: true });
  g = over(g, body);
  const hood = blank();
  fillEl(hood, 16, 13.2, 11, 7, 'N');
  fillEl(hood, 9, 8.4, 2.3, 2.3, 'N');
  fillEl(hood, 23, 8.4, 2.3, 2.3, 'N');
  fillEl(hood, 16, 17.4, 8.6, 6.1, '.', ['N']);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (hood[y][x] !== 'N') continue;
    if (x <= 11 && y <= 10) hood[y][x] = 'M';
    else if (x >= 21) hood[y][x] = 'n';
  }
  g = over(g, outline(hood));
  g = headphones(g, blank());
  const ring = [[11, 13], [12, 13], [10, 14], [13, 14], [10, 15], [13, 15], [11, 16], [12, 16]];
  px(g, ring, 'y');
  px(g, ring.map(([x, y]) => [x + 8, y]), 'y');
  px(g, [[14, 14], [15, 14], [16, 14], [17, 14]], 'y');
  const book = blank();
  fillRect(book, 8, 22, 23, 27, 'B');
  fillRect(book, 19, 23, 23, 27, 'v');
  fillRect(book, 9, 22, 14, 25, 'W');
  fillRect(book, 17, 22, 22, 25, 'W');
  fillRect(book, 15, 22, 16, 26, 'v');
  px(book, [[8, 22], [23, 22]], '.');
  [[10, 23], [11, 23], [12, 23], [13, 23], [10, 24], [11, 24], [12, 24], [18, 23], [19, 23], [20, 23], [21, 23], [18, 24], [19, 24]].forEach(([x, y]) => { book[y][x] = 'V'; });
  const paws = blank();
  fillEl(paws, 8.4, 24.6, 1.4, 1.2, 'k');
  fillEl(paws, 23.6, 24.6, 1.4, 1.2, 'k');
  g = over(g, outline(book));
  g = over(g, outline(paws));
  const candle = blank();
  fillRect(candle, 2, 24, 4, 29, 'A');
  fillRect(candle, 4, 24, 4, 29, 'a');
  px(candle, [[3, 23]], 'e');
  if (frame === 'B') { px(candle, [[3, 22], [3, 21]], 'Y'); px(candle, [[3, 20]], 'O'); }
  else { px(candle, [[3, 22]], 'Z'); px(candle, [[2, 21], [4, 21]], 'O'); px(candle, [[3, 21], [3, 20]], 'Y'); px(candle, [[3, 19]], 'O'); }
  g = over(g, outline(candle));
  g = under(g, frame === 'B' ? glowLayer(3.5, 21.5, 3.6, 5.4) : glowLayer(3.5, 21, 4.2, 6.2));
  return { grid: g, fur: furBeforeFace };
}

// 5) Natal: gorro de Papai Noel, cachecol listrado, nariz azul e presente, como o FofoDeck de Natal.
// O gorro vai por cima do arco do fone: em 32 px o arco sobre o gorro vira um capacete.
function christmas(frame) {
  const body = hamsterBody();
  const furBeforeFace = clone(body);
  let g = clone(body);
  face(g);
  px(g, [[15, 16]], 'n');
  px(g, [[16, 16]], 'N');
  g = headphones(g, body);
  const hat = blank();
  fillEl(hat, 17, 9, 8, 7.4, 'R');
  fillRect(hat, 0, 9, 31, 31, '.');
  fillEl(hat, 11.2, 3.3, 3.4, 1.8, 'R');
  fillEl(hat, 7.6, 4.4, 2.2, 1.5, 'R');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (hat[y][x] !== 'R') continue;
    if (x >= 21 || (y >= 7 && x >= 19)) hat[y][x] = 'r';
    else if (y <= 3 && x >= 12 && x <= 17) hat[y][x] = 'U';
  }
  fillEl(hat, 16, 9.2, 9.6, 1.7, 'Z');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (hat[y][x] === 'Z' && (y === 10 || x >= 22)) hat[y][x] = 'z';
  const sway = frame === 'B' ? 1 : 0;
  fillEl(hat, 4.4 - sway * 0.6, 6.2 + sway * 0.6, 2, 2, 'Z');
  px(hat, [[3 - sway, 7 + sway], [4 - sway, 7 + sway], [5 - sway, 7 + sway]], 'z');
  g = over(g, outline(hat));
  const scarf = blank();
  for (let x = 8; x <= 23; x++) {
    const top = Math.abs(x + 0.5 - 16) < 5 ? 20 : 19;
    const red = Math.floor((x - 8) / 2) % 2 === 0;
    scarf[top][x] = red ? 'S' : 'L';
    scarf[top + 1][x] = red ? 's' : 'l';
  }
  for (let y = 21; y <= 26; y++) for (let x = 7; x <= 9; x++) scarf[y][x] = Math.floor((y - 21) / 2) % 2 === 0 ? 'L' : 'S';
  for (let y = 21; y <= 26; y++) scarf[y][9] = scarf[y][9] === 'L' ? 'l' : 's';
  px(scarf, [[7, 27], [9, 27]], 'l');
  g = over(g, outline(scarf));
  const gift = blank();
  fillRect(gift, 13, 25, 19, 27, 'D');
  fillRect(gift, 19, 25, 19, 27, 'd');
  fillRect(gift, 13, 27, 19, 27, 'd');
  fillRect(gift, 12, 24, 20, 24, 'S');
  fillRect(gift, 16, 25, 16, 27, 'S');
  px(gift, [[14, 23], [15, 22], [17, 22], [18, 23]], 'S');
  px(gift, [[15, 23], [16, 23], [17, 23]], 's');
  const paws = blank();
  fillEl(paws, 11.6, 25.4, 1.4, 1.2, 'k');
  fillEl(paws, 21.4, 25.4, 1.4, 1.2, 'k');
  g = over(g, outline(gift));
  g = over(g, outline(paws));
  const snow = blank();
  const fall = frame === 'B' ? 1 : 0;
  px(snow, [[27, 2], [30, 9], [1, 15], [29, 23], [2, 25], [23, 0], [3, 1]].map(([x, y]) => [x, y + fall]), 'v');
  g = under(g, snow);
  return { grid: g, fur: furBeforeFace };
}

// 6) Halloween: fantasminha de lençol no formato do hamster (orelhas e bochechas), fone por cima e balde de abóbora
function halloween(frame) {
  const sheet = blank();
  fillEl(sheet, 16, 19.5, 10, 9.5, 'Z');
  fillEl(sheet, 7.4, 18, 3.1, 2.7, 'Z');
  fillEl(sheet, 24.6, 18, 3.1, 2.7, 'Z');
  fillEl(sheet, 9, 10.6, 2.4, 2.3, 'Z');
  fillEl(sheet, 23, 10.6, 2.4, 2.3, 'Z');
  fillEl(sheet, 16, 26.2, 11.2, 2.8, 'Z');
  const phase = frame === 'B' ? 2 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (sheet[y][x] !== 'Z') continue;
    const hem = Math.floor((x + phase) / 2) % 2 === 0 ? 28 : 26;
    if (y > hem) { sheet[y][x] = '.'; continue; }
    const nx = (x + 0.5 - 16) / 10, ny = (y + 0.5 - 19.5) / 9.5;
    if (nx * 0.4 + ny * 0.92 > 0.55) sheet[y][x] = 'z';
  }
  // Dobras do lençol subindo da barra
  px(sheet, [[12, 24], [12, 25], [13, 26], [19, 23], [19, 24], [20, 25]].filter(([x, y]) => sheet[y][x] !== '.'), 'z');
  const furBeforeFace = clone(sheet);
  const feet = blank();
  fillEl(feet, 11.4, 29.3, 2.4, 1.2, 'k');
  fillEl(feet, 20.6, 29.3, 2.4, 1.2, 'k');
  let g = over(outline(feet), outline(sheet));
  // Olhos de fantasma: buracos de 2×3 no lençol, com um brilho para continuar fofo
  px(g, [[11, 13], [19, 13]], 'w');
  px(g, [[12, 13], [11, 14], [12, 14], [11, 15], [12, 15], [20, 13], [19, 14], [20, 14], [19, 15], [20, 15]], 'e');
  px(g, [[9, 16], [10, 16], [21, 16], [22, 16]], 'b');
  px(g, [[15, 17], [16, 17], [15, 18], [16, 18]], 'e');
  g = headphones(g, outline(sheet));
  const pk = blank();
  fillEl(pk, 24.5, 25.2, 4.6, 3.4, 'P');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pk[y][x] === 'P' && (x === 22 || x >= 27)) pk[y][x] = 'Q';
  const lit = frame === 'B' ? 'O' : 'Y';
  px(pk, [[22, 24], [23, 24], [23, 23], [26, 24], [27, 24], [26, 23]], lit);
  px(pk, [[22, 26], [24, 26], [25, 26], [27, 26], [23, 27], [26, 27]], lit);
  px(pk, [[24, 21], [25, 21], [25, 20]], 'G');
  const handle = blank();
  px(handle, [[20, 22], [20, 21], [21, 20], [22, 19], [23, 19], [26, 19], [27, 19], [28, 20], [29, 21], [29, 22]], 'K');
  g = over(g, handle);
  g = over(g, outline(pk));
  g = grip(g, 24.5, 19.2, [], 1.4, 1.1);
  // Morcego no canto, batendo as asas entre os quadros
  const BAT = frame === 'B'
    ? ['....x.x....', '...xYxYx...', '.xxxxxxxxx.', 'xxx.xxx.xxx', 'x....x....x']
    : ['xx.......xx', 'xxx.x.x.xxx', '.xxxYxYxxx.', '...xxxxx...', '....x.x....'];
  const bat = blank();
  BAT.forEach((row, dy) => [...row].forEach((c, dx) => { if (c !== '.') bat[1 + dy][dx] = c; }));
  g = under(g, bat);
  return { grid: g, fur: furBeforeFace };
}

// Desenho em texto (linhas de caracteres) a partir de (x0, y0); '.' é transparente
function stamp(g, rows, x0, y0) {
  rows.forEach((row, dy) => [...row].forEach((c, dx) => {
    if (c !== '.' && g[y0 + dy] && g[y0 + dy][x0 + dx] !== undefined) g[y0 + dy][x0 + dx] = c;
  }));
}
// Explosão de fogos: 8 pontas na distância r e o miolo branco
function burst(g, cx, cy, r, ch) {
  const d = Math.max(1, Math.round(r * 0.7));
  px(g, [[cx + r, cy], [cx - r, cy], [cx, cy + r], [cx, cy - r], [cx + d, cy + d], [cx - d, cy - d], [cx + d, cy - d], [cx - d, cy + d]], ch);
  px(g, [[cx, cy]], 'W');
}
function dressedBase() {
  const body = hamsterBody();
  const fur = clone(body);
  const g = face(clone(body));
  return { body, fur, g };
}

// 7) Ano-novo: chapéu de festa listrado, estrelinha acesa na mão e fogos no céu (sem o ano escrito: não envelhece)
function newYear(frame) {
  const { body, fur, g: faced } = dressedBase();
  let g = headphones(faced, body);
  const hat = blank();
  for (let y = 1; y <= 9; y++) {
    const half = (y - 1) * 0.62;
    const cx = 16.5 + (9 - y) * 0.22;
    for (let x = 0; x < W; x++) {
      if (Math.abs(x + 0.5 - cx) > half + 0.5) continue;
      const gold = Math.floor((y - 1) / 2) % 2 === 0;
      const shade = x + 0.5 > cx + half * 0.35;
      if (gold) hat[y][x] = shade ? 'D' : 'Y';
      else hat[y][x] = shade ? 'z' : 'Z';
    }
  }
  fillEl(hat, 18.6, 0.8, 1.4, 1.2, 'W');
  g = over(g, outline(hat));
  const stick = blank();
  px(stick, [[22, 25], [23, 24], [23, 23], [24, 22], [25, 21], [25, 20], [26, 19]], 'u');
  g = over(g, stick);
  const paw = blank();
  fillEl(paw, 22.4, 24.4, 1.4, 1.2, 'k');
  g = over(g, outline(paw));
  const sparks = blank();
  px(sparks, [[27, 18]], 'W');
  if (frame === 'B') { px(sparks, [[26, 17], [28, 19], [28, 17], [26, 19]], 'Y'); px(sparks, [[27, 15], [30, 18], [24, 16], [30, 15]], 'W'); }
  else { px(sparks, [[25, 18], [29, 18], [27, 16], [27, 20]], 'Y'); px(sparks, [[29, 15], [25, 15], [30, 20], [24, 17]], 'W'); }
  g = over(g, sparks);
  const sky = blank();
  if (frame === 'B') { burst(sky, 4, 4, 1, 'P'); burst(sky, 27, 4, 3, 'T'); }
  else { burst(sky, 4, 4, 3, 'P'); burst(sky, 27, 4, 1, 'T'); }
  g = under(g, sky);
  return { grid: g, fur };
}

// 8) Festa junina: chapéu de palha remendado e desfiado, sardas, lenço xadrez, milho na mão e bandeirinhas
function junina(frame) {
  const { body, fur, g: faced } = dressedBase();
  px(faced, [[9, 15], [10, 17], [22, 15], [21, 17]], 'm');
  let g = headphones(faced, body);
  const flags = blank();
  const COLORS = ['R', 'Y', 'B', 'L'];
  [0, 5, 23, 28].forEach((x0, i) => {
    const drop = frame === 'B' && i % 2 === 1 ? 1 : 0;
    const top = 2 + drop;
    px(flags, [[x0, top], [x0 + 1, top], [x0 + 2, top]], COLORS[i]);
    px(flags, [[x0 + 1, top + 1]], COLORS[i]);
  });
  for (let x = 0; x < W; x++) if (flags[2][x] === '.' && flags[3][x] === '.') flags[1][x] = 'n';
  const hat = blank();
  fillEl(hat, 16, 6.6, 6, 4.4, 'H');
  fillRect(hat, 0, 7, 31, 31, '.');
  fillEl(hat, 16, 8.1, 11.6, 1.7, 'H');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (hat[y][x] !== 'H') continue;
    if (y === 8 || (y < 6 && x >= 19)) hat[y][x] = 'J';
    else if ((y < 6 && x <= 12) || (y === 7 && x <= 9)) hat[y][x] = 'I';
  }
  for (let x = 0; x < W; x++) if (hat[9][x] !== '.' && x % 2 === 0) hat[9][x] = '.';
  px(hat, [[12, 4], [13, 4], [12, 5], [13, 5]], 'R');
  px(hat, [[18, 3], [19, 3], [18, 4], [19, 4]], 'B');
  g = over(g, outline(hat));
  const scarf = blank();
  [[20, 11, 20], [21, 13, 18], [22, 14, 17], [23, 15, 16]].forEach(([y, x0, x1]) => {
    for (let x = x0; x <= x1; x++) scarf[y][x] = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? 'R' : 'W';
  });
  g = over(g, outline(scarf));
  const corn = blank();
  fillEl(corn, 25.5, 21.6, 1.9, 3.6, 'Y');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (corn[y][x] === 'Y' && (x + y) % 2 === 0) corn[y][x] = 'y';
  px(corn, [[23, 24], [24, 25], [24, 24], [25, 25], [26, 25], [27, 24], [27, 25], [28, 24], [24, 23], [27, 23]], 'L');
  px(corn, [[25, 26], [26, 26], [24, 26], [27, 26]], 'l');
  g = over(g, outline(corn));
  g = grip(g, 25.5, 26.8, [], 1.5, 1.1);
  g = under(g, flags);
  return { grid: g, fur };
}

// 9) Carnaval: máscara de baile, colar de flores, pandeiro, serpentina e confete caindo
function carnival(frame) {
  const { body, fur, g: faced } = dressedBase();
  let g = headphones(faced, body);
  const beforeMask = clone(g);
  const mask = blank();
  fillEl(mask, 11.8, 14.6, 3.6, 1.9, 'M');
  fillEl(mask, 20.2, 14.6, 3.6, 1.9, 'M');
  fillRect(mask, 14, 14, 17, 14, 'M');
  px(mask, [[8, 13], [7, 12], [23, 13], [24, 12]], 'M');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x] === 'M' && y === 15) mask[y][x] = 'q';
  g = over(g, mask);
  // Só os olhos aparecem pela máscara, com o brilho
  px(g, [[11, 14], [19, 14]], 'w');
  px(g, [[12, 14], [11, 15], [12, 15], [20, 14], [19, 15], [20, 15]], 'e');
  px(g, [[7, 12], [24, 12], [15, 14], [16, 14]], 'y');
  const lei = blank();
  const COLORS = ['P', 'Y', 'T', 'O'];
  let i = 0;
  for (let x = 8; x <= 22; x += 2) {
    const y = Math.abs(x + 1 - 16) < 5 ? 21 : 20;
    px(lei, [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], COLORS[i % 4]);
    i += 1;
  }
  g = over(g, outline(lei));
  const pd = blank();
  fillEl(pd, 25.5, 23.5, 3.6, 3.6, 'A');
  fillEl(pd, 25.5, 23.5, 2.5, 2.5, 'W');
  px(pd, frame === 'B' ? [[23, 21], [28, 26], [28, 21], [23, 26]] : [[22, 23], [29, 23], [25, 20], [25, 27]], 'y');
  px(pd, [[25, 23], [26, 23], [25, 24], [26, 24]], 'V');
  g = over(g, outline(pd));
  g = grip(g, 29.8, 24, [[28, 23], [28, 25]]);
  const air = blank();
  const wave = frame === 'B' ? [[1, 3], [2, 4], [3, 5], [4, 4], [5, 3], [6, 2], [7, 3]] : [[1, 4], [2, 3], [3, 2], [4, 3], [5, 4], [6, 5], [7, 4]];
  px(air, wave, 'T');
  px(air, wave.map(([x, y]) => [31 - x, y]), 'P');
  const fall = frame === 'B' ? 1 : 0;
  [[2, 9, 'Y'], [29, 9, 'L'], [1, 19, 'P'], [30, 24, 'Y'], [3, 27, 'T'], [12, 1, 'L'], [20, 0, 'O']].forEach(([x, y, c]) => px(air, [[x, y + fall]], c));
  g = under(g, air);
  return { grid: g, fur };
}

// 10) Dia da prova: documento com foto numa mão e caneta preta de corpo transparente na outra, como o edital pede
function examDay(frame) {
  const { body, fur, g: faced } = dressedBase();
  let g = headphones(faced, body);
  const card = blank();
  fillRect(card, 4, 21, 15, 27, 'G');
  fillRect(card, 4, 27, 15, 27, 'g');
  fillRect(card, 15, 21, 15, 27, 'g');
  fillRect(card, 6, 22, 10, 25, 'f');
  px(card, [[7, 25], [8, 25], [9, 25]], 'c');
  px(card, [[7, 23], [9, 23], [8, 24]], 'e');
  [22, 24].forEach((y) => fillRect(card, 12, y, 14, y, 'v'));
  fillRect(card, 6, 26, 14, 26, 'v');
  g = over(g, outline(card));
  g = grip(g, 3.4, 24.2, [[5, 23], [5, 25]]);
  // Caneta deitada com a ponta para o centro: em pé ela sumia no fone e na lateral do corpo
  const pen = blank();
  px(pen, [[17, 24]], 'e');
  px(pen, [[18, 24]], 'u');
  fillRect(pen, 19, 23, 19, 25, 'u');
  fillRect(pen, 20, 23, 26, 23, 'T');
  fillRect(pen, 20, 24, 26, 24, 'e');
  fillRect(pen, 20, 25, 26, 25, 't');
  fillRect(pen, 27, 23, 29, 25, 'e');
  fillRect(pen, 27, 22, 29, 22, 'u');
  px(pen, [[frame === 'B' ? 24 : 21, 23]], 'Z');
  g = over(g, outline(pen));
  g = grip(g, 30.2, 24.2, [[28, 23], [28, 25]], 1.2, 1.4);
  return { grid: g, fur };
}

// 11) Nomeado: terno, gravata e o Diário Oficial com o nome grifado; brilhos em volta
function appointed(frame) {
  const body = hamsterBody();
  const fur = clone(body);
  const suited = mapCells(body, (c, x, y) => {
    if (y < 21 || c === 'k' || c === 'o' || c === '.') return c;
    const hw = 3 - (y - 21) * 0.6;
    if (Math.abs(x + 0.5 - 16) <= hw) return 'W';
    if (Math.abs(x + 0.5 - 16) <= hw + 1) return 'n';
    return c === 'F' || x >= 21 ? 'n' : 'N';
  });
  face(suited);
  let g = headphones(suited, body);
  const tie = blank();
  px(tie, [[15, 21], [16, 21]], 'R');
  fillRect(tie, 15, 22, 16, 25, 'R');
  px(tie, [[16, 22], [16, 23], [16, 24], [16, 25]], 'r');
  px(tie, [[15, 26]], 'r');
  g = over(g, tie);
  px(g, [[12, 25], [12, 27]], 'y');
  const paper = blank();
  fillRect(paper, 19, 18, 29, 28, 'D');
  fillRect(paper, 29, 18, 29, 28, 'd');
  fillRect(paper, 19, 28, 29, 28, 'd');
  fillRect(paper, 20, 19, 28, 20, 'e');
  [22, 24, 26].forEach((y) => { fillRect(paper, 20, y, 23, y, 'v'); fillRect(paper, 25, y, 28, y, 'v'); });
  fillRect(paper, 20, 24, 23, 24, 'Y');
  g = over(g, outline(paper));
  g = grip(g, 29.8, 23.5, [[28, 22], [28, 24]]);
  const shine = blank();
  if (frame === 'B') { px(shine, [[2, 6], [1, 7], [3, 7], [2, 8]], 'Y'); px(shine, [[29, 3], [28, 4], [30, 4], [29, 5]], 'W'); }
  else { px(shine, [[29, 6], [28, 7], [30, 7], [29, 8]], 'Y'); px(shine, [[3, 3], [2, 4], [4, 4], [3, 5]], 'W'); }
  g = under(g, shine);
  return { grid: g, fur };
}

// Pata segurando: palma na borda de fora do objeto e dedos (com o contorno separando um do outro) na frente dele
function grip(g, cx, cy, fingers, rx = 1.3, ry = 1.4) {
  const paw = blank();
  fillEl(paw, cx, cy, rx, ry, 'k');
  px(paw, fingers, 'k');
  return over(g, outline(paw));
}

const base = {
  o: '#3a2116', f: '#e8893a', F: '#b45e28', h: '#f6b565', c: '#fbe7cb', C: '#e3c19a', p: '#ec8e8e',
  e: '#1b100b', w: '#ffffff', k: '#f1c2a8', m: '#5a2c1c', E: '#d2632b', b: '#f2876b',
  K: '#5b616c', u: '#858c98', j: '#3a3e47',
};
const sprites = [
  { id: 'fofodeck', build: fofodeck, palette: { ...base, A: '#f1e3c2', a: '#cdb88f', D: '#3c302a', Y: '#fbc84a' } },
  { id: 'fazendeiro', build: farmer, palette: { ...base, H: '#e8c46c', J: '#b78f3e', I: '#f6dc98', G: '#4e8c3a', t: '#c4683b', T: '#8e4527', d: '#5a3a24', L: '#79c450', l: '#3f8a35' } },
  { id: 'explorador', build: explorer, palette: { ...base, P: '#8b5a33', Q: '#5e3b1f', R: '#a3433a', r: '#6f2b25', S: '#2f9e93', s: '#1e6d66', X: '#565c68', x: '#343842', Y: '#fbc84a', Z: '#fff4c2', g: 'rgba(251,191,36,0.26)', q: 'rgba(251,191,36,0.11)' } },
  { id: 'natal', build: christmas, palette: { ...base, R: '#d23b3b', r: '#962330', U: '#ef6a5c', Z: '#f5f2ea', z: '#c3ccd8', S: '#d23b3b', s: '#962330', L: '#43a047', l: '#2e7d32', N: '#2f86d6', n: '#8fd0ff', D: '#f2b33d', d: '#c0842a', v: '#dbe6f4' } },
  { id: 'halloween', build: halloween, tallEyes: true, palette: { ...base, Z: '#eef1f6', z: '#b8c1cf', P: '#f07a1a', Q: '#c4570f', G: '#3f7d2c', Y: '#fcd34d', O: '#f59e0b', x: '#8b6fd6' } },
  { id: 'anonovo', build: newYear, palette: { ...base, Y: '#fbc84a', D: '#c99a2e', Z: '#e5e7eb', z: '#aab2bf', W: '#ffffff', P: '#f472b6', T: '#67e8f9' } },
  { id: 'junina', build: junina, palette: { ...base, H: '#e8c46c', J: '#b78f3e', I: '#f6dc98', R: '#d23b3b', B: '#3b6fd2', Y: '#fbc84a', y: '#d9a02a', L: '#43a047', l: '#2e7d32', W: '#f5f2ea', n: '#9a7a55' } },
  { id: 'carnaval', build: carnival, palette: { ...base, M: '#8b3fc9', y: '#fbc84a', P: '#f472b6', Y: '#fbc84a', T: '#2dd4bf', O: '#fb923c', L: '#4ade80', A: '#8a5a2b', W: '#efe3c8', V: '#d8c7a3', q: '#5f2a8c' } },
  { id: 'prova', build: examDay, palette: { ...base, G: '#cfe6c3', g: '#9fbf92', v: '#7b8794', T: '#dbe9f4', t: '#aac1d4', Z: '#ffffff' } },
  { id: 'nomeado', build: appointed, palette: { ...base, N: '#2b3a5f', n: '#1a2440', W: '#f4f4f2', R: '#c0262d', r: '#8f1b21', y: '#fbc84a', v: '#7b8794', Y: '#fde047', D: '#f1ede4', d: '#cdc6b6' } },
  { id: 'madrugada', build: night, palette: { ...base, N: '#45437a', n: '#2e2c55', M: '#6764a6', y: '#e9b949', W: '#f1e8d0', V: '#d4c6a2', B: '#7d2f3e', v: '#55202b', A: '#efe6d2', a: '#c9bc9c', Y: '#fbc84a', Z: '#fff4c2', O: '#f97316', g: 'rgba(251,191,36,0.24)', q: 'rgba(251,191,36,0.10)' } },
];
const out = sprites.map((s) => {
  const a = s.build('A');
  const b = s.build('B');
  return { id: s.id, palette: s.palette, A: a.grid.map((r) => r.join('')), B: b.grid.map((r) => r.join('')), closed: blinkOverlay(a.grid, a.fur, s.tallEyes).map((r) => r.join('')) };
});
const dir = __dirname;
fs.writeFileSync(path.join(dir, 'sprites.json'), JSON.stringify(out));
for (const s of out) { console.log('== ' + s.id); console.log(s.A.join('\n')); }
const toSvg = (s, grid, scale) => {
  let rects = '';
  grid.forEach((row, y) => { for (let x = 0; x < W; x++) { const c = row[x]; if (c === '.') continue; let n = 1; while (row[x + n] === c) n++; rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${s.palette[c]}"/>`; x += n - 1; } });
  return `<svg width="${W * scale}" height="${H * scale}" viewBox="0 0 32 32" shape-rendering="crispEdges">${rects}</svg>`;
};
const html = `<body style="background:#020617;margin:0;padding:16px;display:flex;gap:24px;flex-wrap:wrap">${out.map((s) => `<div style="display:flex;gap:12px;align-items:flex-end">${toSvg(s, s.A, 8)}${toSvg(s, s.B, 4)}${toSvg(s, s.A.map((r, y) => [...r].map((c, x) => (s.closed[y][x] !== '.' ? s.closed[y][x] : c)).join('')), 2)}${toSvg(s, s.A, 1)}</div>`).join('')}</body>`;
fs.writeFileSync(path.join(dir, 'preview.html'), html);
