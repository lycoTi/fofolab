import { useEffect, useRef } from 'react';

/** Tempo com a página na tela (janela ativa) para ela contar como lida. */
export const SECONDS_TO_COUNT_PAGE_AS_READ = 15;

/** Lê `read_pages_json` do banco: números únicos, ordenados e dentro do total de páginas. */
export function parseReadPages(json: string | null | undefined, totalPages: number): number[] {
  try {
    const parsed: unknown = JSON.parse(json || '[]');
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= totalPages);
    return [...new Set(valid)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function withPageRead(pages: number[], page: number, read: boolean): number[] {
  const set = new Set(pages);
  if (read) set.add(page);
  else set.delete(page);
  return [...set].sort((a, b) => a - b);
}

/**
 * Conta, a cada segundo, o tempo na página atual enquanto a janela está visível e em foco.
 * Ao chegar em {@link SECONDS_TO_COUNT_PAGE_AS_READ}, chama `onPageRead` uma única vez por página.
 * `suppress(page)` impede a remarcação automática (o estudante desmarcou a página à mão).
 */
export function usePageReadTimer({
  enabled,
  currentPage,
  readPages,
  onPageRead,
}: {
  enabled: boolean;
  currentPage: number;
  readPages: number[];
  onPageRead: (page: number) => void;
}) {
  const secondsByPage = useRef(new Map<number, number>());
  const latest = useRef({ currentPage, readPages, onPageRead });
  latest.current = { currentPage, readPages, onPageRead };

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const { currentPage: page, readPages: read, onPageRead: markRead } = latest.current;
      const seconds = secondsByPage.current.get(page) ?? 0;
      if (seconds >= SECONDS_TO_COUNT_PAGE_AS_READ || read.includes(page)) return;
      secondsByPage.current.set(page, seconds + 1);
      if (seconds + 1 >= SECONDS_TO_COUNT_PAGE_AS_READ) markRead(page);
    }, 1000);
    return () => clearInterval(timer);
  }, [enabled]);

  return {
    suppress: (page: number) => secondsByPage.current.set(page, SECONDS_TO_COUNT_PAGE_AS_READ),
  };
}
