import { useState } from 'react';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  FolderGit2,
  GraduationCap,
  HelpCircle,
  Layers,
  Network,
  Play,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';

type WorkbenchTab = 'notebooks' | 'questions' | 'pdf' | 'cycle' | 'graph';
type AppMode = 'student' | 'admin';

const INITIAL_SUBJECTS = [
  {
    id: 'auditoria',
    name: 'Auditoria Governamental',
    category: 'ESPECIFICO',
    mastery: 74,
    cycleMinutes: 90,
    topics: [
      { id: 't1', code: '1.1', title: 'Normas Internacionais de Auditoria (ISSAI / NBC TA)', mastery: 82, pdfPage: '24/68' },
      { id: 't2', code: '1.2', title: 'Controle Interno na Administração Pública Federal (CGU)', mastery: 68, pdfPage: '12/45' },
    ],
  },
  {
    id: 'ti-dev',
    name: 'TI — Desenvolvimento & Arquitetura',
    category: 'ESPECIFICO',
    mastery: 86,
    cycleMinutes: 60,
    topics: [
      { id: 't3', code: '2.1', title: 'Arquitetura Limpa, Microsserviços e APIs REST', mastery: 91, pdfPage: '40/40' },
      { id: 't4', code: '2.2', title: 'Segurança de Aplicações (OWASP Top 10)', mastery: 79, pdfPage: '18/32' },
    ],
  },
  {
    id: 'contabilidade',
    name: 'Contabilidade Pública (CASP)',
    category: 'ESPECIFICO',
    mastery: 42,
    cycleMinutes: 120,
    topics: [
      { id: 't5', code: '3.1', title: 'Plano de Contas Aplicado ao Setor Público (PCASP)', mastery: 38, pdfPage: '9/95' },
      { id: 't6', code: '3.2', title: 'Demonstrações Contábeis Aplicadas ao Setor Público (DCASP)', mastery: 45, pdfPage: '5/70' },
    ],
  },
];

