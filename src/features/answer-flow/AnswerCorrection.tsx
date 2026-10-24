import type { ReactNode } from 'react';
import { CheckCircle2, CircleHelp } from 'lucide-react';
import { RichText } from '../../components/RichText';
import { findCorrectOption, parseQuestionOptions } from '../../lib/questionOptions';
import type { AiDissection, Question } from '../../types/database';
import { isCertoErradoOptions, optionName } from './AnswerOptions';

/**
 * Correção logo depois de responder: veredito, gabarito oficial e a explicação guardada (se houver). `children` traz o
 * diagnóstico e as ações de quem usa (Próxima na revisão; FofoIA e "Gerar explicação" na aba Questões).
 */
export function AnswerCorrection({
  question,
  isCorrect,
  dissection,
  children,
}: {
  question: Question;
  isCorrect: boolean;
  dissection: AiDissection | null;
  children?: ReactNode;
}) {
  const options = parseQuestionOptions(question.options_json);
  const correct = findCorrectOption(options, question.final_answer);
  const key = question.final_answer.trim().toUpperCase();
  const name = correct ? optionName(correct, isCertoErradoOptions(options)) : key;
  return (
    <div className="fofolab-enter space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${isCorrect ? 'text-emerald-300' : 'text-amber-300'}`}>
        {isCorrect ? <CheckCircle2 size={15} /> : <CircleHelp size={15} />}
        {isCorrect ? 'Você acertou.' : 'Não foi desta vez. Errar agora ajuda a fixar a resposta certa.'}
      </p>
      <p className="text-xs text-slate-300">{`Gabarito: ${key}${name !== key ? ` · ${name}` : ''}`}</p>
      {dissection && (
        <div className="space-y-1">
          <RichText text={dissection.dissection_markdown} className="text-xs leading-relaxed text-slate-200" />
          {dissection.provider_used === 'EXAMPLE' && (
            <p className="text-[10px] text-slate-500">Explicação de exemplo, escrita à mão para demonstrar o app.</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
