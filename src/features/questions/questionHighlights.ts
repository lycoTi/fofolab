export interface HighlightRange {
  start: number;
  end: number;
}

export interface TextSegment {
  text: string;
  isHighlight: boolean;
  index?: number;
}

const STORAGE_PREFIX = 'fofolab:highlights:';

export function loadHighlights(questionId: string): HighlightRange[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + questionId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is HighlightRange =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.start === 'number' &&
        typeof item.end === 'number' &&
        item.start < item.end
    );
  } catch {
    return [];
  }
}

export function saveHighlights(questionId: string, ranges: HighlightRange[]): void {
  try {
    if (ranges.length === 0) {
      localStorage.removeItem(STORAGE_PREFIX + questionId);
    } else {
      localStorage.setItem(STORAGE_PREFIX + questionId, JSON.stringify(ranges));
    }
  } catch {
    // localStorage pode estar cheio ou indisponível
  }
}

export function clearAllHighlights(questionId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + questionId);
  } catch {
    // ignore
  }
}

/**
 * Adiciona um novo intervalo e mescla sobreposições de forma ordenada.
 */
export function mergeHighlights(ranges: HighlightRange[], newRange: HighlightRange): HighlightRange[] {
  if (newRange.start >= newRange.end) return ranges;

  const all = [...ranges, newRange].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: HighlightRange[] = [];

  for (const range of all) {
    if (merged.length === 0) {
      merged.push({ ...range });
      continue;
    }
    const last = merged[merged.length - 1];
    // Se o início do atual encosta ou sobrepõe o final do anterior
    if (range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

export function removeHighlightAt(ranges: HighlightRange[], index: number): HighlightRange[] {
  return ranges.filter((_, i) => i !== index);
}

/**
 * Divide o texto em blocos normais e grifados prontos para renderização.
 */
export function splitTextByHighlights(text: string, ranges: HighlightRange[]): TextSegment[] {
  if (!text) return [];
  if (ranges.length === 0) return [{ text, isHighlight: false }];

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const start = Math.max(0, Math.min(r.start, text.length));
    const end = Math.max(start, Math.min(r.end, text.length));

    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), isHighlight: false });
    }
    if (end > start) {
      segments.push({ text: text.slice(start, end), isHighlight: true, index: i });
      cursor = end;
    }
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), isHighlight: false });
  }

  return segments;
}
