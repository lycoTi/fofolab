import type {
  AdminBoardBlueprint,
  AiDissection,
  CareerTrack,
  Notebook,
  PdfSource,
  Question,
  StudyPlan,
  Subject,
  Topic,
  TopicLink,
} from '../types/database';

export const SEED_CAREER_TRACKS: CareerTrack[] = [
  {
    id: 'track-federal-controle',
    slug: 'federal-controle-ti',
    name: 'Trilha Federal — Controle & TI (CGU / TCU)',
    sphere: 'FEDERAL',
    catalog_status: 'CATALOGED',
    dossier_markdown:
      '# Dossiê Trilha Federal — Controle Interno & Externo\nFoco em ISSAI, NBC TA, Lei 10.180/2001, Arquitetura de Software, Segurança OWASP e Contabilidade Pública (PCASP/DCASP).',
    updated_at: '2026-10-20T12:00:00Z',
  },
  {
    id: 'track-autarquias-bacen',
    slug: 'autarquias-bacen-ti',
    name: 'Trilha Autarquias — BACEN & Regulação',
    sphere: 'FEDERAL',
    catalog_status: 'PARTIAL',
    dossier_markdown:
      '# Dossiê BACEN — Analista de TI e Finanças\nFoco em Engenharia de Software, Bancos de Dados, Cibersegurança, Pix/Open Finance e Sistema Financeiro Nacional.',
    updated_at: '2026-10-20T12:00:00Z',
  },
  {
    id: 'track-tribunais',
    slug: 'tribunais-ti-direito',
    name: 'Trilha Tribunais — TRT / TRF / TJ / TSE',
    sphere: 'TRIBUNAIS',
    catalog_status: 'RADAR',
    dossier_markdown: '# Dossiê Tribunais\nMapeamento em andamento para cargos de Analista Judiciário.',
    updated_at: '2026-10-20T12:00:00Z',
  },
];

export const SEED_STUDY_PLANS: StudyPlan[] = [
  {
    id: 'plan-cgu',
    track_id: 'track-federal-controle',
    title: 'CGU — Auditor Federal de Finanças e Controle (TI)',
    organ: 'CGU',
    exam_board: 'FGV',
    role_title: 'Auditor Federal de Finanças e Controle — Tecnologia da Informação',
    exam_date: '2027-03-15',
    weekly_hours_target: 31.5, // 4h30/dia
    is_active: 1,
    created_at: '2026-10-20T12:00:00Z',
  },
  {
    id: 'plan-bacen',
    track_id: 'track-autarquias-bacen',
    title: 'BACEN — Analista do Banco Central (TI)',
    organ: 'BACEN',
    exam_board: 'Cebraspe',
    role_title: 'Analista — Tecnologia da Informação',
    exam_date: '2027-05-20',
    weekly_hours_target: 28.0, // 4h/dia
    is_active: 0,
    created_at: '2026-10-20T12:00:00Z',
  },
];

