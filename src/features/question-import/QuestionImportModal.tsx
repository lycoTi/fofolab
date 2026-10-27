import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileSearch, FileUp, X } from 'lucide-react';
import { parseQuestionImport, toImportItems, type QuestionParseResult } from '../../lib/questionImport';
import type { ImportQuestionItem, StudyPlan, Subject, Topic } from '../../types/database';

interface QuestionImportModalProps {
  isOpen: boolean;
  plan: StudyPlan;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  defaultSubjectId: string | null;
  defaultTopicId: string | null;
  onClose: () => void;
  onImport: (
    subjectId: string,
    items: ImportQuestionItem[]
  ) => { inserted: number; skippedDuplicates: number };
  /** Segunda opção da tela: o acervo da Cebraspe (spec 12c §5.2), montado fora deste modal. */
  acervoPanel?: ReactNode;
}

type ImportMode = 'paste' | 'acervo';

const MODE_SUBTITLE: Record<ImportMode, string> = {
  paste: 'Cole as questões copiadas da prova (cada uma terminando com a linha "Gabarito:") ou uma lista em JSON.',
  acervo: 'Questões da Cebraspe já classificadas por assunto, ligadas aos tópicos do seu plano.',
};

export const IMPORT_TEXT_EXAMPLE = `1. (FGV/CGU/2022) [tópico 1.1] Segundo a ISSAI 100, os componentes do risco de auditoria são:
A) Risco de controle, operacional e de reputação.
B) Risco inerente, fiscal e de amostragem.
C) Risco inerente, de controle e de detecção.
D) Risco de detecção, de fraude e estratégico.
Gabarito: C

2. (Cebraspe/BACEN/2024) O DICT é operado diretamente pelo Banco Central do Brasil.
Gabarito: Certo`;

const JSON_EXAMPLE = `[{ "enunciado": "...", "alternativas": ["A) ...", "B) ..."], "gabarito": "B",
   "banca": "FGV", "ano": 2024, "orgao": "CGU", "topico": "1.2" }]`;

