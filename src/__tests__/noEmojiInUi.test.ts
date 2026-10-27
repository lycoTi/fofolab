import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regra de identidade (.agents/rules/identidade-fofolab.md): nada de emoji em texto de interface — status vira
 * quadradinho + texto, ação vira ícone, e o hamster é o Fofo em pixel art. Conteúdo pode (é do aluno ou da IA).
 */
const SRC = join(__dirname, '..');
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;

/** Arquivos com conteúdo, não interface (com o porquê). */
const CONTENT_FILES: Record<string, string> = {
  'data/initialSeed.ts': 'anotações e explicações do exemplo inicial (conteúdo do aluno)',
  'features/notebook-dock/useNotebookDraft.ts': 'título da anotação que vai para o caderno (conteúdo do aluno)',
  'lib/fofoia/demo.ts': 'resposta de exemplo da FofoIA (conteúdo da IA)',
  'lib/syllabusImport.ts': 'marcadores de lista que o edital colado pode trazer (entrada, não texto da tela)',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.generated.ts') ? [path] : [];
  });
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);

describe('Interface sem emoji', () => {
  it('nenhum texto de interface usa emoji', () => {
    const found: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file).split(sep).join('/');
      if (CONTENT_FILES[rel]) continue;
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, index) => {
          if (!isComment(line) && EMOJI.test(line)) found.push(`${rel}:${index + 1}  ${line.trim().slice(0, 80)}`);
        });
    }
    expect(found).toEqual([]);
  });
});