export const SEED_SUBJECTS: Subject[] = [
  // === PLANO CGU ===
  {
    id: 'subj-cgu-auditoria',
    plan_id: 'plan-cgu',
    category: 'ESPECIFICO',
    name: 'Auditoria Governamental',
    color: '#f97316',
    initial_knowledge_level: 3,
    initial_affinity_level: 3,
    exam_weight: 2.0,
    measured_mastery_score: 75,
    behavioral_friction_score: 0.1,
    cycle_allocated_minutes: 90,
  },
  {
    id: 'subj-cgu-ti-dev',
    plan_id: 'plan-cgu',
    category: 'ESPECIFICO',
    name: 'TI — Desenvolvimento & Arquitetura',
    color: '#3b82f6',
    initial_knowledge_level: 4,
    initial_affinity_level: 3,
    exam_weight: 2.5,
    measured_mastery_score: 85,
    behavioral_friction_score: 0.0,
    cycle_allocated_minutes: 60,
  },
  {
    id: 'subj-cgu-contabilidade',
    plan_id: 'plan-cgu',
    category: 'ESPECIFICO',
    name: 'Contabilidade Pública (CASP)',
    color: '#eab308',
    initial_knowledge_level: 1,
    initial_affinity_level: 1,
    exam_weight: 1.5,
    measured_mastery_score: 42,
    behavioral_friction_score: 0.35,
    cycle_allocated_minutes: 120,
  },
  {
    id: 'subj-cgu-dir-adm',
    plan_id: 'plan-cgu',
    category: 'BASICO',
    name: 'Direito Administrativo & Licitações (Lei 14.133)',
    color: '#10b981',
    initial_knowledge_level: 2,
    initial_affinity_level: 2,
    exam_weight: 1.5,
    measured_mastery_score: 64,
    behavioral_friction_score: 0.15,
    cycle_allocated_minutes: 75,
  },

  // === PLANO BACEN ===
  {
    id: 'subj-bacen-eng-sw',
    plan_id: 'plan-bacen',
    category: 'ESPECIFICO',
    name: 'Engenharia de Software & Sistemas Distribuídos',
    color: '#06b6d4',
    initial_knowledge_level: 4,
    initial_affinity_level: 3,
    exam_weight: 3.0,
    measured_mastery_score: 80,
    behavioral_friction_score: 0.05,
    cycle_allocated_minutes: 90,
  },
  {
    id: 'subj-bacen-sec',
    plan_id: 'plan-bacen',
    category: 'ESPECIFICO',
    name: 'Segurança da Informação & Criptografia',
    color: '#8b5cf6',
    initial_knowledge_level: 3,
    initial_affinity_level: 3,
    exam_weight: 2.5,
    measured_mastery_score: 71,
    behavioral_friction_score: 0.1,
    cycle_allocated_minutes: 90,
  },
  {
    id: 'subj-bacen-sfn',
    plan_id: 'plan-bacen',
    category: 'GERAL',
    name: 'Sistema Financeiro Nacional (SFN) & Pix',
    color: '#f59e0b',
    initial_knowledge_level: 2,
    initial_affinity_level: 2,
    exam_weight: 2.0,
    measured_mastery_score: 52,
    behavioral_friction_score: 0.2,
    cycle_allocated_minutes: 105,
  },
];

export const SEED_TOPICS: Topic[] = [
  // Auditoria Governamental (CGU)
  {
    id: 't-cgu-1-1',
    subject_id: 'subj-cgu-auditoria',
    parent_id: null,
    code: '1.1',
    title: 'Normas Internacionais de Auditoria (ISSAI 100, 200 e NBC TA)',
    mastery_score: 82,
    status: 'REVIEW',
    last_studied_at: '2026-10-19T20:00:00Z',
  },
  {
    id: 't-cgu-1-2',
    subject_id: 'subj-cgu-auditoria',
    parent_id: null,
    code: '1.2',
    title: 'Sistema de Controle Interno do Poder Executivo Federal (Lei 10.180/2001)',
    mastery_score: 68,
    status: 'STUDYING',
    last_studied_at: '2026-10-18T19:30:00Z',
  },
  {
    id: 't-cgu-1-3',
    subject_id: 'subj-cgu-auditoria',
    parent_id: null,
    code: '1.3',
    title: 'Amostragem em Auditoria, Evidências e Matriz de Achados',
    mastery_score: 55,
    status: 'PENDING',
    last_studied_at: null,
  },

  // TI — Desenvolvimento & Arquitetura (CGU)
  {
    id: 't-cgu-2-1',
    subject_id: 'subj-cgu-ti-dev',
    parent_id: null,
    code: '2.1',
    title: 'Arquitetura Limpa, Microsserviços, DDD e APIs REST/GraphQL',
    mastery_score: 91,
    status: 'MASTERED',
    last_studied_at: '2026-10-20T10:00:00Z',
  },
  {
    id: 't-cgu-2-2',
    subject_id: 'subj-cgu-ti-dev',
    parent_id: null,
    code: '2.2',
    title: 'Segurança de Aplicações Web (OWASP Top 10, OAuth 2.0, OIDC e JWT)',
    mastery_score: 79,
    status: 'REVIEW',
    last_studied_at: '2026-10-17T21:00:00Z',
  },

  // Contabilidade Pública (CGU)
  {
    id: 't-cgu-3-1',
    subject_id: 'subj-cgu-contabilidade',
    parent_id: null,
    code: '3.1',
    title: 'Plano de Contas Aplicado ao Setor Público (PCASP) — Natureza da Informação',
    mastery_score: 38,
    status: 'STUDYING',
    last_studied_at: '2026-10-16T22:00:00Z',
  },
  {
    id: 't-cgu-3-2',
    subject_id: 'subj-cgu-contabilidade',
    parent_id: null,
    code: '3.2',
    title: 'Demonstrações Contábeis Aplicadas ao Setor Público (DCASP — Balanços)',
    mastery_score: 45,
    status: 'PENDING',
    last_studied_at: null,
  },

  // Direito Administrativo (CGU)
  {
    id: 't-cgu-4-1',
    subject_id: 'subj-cgu-dir-adm',
    parent_id: null,
    code: '4.1',
    title: 'Nova Lei de Licitações e Contratos (Lei 14.133/2021) — Contratações de TI',
    mastery_score: 64,
    status: 'STUDYING',
    last_studied_at: '2026-10-15T19:00:00Z',
  },

  // Engenharia de Software (BACEN)
  {
    id: 't-bacen-1-1',
    subject_id: 'subj-bacen-eng-sw',
    parent_id: null,
    code: '1.1',
    title: 'Arquitetura Orientada a Eventos (Kafka, RabbitMQ) e Consistência Eventual',
    mastery_score: 84,
    status: 'REVIEW',
    last_studied_at: '2026-10-14T20:00:00Z',
  },
  {
    id: 't-bacen-1-2',
    subject_id: 'subj-bacen-eng-sw',
    parent_id: null,
    code: '1.2',
    title: 'DevSecOps, CI/CD, Containers (Docker) e Orquestração (Kubernetes)',
    mastery_score: 76,
    status: 'STUDYING',
    last_studied_at: null,
  },

  // Segurança da Informação (BACEN)
  {
    id: 't-bacen-2-1',
    subject_id: 'subj-bacen-sec',
    parent_id: null,
    code: '2.1',
    title: 'Criptografia Simétrica/Assimétrica, ICP-Brasil, TLS 1.3 e Assinatura Digital',
    mastery_score: 71,
    status: 'STUDYING',
    last_studied_at: null,
  },

  // SFN (BACEN)
  {
    id: 't-bacen-3-1',
    subject_id: 'subj-bacen-sfn',
    parent_id: null,
    code: '3.1',
    title: 'Estrutura do SFN: CMN, BACEN, CVM, SUSEP e Ecossistema do Pix (SPI/DICT)',
    mastery_score: 52,
    status: 'STUDYING',
    last_studied_at: null,
  },
];

