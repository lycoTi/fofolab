import { useEffect, useState } from 'react';
import { openAcervo } from '../../lib/acervo/acervoStore';
import { getQuestionsView, hasActiveLinks, scopeTopicIds, type QuestionScope, type QuestionsView } from '../../lib/acervo/topicQuestions';
import type { Topic } from '../../types/database';

const EMPTY: QuestionsView = { items: [], links: [], excluded: [], groupCode: null, acervoMissing: false };

/**
 * Questões da aba Questões (spec 12c §5.4). O acervo só é aberto quando algum tópico do escopo tem ligação; enquanto
 * ele abre, a lista mostra as questões próprias (sem o aviso de acervo ausente, que ainda não se sabe).
 */
export function useTopicQuestions(input: {
  ready: boolean;
  planId: string;
  subjectId: string;
  topicId: string;
  scope: QuestionScope;
  /** Sobe quando algo muda as questões (importar, responder, ligar/desligar): a lista é refeita. */
  version: number;
}): QuestionsView & { loading: boolean } {
  const [state, setState] = useState<QuestionsView & { loading: boolean }>({ ...EMPTY, loading: false });
  const { ready, planId, subjectId, topicId, scope, version } = input;

  useEffect(() => {
    if (!ready || !subjectId) {
      setState({ ...EMPTY, loading: false });
      return;
    }
    const scopeInput = { scope, planId, subjectId, topicId };
    const ownOnly = getQuestionsView({ ...scopeInput, acervo: null });
    if (!hasActiveLinks(scopeTopicIds(scopeInput))) {
      setState({ ...ownOnly, loading: false });
      return;
    }

    let cancelled = false;
    setState({ ...ownOnly, acervoMissing: false, loading: true });
    void openAcervo().then((acervo) => {
      // Trocou de tópico/escopo enquanto abria: a resposta atrasada é descartada
      if (cancelled) return;
      setState({ ...getQuestionsView({ ...scopeInput, acervo }), loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, planId, subjectId, topicId, scope, version]);

  return state;
}

/** Quantas questões o tópico do bloco tem (só as dele, sem recuo para o grupo — spec 12c §5.4). */
export function useTopicQuestionCount(input: { ready: boolean; topic: Topic | null; version: number }): number {
  const view = useTopicQuestions({
    ready: input.ready && input.topic !== null,
    planId: '',
    subjectId: input.topic?.subject_id ?? '',
    topicId: input.topic?.id ?? '',
    scope: 'topic',
    version: input.version,
  });
  return view.items.length;
}
