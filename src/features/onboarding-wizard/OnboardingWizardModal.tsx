import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Compass, FileUp, Sparkles, Target, X } from 'lucide-react';
import type { SelfAssessmentInput, StudyMoment, StudyPlan, StudyStrategy } from '../../types/database';
import {
  initialSelfAssessment,
  SelfAssessmentStep,
  type SelfAssessmentState,
  type SelfAssessmentSubject,
} from './SelfAssessmentStep';

export interface OnboardingProfile {
  studyMoment: StudyMoment;
  dailyHours: number;
  weeklyHours: number;
  strategyMode: StudyStrategy;
  /** Revisão do dia ao abrir o app; desligada para quem já tem o próprio método de revisão. */
  dailyReviewEnabled: boolean;
  /** Aquecimento antes da aula num tópico nunca tentado; desligado = "Tenho meu método". */
  productiveFailureHints: boolean;
}

interface OnboardingWizardModalProps {
  isOpen: boolean;
  plans: StudyPlan[];
  activePlan: StudyPlan;
  onClose: () => void;
  onComplete: (profile: OnboardingProfile, targetPlanId: string, selfAssessment: SelfAssessmentInput) => void;
  /** Matérias do plano com os tópicos de primeiro nível, para a autoavaliação. */
  getPlanContent: (planId: string) => SelfAssessmentSubject[];
  /** Abre a importação do edital em PDF (o assistente fecha e volta depois, com o plano novo). */
  onImportEdital?: () => void;
  /** Passo em que abre (ex.: logo após importar o edital, pula o "momento"). */
  initialStep?: number;
}

export const ONBOARDING_COMPLETED_KEY = 'fofolab_onboarding_completed_v1';

const TOTAL_STEPS = 5;
const SELF_ASSESSMENT_STEP = 4;

/** Estratégia sugerida para cada momento (o estudante pode trocar no passo 4). */
const STRATEGY_FOR_MOMENT: Record<StudyMoment, StudyStrategy> = {
  PRE_EDITAL: 'BASE_COMUM',
  POS_EDITAL: 'ALTO_PESO_CURTO',
};

function profileFromPlan(plan: StudyPlan): OnboardingProfile {
  const studyMoment = plan.study_moment ?? 'PRE_EDITAL';
  const weeklyHours = plan.weekly_hours_target || 10.5;
  return {
    studyMoment,
    dailyHours: Math.round((weeklyHours / 7) * 10) / 10,
    weeklyHours,
    strategyMode: plan.strategy_mode ?? STRATEGY_FOR_MOMENT[studyMoment],
    dailyReviewEnabled: plan.daily_review_enabled !== 0,
    productiveFailureHints: plan.productive_failure_hints !== 0,
  };
}

