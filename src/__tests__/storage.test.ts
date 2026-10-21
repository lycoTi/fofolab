// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  createIndexedDbStorage,
  makeBackupId,
  MAX_BACKUPS,
  parseBackupId,
  slugifyLabel,
} from '../lib/storage';

let dbCounter = 0;
const uniqueDbName = () => `fofolab-test-${++dbCounter}`;

describe('Armazenamento dos estudos (IndexedDB + cópias de segurança)', () => {
  it('grava e lê o banco completo como bytes (sem base64)', async () => {
    const storage = await createIndexedDbStorage({ dbName: uniqueDbName() });
    expect(await storage.load()).toBeNull();

    const bytes = new Uint8Array([1, 2, 3, 250, 0, 7]);
    await storage.save(bytes);

    expect(Array.from((await storage.load()) ?? [])).toEqual(Array.from(bytes));
  });

  it('cria, lista (mais recente primeiro) e lê cópias de segurança, mantendo só as últimas', async () => {
    const storage = await createIndexedDbStorage({ dbName: uniqueDbName() });

    for (let i = 0; i < MAX_BACKUPS + 3; i++) {
      await storage.createBackup(new Uint8Array([i]), `copia-${i}`);
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    const backups = await storage.listBackups();
    expect(backups).toHaveLength(MAX_BACKUPS);
    expect(backups[0].label).toBe(`copia-${MAX_BACKUPS + 2}`);
    expect(Array.from((await storage.readBackup(backups[0].id)) ?? [])).toEqual([MAX_BACKUPS + 2]);
  });

  it('guarda bancos ilegíveis em quarentena sem tocar no banco principal', async () => {
    const storage = await createIndexedDbStorage({ dbName: uniqueDbName() });
    await storage.save(new Uint8Array([9, 9]));
    await storage.quarantine(new Uint8Array([6, 6, 6]), 'banco-nao-abriu');

    expect(Array.from((await storage.load()) ?? [])).toEqual([9, 9]);
  });

  it('IDs de cópia são ordenáveis por data e preservam o rótulo', () => {
    const date = new Date('2026-10-21T14:58:00.123Z');
    const id = makeBackupId(date, 'Antes de excluir plano');
    const parsed = parseBackupId(id);

    expect(parsed?.createdAt).toBe('2026-10-21T14:58:00.123Z');
    expect(parsed?.label).toBe('antes-de-excluir-plano');
    expect(slugifyLabel('Ação Crítica!')).toBe('acao-critica');
    expect(makeBackupId(new Date('2026-10-22T00:00:00.000Z'), 'x') > id).toBe(true);
  });
});
