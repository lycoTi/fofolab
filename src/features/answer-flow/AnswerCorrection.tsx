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
  firstContact = false,
  children,
}: {
  question: Question;
  isCorrect: boolean;
  dissection: AiDissection | null;
  /** Abriu a explicação antes de responder: acolhe como primeiro contato, sem "acertou/errou". */
  firstContact?: boolean;
  children?: ReactNode;
}) {
  const options = parseQuestionOptions(question.options_json);
  const correct = findCorrectOption(options, question.final_answer);
  const key = question.final_answer.trim().toUpperCase();
  const name = correct ? optionName(correct, isCertoErradoOptions(options)) : key;

  return (
    <section
      aria-label="Correção da questão"
      className="fofolab-enter space-y-4 rounded-2xl border border-white/[0.08] bg-[#0E121B] p-5 sm:p-6 shadow-sm transition-colors"
    >
      <Verdict isCorrect={isCorrect} firstContact={firstContact} />
      <div className="flex items-center gap-2 text-xs text-slate-300">
        <span className="font-semibold text-slate-100">{`Gabarito: ${key}`}</span>
        {name !== key && <span className="text-slate-400">{`· ${name}`}</span>}
      </div>
      {dissection && (
        <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
          <RichText text={dissection.dissection_markdown} className="text-xs sm:text-sm leading-relaxed text-slate-200" />
          {dissection.provider_used === 'EXAMPLE' && (
            <p className="text-[10px] text-slate-500 pt-1">Explicação de exemplo, escrita à mão para demonstrar o app.</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function Verdict({ isCorrect, firstContact }: { isCorrect: boolean; firstContact: boolean }) {
  if (firstContact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200">
        <span>Em mapeamento inicial: primeiro contato com esta questão.</span>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold ${
        isCorrect
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      }`}
    >
      {isCorrect ? <CheckCircle2 size={16} className="shrink-0 text-emerald-400" /> : <CircleHelp size={16} className="shrink-0 text-amber-400" />}
      <span>{isCorrect ? 'Você acertou.' : 'Não foi desta vez. Errar agora ajuda a fixar a resposta certa.'}</span>
    </div>
  );
}
