import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readConcurso, readConcursoMeta } from './acervoStore';
import { readClassificacao, type Concordancia } from './classificationStore';
import type { AssuntoDoItem } from './classifyPrompt';
import type { AcervoItem, ConcursoMeta } from './types';
import { readVocabulario, type Vocabulario } from './vocab';

/**
 * Pacote do acervo para o app (spec 12 §6.5; a importação é a 12c): vocabulário, concursos e itens com o CONSENSO da
 * classificação — as opiniões por modelo ficam só no acervo. Item sem classificação entra com `assuntos: []`.
 */
export interface Pacote {
  formato: 'fofolab-acervo';
  versao: 1;
  vocabulario: Vocabulario;
  concursos: ConcursoMeta[];
  itens: (AcervoItem & { assuntos: AssuntoDoItem[]; incerto: boolean; concordancia: Concordancia | 'sem-classificacao' })[];
}

export function buildPacote(acervoDir: string): Pacote {
  const vocabulario = readVocabulario(join(acervoDir, 'vocabulario.json'));
  if (!vocabulario) throw new Error('Falta acervo/vocabulario.json: rode "npm run minerar -- semente" primeiro.');
  const concursosDir = join(acervoDir, 'cebraspe');
  const ids = readdirSync(concursosDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  const concursos: ConcursoMeta[] = [];
  const itens: Pacote['itens'] = [];
  for (const id of ids) {
    const meta = readConcursoMeta(concursosDir, id);
    if (!meta) continue;
    concursos.push(meta);
    const classif = readClassificacao(join(acervoDir, 'classificacao'), id);
    for (const item of readConcurso(concursosDir, id)) {
      const c = classif.itens[item.id];
      itens.push(
        c
          ? { ...item, assuntos: c.consenso, incerto: c.incerto, concordancia: c.concordancia }
          : { ...item, assuntos: [], incerto: true, concordancia: 'sem-classificacao' }
      );
    }
  }
  return { formato: 'fofolab-acervo', versao: 1, vocabulario, concursos, itens };
}

export function writePacote(path: string, pacote: Pacote): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(pacote)}\n`);
}
