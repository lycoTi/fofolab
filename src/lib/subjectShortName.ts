/**
 * Nome curto da matéria para os cartões da semana (spec 13): os nomes do edital são longos ("Fundamentos de Direito
 * Público Aplicado, Controle e Responsabilização") e o cartão tem uma linha. O nome inteiro aparece no detalhe do dia.
 */
const MAX_LENGTH = 22;
/** Começos que não distinguem uma matéria da outra ("Fundamentos de Auditoria", "Fundamentos de Governança"…). */
const GENERIC_START = /^(fundamentos|noções|nocoes|conhecimentos|princípios|principios|tópicos|topicos) (de|da|do|das|dos|em) /i;
const ABBREVIATIONS: [RegExp, string][] = [
  [/^Desenvolvimento\b/, 'Desenv.'],
  [/^Engenharia\b/, 'Eng.'],
  [/^Administração\b/, 'Adm.'],
  [/^Tecnologia da Informação\b/, 'TI'],
];
/** Palavra solta no fim de um corte não diz nada ("Arquitetura e"). */
const DANGLING_END = /(,|\s(e|de|da|do|das|dos|em|&))$/i;

export function shortSubjectName(name: string): string {
  // 1. Tira o começo genérico e o que vem depois de parêntese, travessão, ponto e vírgula ou dois-pontos
  let text = name.trim().replace(GENERIC_START, '');
  text = text.split(/[;:(–—&]/)[0].trim();

  // 2. Primeira parte antes da vírgula; se ela for uma palavra só, a próxima parte ajuda a reconhecer
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  let base = parts[0] ?? '';
  if (parts.length > 1 && !base.includes(' ')) base = parts.join(', ');
  for (const [pattern, short] of ABBREVIATIONS) base = base.replace(pattern, short);
  if (base.length <= MAX_LENGTH) return base;

  // 3. Corta em palavra inteira, sem terminar em conectivo
  let out = '';
  for (const word of base.split(' ')) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > MAX_LENGTH) break;
    out = next;
  }
  while (DANGLING_END.test(out)) out = out.replace(DANGLING_END, '').trim();
  return out || base.split(' ')[0];
}
