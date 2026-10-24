import { normalizeText } from './signals';

/** Resumo de revisão no formato da Dora (spec 11 §5.2.1): curto e com campos fixos, para o caderno não virar livro. */
export interface ReviewSummary {
  title: string;
  keywords: string;
  concept: string;
  use: string;
  analogy: string;
  caution: string;
}

const FIELDS: { key: Exclude<keyof ReviewSummary, 'title'>; label: string }[] = [
  { key: 'keywords', label: 'Palavras-chave' },
  { key: 'concept', label: 'Conceito curto' },
  { key: 'use', label: 'Uso funcional' },
  { key: 'analogy', label: 'Analogia' },
  { key: 'caution', label: 'Cuidado em prova' },
];

/** Tira marcadores de lista e negrito: "· **Analogia:** x" → "Analogia: x". */
function clean(line: string): string {
  return line.replace(/^[\s·•\-*]+/, '').replace(/\*\*/g, '').trim();
}

/** Lê o resumo devolvido pela IA; `null` se faltar o essencial (palavras-chave e conceito curto). */
export function parseSummary(text: string): ReviewSummary | null {
  const lines = text.split('\n').map(clean).filter(Boolean);
  const summary: ReviewSummary = { title: '', keywords: '', concept: '', use: '', analogy: '', caution: '' };
  for (const line of lines) {
    const field = FIELDS.find((f) => normalizeText(line).startsWith(`${normalizeText(f.label)}:`));
    if (field) {
      summary[field.key] = line.slice(line.indexOf(':') + 1).trim();
    } else if (!summary.title) {
      summary.title = line;
    }
  }
  if (!summary.keywords || !summary.concept) return null;
  return summary;
}

/** Até 6 linhas: título e os campos preenchidos. */
export function formatSummaryForNotebook(s: ReviewSummary): string {
  const lines = [`**${s.title || 'Resumo de revisão'}**`];
  for (const f of FIELDS) {
    if (s[f.key]) lines.push(`· **${f.label}:** ${s[f.key]}`);
  }
  return lines.join('\n');
}
