/**
 * Alternativas de uma questão com a letra REAL de cada uma.
 * Antes a tela atribuía letras pela posição (0→A, 1→B…), o que quebrava itens Certo/Errado
 * (gabarito "C"/"E") e qualquer lista fora de ordem.
 */
export interface QuestionOption {
  key: string;   // Letra usada no gabarito: A–E, ou C/E para Certo/Errado
  text: string;  // Texto sem o prefixo
  label: string; // Texto exibido, com prefixo ("A) ...")
}

const INDEX_LETTERS = ['A', 'B', 'C', 'D', 'E'];
// "A) x", "(A) x", "A. x", "A - x" — exige espaço após "." e "-" para não confundir "E-mail..."
const OPTION_PREFIX = /^\s*\(?([A-Ea-e])\s*(?:[)\]]\s*|[.:\-–]\s+)/;

export function splitOptionPrefix(raw: string): { key: string; text: string } | null {
  const match = OPTION_PREFIX.exec(raw);
  if (!match) return null;
  return { key: match[1].toUpperCase(), text: raw.slice(match[0].length).trim() };
}

function normalizeOption(item: unknown, index: number): QuestionOption | null {
  const fallbackKey = INDEX_LETTERS[index] ?? String(index + 1);

  if (typeof item === 'string') {
    const prefixed = splitOptionPrefix(item);
    if (prefixed) return { ...prefixed, label: item.trim() };

    const certoErrado = /^\s*(certo|errado)\s*$/i.exec(item);
    if (certoErrado) {
      const isCerto = certoErrado[1].toLowerCase() === 'certo';
      const key = isCerto ? 'C' : 'E';
      const text = isCerto ? 'Certo' : 'Errado';
      return { key, text, label: `${key}) ${text}` };
    }

    const text = item.trim();
    return { key: fallbackKey, text, label: `${fallbackKey}) ${text}` };
  }

  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const key = String(obj.key ?? obj.letter ?? obj.letra ?? fallbackKey).trim().toUpperCase();
    const text = String(obj.text ?? obj.texto ?? '').trim();
    return { key, text, label: `${key}) ${text}` };
  }

  return null;
}

export function parseQuestionOptions(optionsJson: string): QuestionOption[] {
  let raw: unknown;
  try {
    raw = JSON.parse(optionsJson);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => normalizeOption(item, index))
    .filter((opt): opt is QuestionOption => opt !== null);
}

export function findCorrectOption(
  options: QuestionOption[],
  finalAnswer: string
): QuestionOption | null {
  const answer = finalAnswer.trim().toUpperCase();
  return options.find((opt) => opt.key === answer) ?? null;
}
