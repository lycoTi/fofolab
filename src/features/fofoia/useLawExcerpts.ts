import { useEffect, useState } from 'react';
import type { LawExcerpt } from '../../lib/fofoia/context';
import { resolveLawExcerpts } from '../../lib/laws/resolver';
import type { Question } from '../../types/database';

export interface UseLawExcerptsParams {
  question?: Question | null;
  topicTitle?: string;
}

/**
 * Hook para detecção e resolução de fragmentos de lei da questão ativa ou tópico.
 * Executa em segundo plano de forma não-bloqueante; retorna LawExcerpt[] para ancorar a FofoIA.
 */
export function useLawExcerpts(params: UseLawExcerptsParams): LawExcerpt[] {
  const [excerpts, setExcerpts] = useState<LawExcerpt[]>([]);

  const questionId = params.question?.id;
  const statement = params.question?.statement;
  const topicTitle = params.topicTitle;

  useEffect(() => {
    let active = true;

    const fullQuestionText = params.question
      ? `${params.question.statement} ${params.question.options_json}`
      : undefined;

    resolveLawExcerpts({
      text: fullQuestionText,
      topicTitle,
    })
      .then((resolved) => {
        if (active) {
          setExcerpts(resolved);
        }
      })
      .catch(() => {
        if (active) {
          setExcerpts([]);
        }
      });

    return () => {
      active = false;
    };
  }, [questionId, statement, topicTitle]);

  return excerpts;
}