export function OnboardingWizardModal({
  isOpen,
  plans,
  activePlan,
  onClose,
  onComplete,
  getPlanContent,
  onImportEdital,
  initialStep = 1,
}: OnboardingWizardModalProps) {
  const [step, setStep] = useState<number>(1);
  const [profile, setProfile] = useState<OnboardingProfile>(() => profileFromPlan(activePlan));
  const [strategyTouched, setStrategyTouched] = useState<boolean>(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(activePlan.id);
  const planContent = useMemo(
    () => (isOpen ? getPlanContent(selectedPlanId) : []),
    [isOpen, selectedPlanId]
  );
  const [selfAssessment, setSelfAssessment] = useState<SelfAssessmentState>(() => initialSelfAssessment([]));
  useEffect(() => setSelfAssessment(initialSelfAssessment(planContent)), [planContent]);

  // Ao (re)abrir, parte do que já está gravado no plano ativo ("Recalibrar Perfil").
  // Só na abertura: recarregar os dados com o assistente aberto não pode voltar ao passo 1.
  useEffect(() => {
    if (!isOpen) return;
    setStep(initialStep);
    setProfile(profileFromPlan(activePlan));
    setStrategyTouched(Boolean(activePlan.strategy_mode));
    setSelectedPlanId(activePlan.id);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    // O perfil vai para o plano (banco); aqui só fica a marca de "assistente já visto"
    try {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch (e) {
      console.warn('Erro ao salvar a conclusão do assistente:', e);
    }
    onComplete(profile, selectedPlanId, {
      subjects: Object.entries(selfAssessment.subjectLevels).map(([subjectId, level]) => ({ subjectId, level })),
      topics: planContent.flatMap(({ topics }) =>
        topics.map((t) => ({ topicId: t.id, level: selfAssessment.topicLevels[t.id] ?? null }))
      ),
    });
    onClose();
  };

  const selectMoment = (studyMoment: StudyMoment) =>
    setProfile((p) => ({
      ...p,
      studyMoment,
      strategyMode: strategyTouched ? p.strategyMode : STRATEGY_FOR_MOMENT[studyMoment],
    }));

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-6 text-slate-100">
        {/* Cabeçalho do Wizard */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-xl shadow-lg shadow-orange-500/20">
              🐹
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Calibrar Meu Roteiro de Estudos</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  Passo {step} de {TOTAL_STEPS}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Pegando você pela mão para estudar sem sobrecarga</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Fechar assistente"
          >
            <X size={16} />
          </button>
        </div>

        {/* Barra de Progresso visual */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Passo 1: Momento de Estudo */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Compass size={16} className="text-orange-400" />
                Qual o seu momento atual de preparação?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Isso define se o FofoLab vai focar em construir sua base com calma ou priorizar o que mais cai para a prova.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  id: 'PRE_EDITAL' as const,
                  title: '🛡️ Modo Pré-Edital (Recomendado)',
                  subtitle: 'Construção da base sólida nas matérias principais com antecedência, sem pressa nem sufoco.',
                },
                {
                  id: 'POS_EDITAL' as const,
                  title: '🔥 Modo Pós-Edital (Edital Publicado)',
                  subtitle: 'Tiro curto e intensivo. Foco total em custo-benefício e descarte de tópicos com baixo retorno.',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectMoment(opt.id)}
                  className={`p-4 rounded-xl border text-left transition ${
                    profile.studyMoment === opt.id
                      ? 'bg-orange-500/15 border-orange-500 text-white shadow-lg shadow-orange-500/10'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-orange-200">{opt.title}</div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{opt.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Passo 2: Disponibilidade Diária Real */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock size={16} className="text-orange-400" />
                Quanto tempo real você consegue estudar por dia?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Seja realista com sua rotina de casa e trabalho. Menos horas cumpridas com consistência vencem promessas exageradas!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { daily: 1.0, weekly: 7.0, label: '01:00 por dia (07:00 por semana)', desc: 'Perfeito para quem tem rotina puxada' },
                { daily: 1.5, weekly: 10.5, label: '01:30 por dia (10:30 por semana)', desc: 'Ritmo constante e sustentável' },
                { daily: 2.0, weekly: 14.0, label: '02:00 por dia (14:00 por semana)', desc: 'Equilíbrio ideal entre teoria e questões' },
                { daily: 3.0, weekly: 21.0, label: '03:00 por dia (21:00 por semana)', desc: 'Foco intenso e avanço rápido' },
                { daily: 4.5, weekly: 31.5, label: '04:30 por dia (31:30 por semana)', desc: 'Dedicação exclusiva / Reta final' },
              ].map((item) => (
                <button
                  key={item.daily}
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, dailyHours: item.daily, weeklyHours: item.weekly }))}
                  className={`p-3 rounded-xl border text-left transition ${
                    profile.dailyHours === item.daily
                      ? 'bg-orange-500/15 border-orange-500 text-white'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-orange-200">{item.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Passo 3: Área / Concurso Alvo */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target size={16} className="text-orange-400" />
                Qual edital você quer focar agora?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Você pode trocar ou adicionar editais a qualquer momento. Escolha o edital principal para carregar o edital verticalizado:
              </p>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`w-full p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
                    selectedPlanId === p.id
                      ? 'bg-orange-500/15 border-orange-500 text-white shadow-lg shadow-orange-500/10'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-white">
                      {p.organ ? `[${p.organ}] ` : ''}
                      {p.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Banca: <strong className="text-slate-300">{p.exam_board || 'FGV'}</strong> • Cargo: {p.role_title || 'Auditor'}
                    </div>
                  </div>
                  {selectedPlanId === p.id && <CheckCircle2 size={16} className="text-orange-400 shrink-0" />}
                </button>
              ))}
            </div>
            {onImportEdital && (
              <button
                type="button"
                onClick={onImportEdital}
                className="w-full p-3 rounded-xl border border-dashed border-slate-700 text-xs text-slate-300 hover:border-orange-500/50 hover:text-white flex items-center justify-center gap-2 transition"
              >
                <FileUp size={14} className="text-orange-400" />
                Importar edital em PDF (monta matérias, tópicos e pesos sozinho)
              </button>
            )}
          </div>
        )}

        {/* Passo 4: Quanto já sabe de cada matéria */}
        {step === SELF_ASSESSMENT_STEP && (
          <SelfAssessmentStep items={planContent} state={selfAssessment} onChange={setSelfAssessment} />
        )}

        {/* Passo 5: Estratégia de Custo-Benefício */}
        {step === TOTAL_STEPS && (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-orange-400" />
                Qual estratégia de Custo-Benefício você prefere?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                A estratégia ajusta a prioridade das matérias no seu ciclo (o efeito aparece em “Por que hoje?”):
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {[
                {
                  id: 'BASE_COMUM' as const,
                  title: '🛡️ Garantir 100% da Base Comum',
                  desc: 'Foco prioritário em Português, Dir. Administrativo, Constitucional e Raciocínio Lógico (o feijão com arroz que garante aprovação).',
                },
                {
                  id: 'MAIS_COBRADOS' as const,
                  title: '🎯 Atacar o que Mais Cai e Meus Pontos Fracos',
                  desc: 'Foco em análise empírica de provas anteriores da banca, atacando os tópicos mais recorrentes.',
                },
                {
                  id: 'ALTO_PESO_CURTO' as const,
                  title: '⚡ Alta Rentabilidade (Pós-Edital / Tempo Escasso)',
                  desc: 'Dedicação quase exclusiva às disciplinas de maior peso. Descarta tópicos densos de baixo retorno na prova.',
                },
              ].map((strat) => (
                <button
                  key={strat.id}
                  type="button"
                  onClick={() => {
                    setStrategyTouched(true);
                    setProfile((p) => ({ ...p, strategyMode: strat.id }));
                  }}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    profile.strategyMode === strat.id
                      ? 'bg-orange-500/15 border-orange-500 text-white'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-orange-200">{strat.title}</div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{strat.desc}</div>
                </button>
              ))}
            </div>

            <DailyReviewToggle
              checked={profile.dailyReviewEnabled}
              onChange={(dailyReviewEnabled) => setProfile((p) => ({ ...p, dailyReviewEnabled }))}
            />
            <PreferenceToggle
              title="Sugerir tentar antes da aula"
              hint="Num tópico novo, a FofoIA pede um palpite (e oferece questões) antes da aula. Desligue se você tem seu método."
              checked={profile.productiveFailureHints}
              onChange={(productiveFailureHints) => setProfile((p) => ({ ...p, productiveFailureHints }))}
            />
          </div>
        )}

        {/* Controles do Rodapé */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            type="button"
            disabled={step === 1}
            onClick={handlePrev}
            className="px-3.5 py-2 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 transition"
          >
            <ArrowLeft size={14} />
            Voltar
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-500/20 transition"
          >
            {step === TOTAL_STEPS ? (
              <>
                <span>Gerar Meu Roteiro de Hoje 🚀</span>
              </>
            ) : (
              <>
                <span>Continuar</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Revisão do dia (spec 09 §5.3): ligada por padrão; quem tem o próprio método de revisão pode desligar. */
function DailyReviewToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <PreferenceToggle title="Revisão do dia ao abrir o app" hint="Desligue se você já tem seu método de revisão." checked={checked} onChange={onChange} />
  );
}

function PreferenceToggle({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-orange-500" />
      <span className="space-y-0.5">
        <span className="block text-xs font-semibold text-slate-200">{title}</span>
        <span className="block text-[11px] text-slate-400">{hint}</span>
      </span>
    </label>
  );
}
