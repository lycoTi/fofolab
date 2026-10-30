import { describe, expect, it } from 'vitest';
import { sceneKey, sceneViewAt, type SceneInput } from '../features/fofo-window/sceneView';
import type { SunTimes } from '../features/mascot/sun';
import { pickOutfit } from '../features/mascot/wardrobe';

/** Datas locais: os limites não dependem do fuso de quem roda o teste. */
const at = (hour: number, minute: number, month = 7, day = 12) => new Date(2026, month, day, hour, minute);

/** Sol de referência: nasce às 06:00 e se põe às 18:00 do mesmo dia de `now`. */
function referenceSun(now: Date): SunTimes {
  const day = (hour: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0);
  return { sunrise: day(6), sunset: day(18) };
}

function input(overrides: Partial<SceneInput> & { now: Date }): SceneInput {
  return {
    sun: referenceSun(overrides.now),
    outfit: 'fazendeiro',
    phase: 'IDLE',
    running: false,
    peeking: false,
    hasBlock: true,
    subjectColor: null,
    ...overrides,
  };
}

describe('Céu da janela pela hora de verdade', () => {
  it.each([
    [5, 19, 'noite'],
    [5, 20, 'dourado'],
    [6, 39, 'dourado'],
    [6, 41, 'dia'],
    [12, 0, 'dia'],
    [17, 19, 'dia'],
    [17, 20, 'dourado'],
    [17, 21, 'dourado'],
    [18, 40, 'dourado'],
    [18, 41, 'noite'],
    [23, 0, 'noite'],
  ] as const)('%i:%i → %s', (hour, minute, sky) => {
    expect(sceneViewAt(input({ now: at(hour, minute) })).sky).toBe(sky);
  });

  it('segue o sol do dia, não um horário fixo', () => {
    const now = at(19, 0);
    const lateSun = { sunrise: at(7, 0), sunset: at(18, 30) };
    expect(sceneViewAt(input({ now, sun: lateSun })).sky).toBe('dourado');
  });
});

describe('Paisagem pelo período do guarda-roupa', () => {
  it.each([
    [12, 0, 'fazenda'],
    [17, 59, 'fazenda'],
    [18, 0, 'trilha'],
    [21, 59, 'trilha'],
    [22, 0, 'cidade'],
    [5, 59, 'cidade'],
    [6, 0, 'fazenda'],
  ] as const)('%i:%i → %s', (hour, minute, landscape) => {
    expect(sceneViewAt(input({ now: at(hour, minute) })).landscape).toBe(landscape);
  });

  it('a roupa da hora fixada no guarda-roupa não muda a paisagem: explorador ao meio-dia vê a fazenda', () => {
    const view = sceneViewAt(input({ now: at(12, 0), outfit: 'explorador' }));
    expect(view.landscape).toBe('fazenda');
    expect(view.sky).toBe('dia');
  });
});

describe('Fuso desconhecido (sem nascer e pôr do sol)', () => {
  it.each([
    [6, 39],
    [6, 41],
    [17, 20],
    [17, 21],
    [18, 0],
    [18, 40],
    [18, 41],
    [21, 59],
    [22, 0],
    [5, 59],
  ] as const)('%i:%i dá o mesmo que nascer 06:00 e pôr 18:00', (hour, minute) => {
    const now = at(hour, minute);
    expect(sceneViewAt(input({ now, sun: null }))).toEqual(sceneViewAt(input({ now })));
  });
});

describe('Festa vem da roupa, não do calendário', () => {
  it('roupa de Natal fixada em março traz o Natal', () => {
    expect(sceneViewAt(input({ now: at(15, 0, 2, 15), outfit: 'natal' })).festival).toBe('natal');
  });

  it('dia da prova em dezembro vence o Natal: sem festa', () => {
    expect(sceneViewAt(input({ now: at(15, 0, 11, 10), outfit: 'prova' })).festival).toBeNull();
  });

  it('festa ainda sem camada (Halloween) fica só com céu e paisagem', () => {
    expect(sceneViewAt(input({ now: at(15, 0, 9, 20), outfit: 'halloween' })).festival).toBeNull();
  });

  it.each([
    [10, 30, null],
    [11, 1, 'natal'],
    [11, 31, null],
  ] as const)('roupa automática no dia %i/%i (mês base 0) → festa %s', (month, day, festival) => {
    const now = at(15, 0, month, day);
    const outfit = pickOutfit({ now, examDates: [], sun: null });
    expect(sceneViewAt(input({ now, outfit })).festival).toBe(festival);
  });
});

describe('Momento do Fofo na janela', () => {
  const noon = at(12, 0);

  it.each([
    ['IDLE', false, false, 'ritual'],
    ['READY', false, false, 'ritual'],
    ['DONE', false, false, 'ritual'],
    ['FOCUS', true, false, 'foco'],
    ['FOCUS', false, false, 'dormindo'],
    ['FOCUS', false, true, 'foco'],
    ['BREAK', true, false, 'dormindo'],
    ['BREAK', false, false, 'dormindo'],
  ] as const)('%s, rodando=%s, olhada=%s → %s', (phase, running, peeking, moment) => {
    expect(sceneViewAt(input({ now: noon, phase, running, peeking })).moment).toBe(moment);
  });

  it('sem bloco, o Fofo fica acordado no cenário, qualquer que seja a fase guardada', () => {
    expect(sceneViewAt(input({ now: noon, hasBlock: false })).moment).toBe('acordado');
    expect(sceneViewAt(input({ now: noon, hasBlock: false, phase: 'FOCUS', running: true })).moment).toBe('acordado');
  });

  it('a cor da matéria do bloco passa para o cenário', () => {
    expect(sceneViewAt(input({ now: noon, subjectColor: '#7c3aed' })).subjectColor).toBe('#7c3aed');
  });
});

describe('Chave de redesenho', () => {
  it('minutos diferentes com o mesmo resultado dão a mesma chave', () => {
    const a = sceneViewAt(input({ now: at(12, 0) }));
    const b = sceneViewAt(input({ now: at(14, 37) }));
    expect(sceneKey(a)).toBe(sceneKey(b));
  });

  it('muda quando qualquer coisa visível muda', () => {
    const base = sceneViewAt(input({ now: at(12, 0), phase: 'FOCUS', running: true, subjectColor: '#7c3aed' }));
    const variants = [
      sceneViewAt(input({ now: at(17, 30), phase: 'FOCUS', running: true, subjectColor: '#7c3aed' })),
      sceneViewAt(input({ now: at(12, 0), phase: 'FOCUS', running: true, subjectColor: '#7c3aed', outfit: 'natal' })),
      sceneViewAt(input({ now: at(12, 0), phase: 'BREAK', running: true, subjectColor: '#7c3aed' })),
      sceneViewAt(input({ now: at(12, 0), phase: 'FOCUS', running: true, subjectColor: '#0891b2' })),
      sceneViewAt(input({ now: at(12, 0), phase: 'FOCUS', running: true, subjectColor: null })),
    ];
    const keys = new Set([sceneKey(base), ...variants.map(sceneKey)]);
    expect(keys.size).toBe(variants.length + 1);
  });

  it('a paisagem sozinha também muda a chave', () => {
    const farm = sceneViewAt(input({ now: at(17, 59) }));
    const trail = sceneViewAt(input({ now: at(18, 0) }));
    expect(farm.sky).toBe(trail.sky);
    expect(sceneKey(farm)).not.toBe(sceneKey(trail));
  });
});