export const SEED_TOPIC_LINKS: TopicLink[] = [
  {
    id: 'link-1',
    source_topic_id: 't-cgu-1-1',
    target_topic_id: 't-cgu-1-3',
    relation_type: 'PREREQUISITE',
    notes: 'Risco de Detecção (ISSAI 100) define diretamente o tamanho da amostra em auditoria (1.3).',
  },
  {
    id: 'link-2',
    source_topic_id: 't-cgu-2-2',
    target_topic_id: 't-bacen-2-1',
    relation_type: 'RELATED',
    notes: 'OAuth 2.0 / JWT dependem de assinatura assimétrica (RS256/ES256) e TLS.',
  },
];

export const SEED_NOTEBOOKS: Notebook[] = [
  {
    id: 'nb-cgu-1-1',
    subject_id: 'subj-cgu-auditoria',
    topic_id: 't-cgu-1-1',
    title: 'Caderno 1.1 — ISSAI 100/200 & Risco de Auditoria',
    content_markdown: `### 📌 Síntese Direta — ISSAI 100\n\n* **Equação Fundamental:** \`RA = RI × RC × RD\`\n* **Risco Inerente (RI)** e **Risco de Controle (RC)** pertencem à entidade auditada (o auditor **avalia**, mas não controla).\n* **Risco de Detecção (RD)** é o único controlado pelo auditor (inversamente proporcional à materialidade e aos testes substantivos).\n\n#### ⚠️ Pegadinhas Clássicas FGV\n1. Trocar "Risco de Controle" por "Risco Operacional".\n2. Dizer que o auditor elimina o risco de auditoria a zero (na verdade, reduz a um nível aceitavelmente baixo).`,
    ai_summary_markdown: 'Resumo validado pelo roteador local: Foco nos 3 componentes do risco (ISSAI 100).',
    updated_at: '2026-10-20T12:00:00Z',
  },
];

