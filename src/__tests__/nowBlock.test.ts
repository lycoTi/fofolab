import { describe, expect, it } from 'vitest';
import { pickNowBlock, type NowBlock } from '../lib/nowBlock';
import { adm, item, lookedTarget, port, subjects, tAdm, ti, tLooked, topics, tPort, targetOf, tTi } from './helpers/routineFixtures';

describe('"Agora" é o bloco rodando, senão o atual do roteiro', () => {
  it('sem bloco rodando: o item atual, sem rótulo', () => {
    const done = item(port, tPort, 'done', 50, 50);
    const current = item(ti, tTi, 'current', 120);
    const now = pickNowBlock({ items: [done, current], extra: null, block: null, active: false, subjects, topics });
    expect(now).toEqual<NowBlock>({ subject: ti, topic: tTi, item: current, tag: null, running: false });
  });

  it('bloco rodando no item atual: esse item, rodando, sem rótulo', () => {
    const current = item(ti, tTi, 'current', 120);
    const now = pickNowBlock({ items: [current], extra: null, block: targetOf(current), active: true, subjects, topics });
    expect(now).toEqual<NowBlock>({ subject: ti, topic: tTi, item: current, tag: null, running: true });
  });

  it('bloco rodando num item já cumprido (meta batida na pausa): esse item com "meta cumprida"', () => {
    const doneRunning = item(ti, tTi, 'done', 120, 120);
    const current = item(adm, tAdm, 'current', 60);
    const now = pickNowBlock({ items: [doneRunning, current], extra: null, block: targetOf(doneRunning), active: true, subjects, topics });
    expect(now?.item).toBe(doneRunning);
    expect(now?.tag).toBe('meta cumprida');
    expect(now?.running).toBe(true);
  });

  it('bloco rodando fora do roteiro: matéria e tópico achados por id, sem item, "fora do roteiro"', () => {
    const current = item(adm, tAdm, 'current', 60);
    const now = pickNowBlock({ items: [current], extra: null, block: lookedTarget(null), active: true, subjects, topics });
    expect(now).toEqual<NowBlock>({ subject: ti, topic: tLooked, item: null, tag: 'fora do roteiro', running: true });
  });

  it('bloco rodando no extra (roteiro cumprido): o extra, sem rótulo', () => {
    const extra = item(adm, tAdm, 'current', 60);
    const now = pickNowBlock({ items: [item(ti, tTi, 'done', 120, 120)], extra, block: targetOf(extra), active: true, subjects, topics });
    expect(now?.item).toBe(extra);
    expect(now?.tag).toBeNull();
    expect(now?.running).toBe(true);
  });

  it('roteiro cumprido sem nada rodando: o bloco extra', () => {
    const extra = item(adm, tAdm, 'current', 60);
    const now = pickNowBlock({ items: [item(ti, tTi, 'done', 120, 120)], extra, block: null, active: false, subjects, topics });
    expect(now?.item).toBe(extra);
    expect(now?.tag).toBeNull();
    expect(now?.running).toBe(false);
  });

  it('bloco que já terminou (não ativo) não conta como rodando', () => {
    const current = item(ti, tTi, 'current', 120);
    const finished = targetOf(item(adm, tAdm, 'next', 60));
    const now = pickNowBlock({ items: [current], extra: null, block: finished, active: false, subjects, topics });
    expect(now?.item).toBe(current);
    expect(now?.running).toBe(false);
  });

  it('nada no roteiro e nada rodando: null', () => {
    expect(pickNowBlock({ items: [], extra: null, block: null, active: false, subjects, topics })).toBeNull();
  });
});
