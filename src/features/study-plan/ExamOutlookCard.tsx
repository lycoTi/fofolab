import { MetricExplainer } from '../../components/MetricExplainer';
import type { ExamOutlook } from '../../lib/examProjection';
import type { MetricExplanation } from '../../lib/explainabilityEngine';
import { formatDuration } from '../../lib/timeFormat';

/** Lista do que fica para depois: o bastante para decidir, sem virar um edital inteiro. */
const LEFT_LIST_MAX = 30;
/** Prova projetada com 90%+ está em dia. */
const PART_OK = 90;

/** "28/11": a véspera do primeiro dia da reta final. */
function dayBefore(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const d = new Date(year, month - 1, day - 1);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function explanation(outlook: ExamOutlook): MetricExplanation {
  const { estimate, source, sample } = outlook.topicMinutes;
  const sourceLine: Record<ExamOutlook['topicMinutes']['source'], string> = {
    AUTOAVALIACAO:
      'Esse tempo vem da sua autoavaliação (Nunca vi 02:00 · Já vi por cima 01:30 · Sei bem 01:00 · Domino 00:30). Conforme você estuda, ele passa a usar o seu ritmo real.',
    MISTO: `Mistura a sua autoavaliação com o seu ritmo real (${sample} ${sample === 1 ? 'tópico medido' : 'tópicos medidos'} nas últimas 4 semanas).`,
    RITMO_REAL: `Vem do seu ritmo real (${sample} tópicos medidos nas últimas 4 semanas).`,
  };
  return {
    title: 'Como o "Dá tempo?" é calculado',
    humanSummary: `Cada tópico novo leva cerca de ${formatDuration(estimate)}.`,
    bulletPoints: [
      sourceLine[source],
      'As horas são as do seu plano: dias de estudo, folgas e semanas diferentes, sem a Revisão da semana.',
      'A divisão entre as matérias segue o seu ciclo; quando uma matéria acaba, o tempo dela vai para as outras.',
      'A conta supõe que esse tempo vai para tópicos novos. Como o roteiro às vezes repete um tópico, o número tende a ser otimista: compare com o seu ritmo real.',
    ],
  };
}

function partTag(code: string, coverage: number, warning: string | null): { label: string; className: string } {
  if (warning?.startsWith(`${code} `)) return { label: 'atenção', className: 'text-amber-300' };
  if (coverage >= PART_OK) return { label: 'em dia', className: 'text-emerald-300' };
  return { label: 'foco', className: 'text-orange-300' };
}

/**
 * "Dá tempo?" (spec 13 §4.3, visão C): a resposta direta pelo plano, o ritmo real quando está bem abaixo dele, o que
 * fazer se não der (mais horas por semana ou o que fica para depois) e cada prova. Informação: quem decide é o estudante.
 */
export function ExamOutlookCard({ outlook, onAdjust }: { outlook: ExamOutlook | null; onAdjust: () => void }) {
  return (
    <section aria-label="Dá tempo?" className="space-y-3.5 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dá tempo?</h3>
        {outlook && outlook.status === 'PROJETANDO' && <MetricExplainer explanation={explanation(outlook)} />}
      </div>
      <OutlookBody outlook={outlook} onAdjust={onAdjust} />
    </section>
  );
}

function OutlookBody({ outlook, onAdjust }: { outlook: ExamOutlook | null; onAdjust: () => void }) {
  if (!outlook) return <p className="text-xs text-slate-400">Defina a data da prova no edital para ver o caminho até ela.</p>;
  if (outlook.status === 'PROVA_PASSOU') return <p className="text-xs text-slate-400">A prova já passou.</p>;
  if (outlook.status === 'RETA_FINAL') return <p className="text-xs text-slate-300">Reta final: só revisão e questões até a prova.</p>;
  if (outlook.totalTopics === 0) {
    return <p className="text-xs text-slate-400">Importe o conteúdo do edital para ver quanto dá para cobrir até a prova.</p>;
  }

  const left = outlook.leftForLater;
  return (
    <>
      <div>
        <p className="text-2xl font-bold tracking-tight text-white">{`${outlook.coverageAtStretch}% do edital visto até ${dayBefore(outlook.stretchStartKey)}`}</p>
        <p className="text-xs text-slate-400">Depois disso, reta final: só revisão e questões até a prova.</p>
        {outlook.real && (
          <p className="pt-1 text-xs text-amber-200">
            {`No seu ritmo recente (${formatDuration(outlook.real.weeklyMinutes)} por semana): ${outlook.real.coverageAtStretch}%.`}
          </p>
        )}
      </div>

      {left.length > 0 && (
        <div className="space-y-2 border-t border-slate-800 pt-3 text-xs text-slate-300">
          <ExtraHours outlook={outlook} onAdjust={onAdjust} />
          {left.length > 0 && (
            <details open={!outlook.fits}>
              <summary className="cursor-pointer select-none text-slate-300 hover:text-white">
                {`${left.length} ${left.length === 1 ? 'tópico de menor prioridade fica' : 'tópicos de menor prioridade ficam'} para depois`}
              </summary>
              <ul className="mt-2 space-y-0.5 text-slate-400">
                {left.slice(0, LEFT_LIST_MAX).map((t) => (
                  <li key={t.id}>{`${t.code ?? ''} ${t.title}`.trim()}</li>
                ))}
                {left.length > LEFT_LIST_MAX && <li>{`e mais ${left.length - LEFT_LIST_MAX}`}</li>}
              </ul>
            </details>
          )}
        </div>
      )}

      {outlook.parts.length > 0 && (
        <div className="border-t border-slate-800 pt-3">
          <ul className="divide-y divide-slate-800">
            {outlook.parts.map((part) => {
              const tag = partTag(part.code, part.coverageAtStretch, outlook.partWarning);
              return (
                <li key={part.code} className="grid grid-cols-[2rem_minmax(0,1fr)_6rem_2.75rem_4rem] items-center gap-3 py-1.5 text-xs">
                  <span className="font-semibold text-slate-100">{part.code}</span>
                  <span className="truncate text-slate-400">{part.name}</span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
                    <span className="block h-full rounded-full bg-orange-500" style={{ width: `${part.coverageAtStretch}%` }} />
                  </span>
                  <span className="text-right font-mono tabular-nums text-slate-200">{`${part.coverageAtStretch}%`}</span>
                  <span className={`text-right ${tag.className}`}>{tag.label}</span>
                </li>
              );
            })}
          </ul>
          {outlook.partWarning && <p className="pt-2 text-xs text-amber-200">{outlook.partWarning}</p>}
        </div>
      )}
    </>
  );
}

/**
 * O que fazer se não der: o acréscimo por semana quando ele é realista (até o dobro do plano e 08:00 por dia de estudo);
 * senão, dizer que não cabe — um botão de "+44:30" faria parecer viável o que não é.
 */
function ExtraHours({ outlook, onAdjust }: { outlook: ExamOutlook; onAdjust: () => void }) {
  const needed = outlook.plannedWeeklyMinutes + outlook.extraWeeklyMinutes;
  const until = dayBefore(outlook.stretchStartKey);
  if (!outlook.fits) {
    const how = outlook.extraWeeklyMinutes > 0
      ? `: seriam ${formatDuration(needed)} por semana (hoje: ${formatDuration(outlook.plannedWeeklyMinutes)}).`
      : ' nem com muito mais horas.';
    return <p className="text-slate-300">{`Não cabe até ${until}${how} O plano segue pela prioridade; estes ficam para depois:`}</p>;
  }
  return (
    <p className="flex flex-wrap items-center gap-2">
      Para ver tudo antes da reta final:
      <button
        type="button"
        onClick={onAdjust}
        title="Abre o Ajustar, para mudar as horas"
        className="rounded-lg border border-orange-500/60 px-2 py-0.5 font-mono text-orange-200 transition-all duration-100 hover:bg-orange-500/10 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        {`+${formatDuration(outlook.extraWeeklyMinutes)} por semana`}
      </button>
      <span className="text-slate-500">{`(de ${formatDuration(outlook.plannedWeeklyMinutes)} para ${formatDuration(needed)})`}</span>
    </p>
  );
}