export const SEED_PDF_SOURCES: PdfSource[] = [
  {
    id: 'pdf-cgu-1-1',
    subject_id: 'subj-cgu-auditoria',
    topic_id: 't-cgu-1-1',
    title: 'Manual de Auditoria Governamental & ISSAI 100-400.pdf',
    file_path: 'docs/pdfs/issai-100-cgu.pdf',
    current_page: 24,
    total_pages: 68,
    highlights_json: '[]',
    last_opened_at: '2026-10-20T11:30:00Z',
  },
  {
    id: 'pdf-cgu-1-2',
    subject_id: 'subj-cgu-auditoria',
    topic_id: 't-cgu-1-2',
    title: 'Lei_10180_2001_Controle_Interno_Esquematizada.pdf',
    file_path: 'docs/pdfs/lei-10180.pdf',
    current_page: 12,
    total_pages: 45,
    highlights_json: '[]',
    last_opened_at: '2026-10-19T18:00:00Z',
  },
  {
    id: 'pdf-cgu-3-1',
    subject_id: 'subj-cgu-contabilidade',
    topic_id: 't-cgu-3-1',
    title: 'MCASP_10a_Edicao_PCASP_Resumo.pdf',
    file_path: 'docs/pdfs/mcasp-pcasp.pdf',
    current_page: 9,
    total_pages: 95,
    highlights_json: '[]',
    last_opened_at: '2026-10-18T18:00:00Z',
  },
];

export const SEED_QUESTIONS: Question[] = [
  {
    id: 'q-fgv-cgu-issai-1',
    subject_id: 'subj-cgu-auditoria',
    topic_id: 't-cgu-1-1',
    exam_board: 'FGV',
    exam_year: 2022,
    organ: 'CGU',
    statement:
      'No âmbito das Normas Internacionais de Auditoria Aplicadas ao Setor Público (ISSAI), o risco de auditoria compreende o risco de que o auditor expresse uma conclusão inadequada caso o objeto contenha distorção relevante. Assinale a alternativa que relaciona corretamente os três componentes do risco de auditoria:',
    options_json: JSON.stringify([
      'A) Risco de Controle, Risco Operacional e Risco de Reputação.',
      'B) Risco Inerente, Risco Fiscal e Risco de Amostragem.',
      'C) Risco Inerente, Risco de Controle e Risco de Detecção.',
      'D) Risco de Detecção, Risco de Fraude e Risco Estratégico.',
    ]),
    preliminary_answer: 'C',
    final_answer: 'C',
    is_annulled: 0,
    annulment_reason: null,
  },
  {
    id: 'q-fgv-cgu-pcasp-1',
    subject_id: 'subj-cgu-contabilidade',
    topic_id: 't-cgu-3-1',
    exam_board: 'FGV',
    exam_year: 2022,
    organ: 'CGU',
    statement:
      'No Plano de Contas Aplicado ao Setor Público (PCASP), as classes 1 a 4 (Ativo, Passivo, VPD e VPA) pertencem a qual natureza de informação contábil?',
    options_json: JSON.stringify([
      'A) Natureza de Informação Orçamentária.',
      'B) Natureza de Informação Patrimonial.',
      'C) Natureza de Informação de Controle.',
      'D) Natureza de Informação Financeira.',
    ]),
    preliminary_answer: 'B',
    final_answer: 'B',
    is_annulled: 0,
    annulment_reason: null,
  },
  {
    id: 'q-cebraspe-bacen-sfn-1',
    subject_id: 'subj-bacen-sfn',
    topic_id: 't-bacen-3-1',
    exam_board: 'Cebraspe',
    exam_year: 2024,
    organ: 'BACEN',
    statement:
      'Acerca da estrutura do Sistema Financeiro Nacional e do ecossistema de pagamentos instantâneos (Pix), assinale a opção correta sobre a gestão operacional do Sistema de Pagamentos Instantâneos (SPI) e do Diretório de Identificadores de Contas Transacionais (DICT):',
    options_json: JSON.stringify([
      'A) São geridos operacionalmente pelo Conselho Monetário Nacional (CMN).',
      'B) São infraestruturas centralizadas geridas e operadas diretamente pelo Banco Central do Brasil (BACEN).',
      'C) São operados exclusivamente pelas câmaras privadas da B3 e CIP.',
      'D) O DICT é operado pela Receita Federal e o SPI pelo Banco do Brasil.',
    ]),
    preliminary_answer: 'B',
    final_answer: 'B',
    is_annulled: 0,
    annulment_reason: null,
  },
];