export default function App() {
  const [mode, setMode] = useState<AppMode>('student');
  const [selectedSubjectId, setSelectedSubjectId] = useState('auditoria');
  const [selectedTopicId, setSelectedTopicId] = useState('t1');
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('questions');
  const [lastDiagnosis, setLastDiagnosis] = useState<string | null>(null);

  const currentSubject = INITIAL_SUBJECTS.find((s) => s.id === selectedSubjectId) || INITIAL_SUBJECTS[0];
  const currentTopic = currentSubject.topics.find((t) => t.id === selectedTopicId) || currentSubject.topics[0];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar Esquerda: Identidade FofoLab + Árvore do Edital */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900/70 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-xl shadow-lg shadow-orange-500/20">
              🐹
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight flex items-center gap-1.5">
                FofoLab <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-semibold">v0.1</span>
              </h1>
              <p className="text-xs text-slate-400">Bancada de Estudos Local</p>
            </div>
          </div>

          <button
            onClick={() => setMode(mode === 'student' ? 'admin' : 'student')}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition ${
              mode === 'admin'
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Alternar entre Visão Estudante e Fábrica Admin"
          >
            {mode === 'admin' ? <Wrench size={14} /> : <GraduationCap size={14} />}
            {mode === 'admin' ? 'Admin' : 'Estudo'}
          </button>
        </div>

        {/* Plano Ativo / Meta CGU */}
        <div className="p-3 mx-3 mt-3 rounded-xl bg-slate-800/70 border border-slate-700/70">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>🎯 Edital Ativo</span>
            <span className="text-orange-400 font-semibold">Foco: CGU + BACEN</span>
          </div>
          <p className="text-sm font-semibold text-white truncate">CGU — Auditor Federal (TI)</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
            <span>Meta: 4h30/dia</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              SQLite Sincronizado
            </span>
          </div>
        </div>

        {/* Lista de Disciplinas e Tópicos */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
            Disciplinas do Ciclo
          </div>
          {INITIAL_SUBJECTS.map((subj) => {
            const isSelected = subj.id === currentSubject.id;
            return (
              <div
                key={subj.id}
                className={`rounded-xl border transition ${
                  isSelected
                    ? 'bg-slate-800/90 border-orange-500/40'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <button
                  onClick={() => {
                    setSelectedSubjectId(subj.id);
                    setSelectedTopicId(subj.topics[0].id);
                  }}
                  className="w-full text-left p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-100">{subj.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ciclo: {subj.cycleMinutes} min • Domínio: {subj.mastery}%
                    </p>
                  </div>
                  <div className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-900 text-orange-300">
                    {subj.mastery}%
                  </div>
                </button>

                {isSelected && (
                  <div className="px-2 pb-2 space-y-1 border-t border-slate-700/50 pt-2">
                    {subj.topics.map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => setSelectedTopicId(topic.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                          topic.id === currentTopic.id
                            ? 'bg-orange-500/20 text-orange-200 font-medium'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span className="truncate pr-2">
                          {topic.code} {topic.title}
                        </span>
                        <span className="text-[10px] opacity-80">{topic.mastery}%</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Área Principal: Bancada do Tópico ou Fábrica Admin */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {mode === 'student' ? (
          <>
            {/* Header da Bancada do Tópico */}
            <header className="border-b border-slate-800 bg-slate-900/40 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-orange-400 font-medium">
                  <span>{currentSubject.name}</span>
                  <span>•</span>
                  <span>Tópico {currentTopic.code}</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-0.5">{currentTopic.title}</h2>
              </div>

              {/* Cronômetro Rápido do Ciclo */}
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
                  <Clock size={14} className="text-orange-400" />
                  <span className="font-mono text-sm font-semibold">00:49:12</span>
                  <button className="ml-1 p-1 rounded bg-orange-500 hover:bg-orange-600 text-white">
                    <Play size={12} />
                  </button>
                </div>
              </div>
            </header>

            {/* Abas da Bancada (Tudo conectado ao mesmo Tópico) */}
            <div className="px-6 pt-3 border-b border-slate-800 flex items-center gap-2 bg-slate-900/20">
              {[
                { id: 'questions', label: 'Questões & Destrinchador IA', icon: HelpCircle },
                { id: 'notebooks', label: 'Cadernos do Tópico', icon: BookOpen },
                { id: 'pdf', label: `PDF Ancorado (${currentTopic.pdfPage})`, icon: FileText },
                { id: 'cycle', label: 'Equilíbrio do Ciclo', icon: Layers },
                { id: 'graph', label: 'Grafo de Micro-tópicos', icon: Network },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as WorkbenchTab)}
                    className={`px-4 py-2.5 text-xs font-medium rounded-t-lg border-b-2 flex items-center gap-2 transition ${
                      active
                        ? 'border-orange-500 text-orange-300 bg-slate-900/70'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Conteúdo da Bancada */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Esquerda: Questão Oficial da Banca */}
              <div className="lg:col-span-7 space-y-4">
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                      FGV • CGU — Auditor Federal de Finanças e Controle
                    </span>
                    <span className="text-slate-400">Gabarito Pós-Recurso: Letra C</span>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-200">
                    No âmbito das Normas Internacionais de Auditoria Aplicadas ao Setor Público (ISSAI), o risco de
                    auditoria compreende o risco de que o auditor expresse uma conclusão inadequada caso o objeto
                    contenha distorção relevante. Assinale a alternativa que relaciona corretamente os três componentes
                    do risco de auditoria:
                  </p>

                  <div className="space-y-2 text-xs">
                    {[
                      'A) Risco de Controle, Risco Operacional e Risco de Reputação.',
                      'B) Risco Inerente, Risco Fiscal e Risco de Amostragem.',
                      'C) Risco Inerente, Risco de Controle e Risco de Detecção.',
                      'D) Risco de Detecção, Risco de Fraude e Risco Estratégico.',
                    ].map((opt, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border ${
                          idx === 2
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 font-medium'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>

                  {/* Diagnóstico Pós-Questão de 1 Clique (Sem Viés de IA!) */}
                  <div className="pt-3 border-t border-slate-800">
                    <p className="text-xs text-slate-400 mb-2">
                      🏷️ <strong>Auto-Diagnóstico Rápido (1 clique):</strong> Consultar a IA não reduz sua nota! Diga
                      como foi resolver esta questão:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'MASTERED', label: '🟢 Dominei / Só revisei', desc: '+Domínio' },
                        { id: 'DOUBT', label: '🟡 Acertei na dúvida', desc: 'Revisar em 7d' },
                        { id: 'BOARD_TRAP', label: '🟠 Pegadinha da Banca', desc: 'Não reduz base' },
                        { id: 'BASE_GAP', label: '🔴 Lacuna de Base', desc: '+Tempo no Ciclo' },
                      ].map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => setLastDiagnosis(btn.label)}
                          className={`p-2 rounded-xl border text-left transition ${
                            lastDiagnosis === btn.label
                              ? 'bg-orange-500/20 border-orange-500 text-white'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="text-xs font-semibold">{btn.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{btn.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Destrinchador IA (Cache SQLite -> Gemini Free -> DeepSeek) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col h-full space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-orange-400" />
                      <h3 className="text-sm font-bold">Destrinchador IA & Caderno</h3>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      ⚡ Cache Local SQLite (0 tokens)
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <p className="font-semibold text-orange-300">📌 Mnemônico & Pré-requisito (ISSAI 100):</p>
                    <p>
                      <strong>Risco de Auditoria = RI × RC × RD</strong>
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        <strong>Risco Inerente (RI) + Risco de Controle (RC):</strong> Existem na entidade auditada
                        (independem do auditor).
                      </li>
                      <li>
                        <strong>Risco de Detecção (RD):</strong> Único controlado diretamente pelo auditor (ajustando o
                        tamanho da amostra e os testes substantivos).
                      </li>
                    </ul>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button className="flex-1 py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={14} />
                      Anexar Síntese ao Caderno do Tópico
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Visão Fábrica Admin: Trilhas Prontas, Dossiês & Blueprint das Bancas */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Wrench className="text-purple-400" size={20} />
                Modo Administrador ("A Fábrica" do FofoLab)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Gerencie o Catálogo de Trilhas Prontas, Dossiês de Pesquisa Profunda e o Verificador de Blueprint das
                Bancas antes de exportar pacotes <code>.fofopack</code> para seus amigos e sobrinhos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FolderGit2 size={16} className="text-orange-400" />
                  Catálogo de Trilhas Prontas
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span>Trilha Federal — Controle & TI (CGU / TCU)</span>
                    <span className="text-emerald-400 font-semibold">🟢 Catalogada</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span>Trilha Autarquias — BACEN (Autorizado)</span>
                    <span className="text-amber-400 font-semibold">🟡 Em Dossiê</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span>Trilha Tribunais / Direito / Estadual & Municipal</span>
                    <span className="text-slate-400">⚪ No Radar</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShieldAlert size={16} className="text-purple-400" />
                  Blueprint de Layout das Bancas (DOM Drift Check)
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span>FGV Conhecimento (Provas + Gabarito Pós-Recurso)</span>
                    <span className="text-emerald-400 font-semibold">🟢 Layout Intacto</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span>Cebraspe (Com verificação de Anuladas)</span>
                    <span className="text-emerald-400 font-semibold">🟢 Layout Intacto</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between">
                    <span>Roteador IA: Google AI Studio Free ➔ DeepSeek V3</span>
                    <span className="text-emerald-400 font-semibold">🟢 Trava R$ 50 Ativa</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
