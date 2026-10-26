// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, type MemoryStorage } from '../lib/storage';

const sqlJsConfig = {};
type DatabaseModule = typeof import('../lib/database');
let dbModule: DatabaseModule | null = null;

async function openDatabase(storage: MemoryStorage = createMemoryStorage()): Promise<DatabaseModule> {
  vi.resetModules();
  const db = await import('../lib/database');
  dbModule = db;
  await db.initDatabase({ storage, sqlJsConfig });
  return db;
}

afterEach(async () => {
  await dbModule?.closeDatabase();
  dbModule = null;
});

describe('Horas por dia do plano (spec 13 §4.1, migração v11)', () => {
  it('dias de estudo, exceção de um dia e semana atípica gravam e voltam depois de fechar e abrir o app', async () => {
    const storage = createMemoryStorage();
    let db = await openDatabase(storage);
    const planId = db.getStudyPlans()[0].id;

    const updated = db.updateWeekdayMinutes(planId, [150, 150, 150, 150, 150, 300, 0]);
    expect(updated?.weekday_minutes_json).toBe('[150,150,150,150,150,300,0]');
    expect(updated?.weekly_hours_target).toBe(17.5);
    db.setDayOverride(planId, '2026-10-27', 60);
    db.setWeekOverride(planId, '2026-11-02', [0, 0, 0, 0, 0, 0, 0]);
    await db.flushDatabase();
    await db.closeDatabase();

    db = await openDatabase(storage);
    expect(db.getStudyPlans().find((p) => p.id === planId)?.weekday_minutes_json).toBe('[150,150,150,150,150,300,0]');
    const overrides = db.getDayOverrides(planId, '2026-10-26', '2026-11-08');
    expect(overrides['2026-10-27']).toBe(60);
    expect(Object.keys(overrides).filter((k) => k >= '2026-11-02')).toEqual([
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
    ]);
    // Fora do intervalo pedido não vem
    expect(db.getDayOverrides(planId, '2026-10-28', '2026-11-01')).toEqual({});
  });

  it('"voltar ao tempo de sempre" apaga a exceção do dia e "voltar ao padrão" apaga a semana', async () => {
    const db = await openDatabase();
    const planId = db.getStudyPlans()[0].id;
    db.setDayOverride(planId, '2026-10-27', 60);
    db.setWeekOverride(planId, '2026-11-02', [60, 60, 60, 60, 60, 60, 60]);
    db.setDayOverride(planId, '2026-10-27', null);
    db.setWeekOverride(planId, '2026-11-02', null);
    expect(db.getDayOverrides(planId, '2026-10-01', '2026-12-31')).toEqual({});
  });

  it('mudar as horas da semana por outro caminho mantém as folgas do padrão', async () => {
    const db = await openDatabase();
    const planId = db.getStudyPlans()[0].id;
    db.updateWeekdayMinutes(planId, [150, 150, 150, 150, 150, 300, 0]);
    const updated = db.updateStudyPlan({ id: planId, weekly_hours_target: 35 });
    expect(updated?.weekday_minutes_json).toBe('[300,300,300,300,300,600,0]');
  });

  it('plano novo herda os dias de estudo do plano ativo, na proporção das horas dele', async () => {
    const db = await openDatabase();
    const active = db.getStudyPlans().find((p) => p.is_active === 1)!;
    db.updateWeekdayMinutes(active.id, [150, 150, 150, 150, 150, 300, 0]);
    const created = db.createStudyPlan({
      title: 'Outro concurso', organ: 'X', exam_board: 'Cebraspe', role_title: 'Analista', exam_date: null, weekly_hours_target: 35,
    });
    expect(created.weekday_minutes_json).toBe('[300,300,300,300,300,600,0]');
  });

  it('apagar o plano apaga as exceções dele', async () => {
    const db = await openDatabase();
    const planId = db.getStudyPlans()[0].id;
    db.setDayOverride(planId, '2026-10-27', 60);
    db.deleteStudyPlan(planId);
    const left = db.getDb().exec('SELECT COUNT(*) FROM plan_day_overrides WHERE plan_id = ?', [planId])[0].values[0][0];
    expect(left).toBe(0);
  });
});
