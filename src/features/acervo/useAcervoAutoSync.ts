import { useEffect, useState } from 'react';
import { syncLocalAcervoIfNeeded } from '../../lib/acervo/autoSync';
import type { LinkAi } from '../../lib/acervo/importAcervo';

/**
 * Sincroniza em segundo plano os pacotes de `acervo/pacote/` ao abrir o app ou ao trocar/editar os tópicos do plano
 * (spec 12d §3.1). Quando sincroniza novidades, devolve uma mensagem curta por 6 segundos e avisa o app para reler as
 * questões.
 */
export function useAcervoAutoSync(input: {
  ready: boolean;
  planId: string;
  topicsCount: number;
  ai: LinkAi | null;
  onSynced: () => void;
}): string | null {
  const { ready, planId, topicsCount, ai, onSynced } = input;
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !planId || topicsCount === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    void syncLocalAcervoIfNeeded({ planId, ai }).then((res) => {
      if (cancelled || !res.synced || !res.summary) return;
      onSynced();
      setNotice(`Acervo sincronizado: ${res.summary.withSubject} questões com assunto (${res.summary.topicsLinked} tópicos ligados).`);
      timer = setTimeout(() => setNotice(null), 6000);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ready, planId, topicsCount, ai]);

  return notice;
}