export const SEED_AI_DISSECTIONS: AiDissection[] = [
  {
    id: 'diss-1',
    question_id: 'q-fgv-cgu-issai-1',
    provider_used: 'GEMINI_FREE',
    dissection_markdown: `📌 **Mnemônico & Pré-requisito (ISSAI 100):**\n\n**Risco de Auditoria = RI × RC × RD**\n\n- **Risco Inerente (RI) + Risco de Controle (RC):** Existem na entidade auditada (independem do auditor, compõem o Risco de Distorção Relevante).\n- **Risco de Detecção (RD):** Único controlado diretamente pelo auditor (ajustando o tamanho da amostra e os procedimentos substantivos).`,
    prerequisites_json: JSON.stringify(['ISSAI 100', 'Risco de Distorção Relevante (RDR)']),
    chat_history_json: '[]',
    created_at: '2026-10-20T12:00:00Z',
  },
  {
    id: 'diss-2',
    question_id: 'q-fgv-cgu-pcasp-1',
    provider_used: 'GEMINI_FREE',
    dissection_markdown: `📌 **Divisão das 8 Classes do PCASP:**\n\n- **Patrimonial (Classes 1, 2, 3 e 4):** 1-Ativo, 2-Passivo/PL, 3-VPD, 4-VPA.\n- **Orçamentária (Classes 5 e 6):** 5-Planejamento/Aprovação do Orçamento, 6-Execução do Orçamento.\n- **Controle (Classes 7 e 8):** 7-Controles Devedores, 8-Controles Credores.`,
    prerequisites_json: JSON.stringify(['Estrutura do PCASP', 'Regime de Competência vs Caixa']),
    chat_history_json: '[]',
    created_at: '2026-10-20T12:00:00Z',
  },
  {
    id: 'diss-3',
    question_id: 'q-cebraspe-bacen-sfn-1',
    provider_used: 'GEMINI_FREE',
    dissection_markdown: `📌 **BACEN no Ecossistema Pix:**\n\nDiferente de outros arranjos, no Pix o **Banco Central do Brasil (BCB)** não é apenas regulador — ele **opera diretamente** as duas infraestruturas críticas:\n1. **SPI (Sistema de Pagamentos Instantâneos):** liquidação bruta em tempo real (LBTR).\n2. **DICT:** base centralizada que vincula chaves Pix (CPF, e-mail, telefone, EVP) às contas.`,
    prerequisites_json: JSON.stringify(['SFN', 'Liquidação Bruta em Tempo Real (LBTR)']),
    chat_history_json: '[]',
    created_at: '2026-10-20T12:00:00Z',
  },
];

export const SEED_ADMIN_BLUEPRINTS: AdminBoardBlueprint[] = [
  {
    id: 'bp-fgv',
    board_name: 'FGV',
    target_url: 'https://conhecimento.fgv.br/concursos',
    expected_selectors_json: JSON.stringify({
      examList: '.views-row .field-content a',
      pdfLinks: 'a[href$=".pdf"]',
      postAppealBadge: 'contains("Definitivo")',
    }),
    last_dom_hash: 'sha256:8f94e2c1b0a7',
    health_status: 'OK',
    last_checked_at: '2026-10-20T11:00:00Z',
  },
  {
    id: 'bp-cebraspe',
    board_name: 'CEBRASPE',
    target_url: 'https://www.cebraspe.org.br/concursos/',
    expected_selectors_json: JSON.stringify({
      examList: '.concursos-lista article',
      pdfLinks: 'a.arquivo-download[href$=".pdf"]',
      annulmentReport: 'contains("Justificativas de Alteração")',
    }),
    last_dom_hash: 'sha256:3c71d9a4e512',
    health_status: 'OK',
    last_checked_at: '2026-10-20T11:05:00Z',
  },
  {
    id: 'bp-fcc',
    board_name: 'FCC',
    target_url: 'https://www.concursosfcc.com.br/',
    expected_selectors_json: JSON.stringify({
      examList: '#listaConcursos .item-concurso',
      pdfLinks: '.arquivos-concurso a[href$=".pdf"]',
    }),
    last_dom_hash: 'sha256:9a20b5f1c33e',
    health_status: 'OK',
    last_checked_at: '2026-10-20T11:10:00Z',
  },
];