export function QuestionImportModal({
  isOpen,
  plan,
  subjects,
  topicsBySubject,
  defaultSubjectId,
  defaultTopicId,
  onClose,
  onImport,
  acervoPanel,
}: QuestionImportModalProps) {
  const [mode, setMode] = useState<ImportMode>('paste');
  const [text, setText] = useState('');
  const [subjectId, setSubjectId] = useState<string>(defaultSubjectId ?? subjects[0]?.id ?? '');
  const [defaultTopic, setDefaultTopic] = useState<string>(defaultTopicId ?? '');
  const [board, setBoard] = useState(plan.exam_board ?? '');
  const [organ, setOrgan] = useState(plan.organ ?? '');
  const [year, setYear] = useState(new Date().getFullYear());
  const [showFormat, setShowFormat] = useState(false);
  const [parsed, setParsed] = useState<QuestionParseResult | null>(null);
  const [result, setResult] = useState<{ inserted: number; skippedDuplicates: number } | null>(null);

  // Só ao ABRIR: os dados da tela são recarregados depois de importar e isso não pode zerar o formulário
  useEffect(() => {
    if (!isOpen) return;
    setSubjectId(defaultSubjectId ?? subjects[0]?.id ?? '');
    setDefaultTopic(defaultTopicId ?? '');
    setBoard(plan.exam_board ?? '');
    setOrgan(plan.organ ?? '');
    setResult(null);
  }, [isOpen]);

  const subjectTopics = useMemo(() => topicsBySubject[subjectId] ?? [], [topicsBySubject, subjectId]);

  const items = useMemo(() => {
    if (!parsed) return [];
    return toImportItems(parsed.questions, {
      subjectTopics,
      defaultTopicId: defaultTopic || null,
      defaults: { examBoard: board.trim() || 'Banca não informada', examYear: year, organ: organ.trim() || null },
    });
  }, [parsed, subjectTopics, defaultTopic, board, year, organ]);

  if (!isOpen) return null;

  const topicLabel = (topicId: string | null) => {
    if (!topicId) return 'Sem tópico (só disciplina)';
    const topic = subjectTopics.find((t) => t.id === topicId);
    return topic ? `${topic.code ?? ''} ${topic.title}`.trim() : 'Tópico';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Importar questões"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileUp size={16} className="text-orange-400" />
              Importar Questões
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{MODE_SUBTITLE[mode]}</p>
            {acervoPanel && (
              <div className="mt-3 flex gap-1 text-xs" role="group" aria-label="De onde vêm as questões">
                {(['paste', 'acervo'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={`rounded-lg border px-3 py-1.5 ${mode === m ? 'border-orange-500 bg-orange-500/15 text-orange-100' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                  >
                    {m === 'paste' ? 'Colar questões' : 'Acervo da Cebraspe (pacote do minerador)'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            aria-label="Fechar importação"
          >
            <X size={16} />
          </button>
        </div>

        {mode === 'acervo' && <div className="flex-1 overflow-y-auto p-6 text-xs">{acervoPanel}</div>}
        {mode === 'paste' && (
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setParsed(null);
                setResult(null);
              }}
              aria-label="Texto das questões"
              placeholder={IMPORT_TEXT_EXAMPLE}
              className="w-full h-72 p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200 focus:border-orange-500 outline-none resize-y"
            />

            <button
              type="button"
              onClick={() => setShowFormat((v) => !v)}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center justify-between"
            >
              <span>Ver formatos aceitos</span>
              {showFormat ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showFormat && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-[11px] text-slate-300">
                <p>
                  <strong>Texto:</strong> número opcional, depois <code>(Banca/Órgão/Ano)</code> e <code>[tópico 1.2]</code>{' '}
                  opcionais, o enunciado, as alternativas <code>A)</code> a <code>E)</code> e a linha{' '}
                  <code>Gabarito: X</code>. Itens Certo/Errado: só o enunciado e <code>Gabarito: Certo</code>.
                </p>
                <pre className="whitespace-pre-wrap text-slate-400">{IMPORT_TEXT_EXAMPLE}</pre>
                <p>
                  <strong>JSON</strong> (o mesmo formato que a futura leitura automática do PDF da prova vai gerar):
                </p>
                <pre className="whitespace-pre-wrap text-slate-400">{JSON_EXAMPLE}</pre>
                <p className="text-slate-500">Questões anuladas e repetidas (mesmo enunciado na disciplina) são ignoradas.</p>
              </div>
            )}

            <button
              type="button"
              disabled
              title="Em breve: precisa da IA configurada e de testes com PDFs reais de provas"
              className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-800 text-slate-500 flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
              <FileSearch size={14} />
              Ler direto do PDF da prova + gabarito (em breve)
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 grid grid-cols-2 gap-2.5">
              <label className="col-span-2 space-y-1">
                <span className="text-slate-400">Disciplina</span>
                <select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setDefaultTopic('');
                  }}
                  aria-label="Disciplina das questões"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white outline-none"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 space-y-1">
                <span className="text-slate-400">Tópico (quando a questão não indicar [tópico X.Y])</span>
                <select
                  value={defaultTopic}
                  onChange={(e) => setDefaultTopic(e.target.value)}
                  aria-label="Tópico padrão"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white outline-none"
                >
                  <option value="">Sem tópico (só a disciplina)</option>
                  {subjectTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Banca padrão</span>
                <input
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Órgão padrão</span>
                <input
                  value={organ}
                  onChange={(e) => setOrgan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Ano padrão</span>
                <input
                  type="number"
                  value={year}
                  min={1990}
                  max={2100}
                  onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white outline-none"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={!text.trim() || !subjectId}
                  onClick={() => {
                    setParsed(parseQuestionImport(text));
                    setResult(null);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold disabled:opacity-40"
                >
                  Analisar
                </button>
              </div>
            </div>

            {parsed && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">
                    <strong className="text-white">{parsed.questions.length}</strong> questão(ões) prontas
                    {parsed.issues.length > 0 && (
                      <>
                        {' '}• <strong className="text-amber-300">{parsed.issues.length}</strong> com problema
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={items.length === 0 || result !== null}
                    onClick={() => setResult(onImport(subjectId, items))}
                    className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-40"
                  >
                    Importar {items.length} questão(ões)
                  </button>
                </div>

                {result && (
                  <div
                    role="status"
                    className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 flex items-center gap-2"
                  >
                    <CheckCircle2 size={14} />
                    {result.inserted} importada(s)
                    {result.skippedDuplicates > 0 && ` • ${result.skippedDuplicates} já existiam e foram ignoradas`}.
                  </div>
                )}

                {parsed.issues.map((issue) => (
                  <div
                    key={`${issue.block}-${issue.message}`}
                    className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 flex gap-2"
                  >
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">
                        Bloco {issue.block}: {issue.message}
                      </div>
                      <div className="text-[11px] text-amber-200/70">{issue.excerpt}</div>
                    </div>
                  </div>
                ))}

                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div key={`${idx}-${item.statement.slice(0, 20)}`} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-400">
                        {item.examBoard} • {item.examYear}
                        {item.organ ? ` • ${item.organ}` : ''} • {topicLabel(item.topicId)}
                      </div>
                      <p className="text-slate-200 line-clamp-2">{item.statement}</p>
                      <div className="text-[11px] text-slate-400">
                        {item.options.length} alternativas • Gabarito{' '}
                        <strong className="text-emerald-300">{item.finalAnswer}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
