// ============================================================================
// FofoLab — Contratos TypeScript espelhando docs/specs/01-database-schema.sql
// ============================================================================

export type CareerSphere = 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL' | 'TRIBUNAIS' | 'TI' | 'DIREITO';
export type CatalogStatus = 'CATALOGED' | 'PARTIAL' | 'RADAR';
export type SubjectCategory = 'BASICO' | 'GERAL' | 'ESPECIFICO';
export type TopicStatus = 'PENDING' | 'STUDYING' | 'REVIEW' | 'MASTERED';
export type TopicRelationType = 'PREREQUISITE' | 'RELATED' | 'JURISPRUDENCE';
/** Quem escreveu a explicação guardada. `EXAMPLE` = exemplo escrito à mão (seed), não gerado pela IA. */
export type AiProviderUsed = 'GROQ_FREE' | 'GEMINI_FREE' | 'DEEPSEEK_FALLBACK' | 'GATEWAY' | 'EXAMPLE';
/** [spec 11] `LUCKY_GUESS` = acertou no chute; `MISCONCEPTION` = errou porque confundiu com outra coisa. */
export type SelfDiagnosisType = 'MASTERED' | 'DOUBT' | 'LUCKY_GUESS' | 'BOARD_TRAP' | 'BASE_GAP' | 'MISCONCEPTION';
export type StudyStrategy = 'BASE_COMUM' | 'MAIS_COBRADOS' | 'ALTO_PESO_CURTO';
export type StudyMoment = 'PRE_EDITAL' | 'POS_EDITAL';
export type StudySessionType = 'PDF_READING' | 'QUESTIONS' | 'REVIEW' | 'POMODORO';
/** [v8] Confiança marcada antes de responder na Revisão do dia. */
export type ReviewConfidence = 'SURE' | 'THINK' | 'GUESS';
/** [v8] Autoavaliação da pergunta aberta da Revisão do dia. */
export type RecallRating = 'GOOD' | 'PARTIAL' | 'FORGOT';
export type BlueprintHealthStatus = 'OK' | 'DRIFT_DETECTED';

// 1. career_tracks
export interface CareerTrack {
  id: string;
  slug: string;
  name: string;
  sphere: CareerSphere;
  catalog_status: CatalogStatus;
  dossier_markdown: string | null;
  updated_at: string;
}

// 2. study_plans
export interface StudyPlan {
  id: string;
  track_id: string | null;
  title: string;
  organ: string | null;
  exam_board: string | null;
  role_title: string | null;
  exam_date: string | null;
  weekly_hours_target: number;
  is_active: number; // 0 | 1
  created_at: string;
  strategy_mode: StudyStrategy | null; // [v2] null = estratégia neutra (Wizard ainda não respondido)
  study_moment: StudyMoment | null;    // [v2]
  // [v4] Lidos do edital; ausentes nos dados de exemplo
  registration_deadline?: string | null;
  min_total_score?: number | null;
  selected_role?: string | null;
  daily_review_enabled?: number; // [v8] 0 | 1 (ausente = ligada)
  productive_failure_hints?: number; // [v9] 0 | 1 (ausente = ligada)
  weekday_minutes_json?: string | null; // [v11] minutos seg–dom em JSON (0 = folga; ausente = horas ÷ 7)
  final_stretch_days?: number; // [v11] dias da reta final (padrão 14)
}

// 2b. exam_parts [v4] — provas objetivas do edital
export interface ExamPart {
  id: string;
  plan_id: string;
  code: string;
  name: string;
  item_count: number;
  points_per_item: number;
  min_score: number | null;
  sort_order: number;
}

// 3. subjects
export interface Subject {
  id: string;
  plan_id: string;
  category: SubjectCategory;
  name: string;
  color: string;
  initial_knowledge_level: number; // 1 (Nunca vi) a 4 (Avançado)
  initial_affinity_level: number;  // 1 (Pavor/Sono), 2 (Neutro), 3 (Gosto)
  exam_weight: number;
  measured_mastery_score: number;  // 0 a 100%
  behavioral_friction_score: number;
  cycle_allocated_minutes: number;
  exam_part_id?: string | null; // [v4] prova em que a matéria cai
}

// 4. topics
export interface Topic {
  id: string;
  subject_id: string;
  parent_id: string | null;
  code: string | null;
  title: string;
  mastery_score: number; // 0 a 100%
  status: TopicStatus;
  last_studied_at: string | null;
  /** [v4] Autoavaliação do tópico (1..4); null/ausente = herda da matéria. */
  initial_knowledge_level?: number | null;
}

// 5. topic_links
export interface TopicLink {
  id: string;
  source_topic_id: string;
  target_topic_id: string;
  relation_type: TopicRelationType;
  notes: string | null;
}

// 6. notebooks
export interface Notebook {
  id: string;
  subject_id: string;
  topic_id: string | null;
  title: string;
  content_markdown: string;
  ai_summary_markdown: string | null;
  updated_at: string;
}

// 7. pdf_sources
export interface PdfSource {
  id: string;
  subject_id: string;
  topic_id: string | null;
  title: string;
  file_path: string;
  current_page: number;
  total_pages: number;
  highlights_json: string;
  last_opened_at: string | null;
  /** Números das páginas lidas, ex.: "[1,2,5]". */
  read_pages_json: string;
}

// 8. questions
export interface Question {
  id: string;
  subject_id: string;
  topic_id: string | null;
  exam_board: string;
  exam_year: number;
  organ: string | null;
  statement: string;
  options_json: string; // JSON stringified array of { key: string, text: string } or string[]
  preliminary_answer: string | null;
  final_answer: string;
  is_annulled: number; // 0 | 1
  annulment_reason: string | null;
}

// 9. ai_dissections
export interface AiDissection {
  id: string;
  question_id: string;
  provider_used: AiProviderUsed;
  dissection_markdown: string;
  prerequisites_json: string;
  chat_history_json: string;
  created_at: string;
}

// 10. question_attempts
export interface QuestionAttempt {
  id: string;
  question_id: string;
  topic_id: string | null;
  selected_option: string;
  is_correct: number; // 0 | 1
  used_ai_review: number; // 0 | 1
  self_diagnosis: SelfDiagnosisType;
  time_spent_seconds: number;
  attempted_at: string;
  confidence?: ReviewConfidence | null; // [v8]
  source?: 'DAILY_REVIEW' | null;       // [v8]
  mastery_delta?: number | null;        // [v10] delta aplicado de fato (cortado em 0..100)
}

// 11. study_sessions
export interface StudySession {
  id: string;
  subject_id: string;
  topic_id: string | null;
  duration_minutes: number;
  session_type: StudySessionType;
  pauses_count: number;
  was_skipped: number;
  started_at: string;
}

// 11d. recall_checks [v8]
export interface RecallCheck {
  id: string;
  subject_id: string;
  topic_id: string;
  rating: RecallRating;
  checked_at: string;
}

/** 11e. daily_reviews [v8] — um item da Revisão do dia congelada. */
export interface ReviewItem {
  topicId: string;
  subjectId: string;
  kind: 'QUESTION' | 'OPEN';
  questionId: string | null;
  /** Estudado no último dia de estudo, ou esfriando (menor chance de lembrar). */
  reason: 'LAST_DAY' | 'COOLING';
}

// 11b. daily_plans — um bloco do roteiro do dia congelado (spec 09). Nomes e cores vêm dos dados vivos.
export interface FrozenBlock {
  blockNumber: number;
  subjectId: string;
  topicId: string | null;
  durationMinutes: number;
  reasonText: string;
}

// 11c. question_logs — questões resolvidas fora do app (números agregados)
export interface QuestionLog {
  id: string;
  subject_id: string;
  topic_id: string | null;
  total: number;
  correct: number;
  blank: number;
  source: 'EXTERNAL';
  mastery_before: number | null;
  logged_at: string;
}

// 12. admin_board_blueprints
export interface AdminBoardBlueprint {
  id: string;
  board_name: string;
  target_url: string;
  expected_selectors_json: string;
  last_dom_hash: string | null;
  health_status: BlueprintHealthStatus;
  last_checked_at: string | null;
}

// DTOs para CRUD (Fatia 2)
export interface CreateStudyPlanInput {
  title: string;
  organ: string;
  exam_board: string;
  role_title: string;
  exam_date: string | null;
  weekly_hours_target: number;
  track_id?: string | null;
}

export interface UpdateStudyPlanInput extends Partial<CreateStudyPlanInput> {
  id: string;
  is_active?: number;
  strategy_mode?: StudyStrategy | null;
  study_moment?: StudyMoment | null;
  daily_review_enabled?: number;
  productive_failure_hints?: number;
}

export interface CreateSubjectInput {
  plan_id: string;
  category: SubjectCategory;
  name: string;
  color?: string;
  initial_knowledge_level: number;
  initial_affinity_level: number;
  exam_weight: number;
  cycle_allocated_minutes?: number;
}

export interface UpdateSubjectInput extends Partial<Omit<CreateSubjectInput, 'plan_id'>> {
  id: string;
  measured_mastery_score?: number;
}

export interface CreateTopicInput {
  subject_id: string;
  parent_id?: string | null;
  code: string;
  title: string;
  status?: TopicStatus;
  mastery_score?: number;
}

export interface UpdateTopicInput extends Partial<Omit<CreateTopicInput, 'subject_id'>> {
  id: string;
  last_studied_at?: string | null;
}

/** Questão já analisada pelo importador, pronta para gravar (Fatia 5.5). */
export interface ImportQuestionItem {
  statement: string;
  options: string[]; // Sempre com prefixo de letra: "A) ...", ou ["C) Certo", "E) Errado"]
  finalAnswer: string;
  examBoard: string;
  examYear: number;
  organ: string | null;
  topicId: string | null;
}

/** Tópico do conteúdo programático já analisado pelo importador. */
export interface ImportTopicItem {
  code: string | null;
  title: string;
}

/** Plano montado a partir do edital, já conferido pelo estudante na prévia (docs/specs/07). */
export interface EditalPlanInput {
  title: string;
  organ: string | null;
  examBoard: string | null;
  roleTitle: string | null;
  examDate: string | null;
  registrationDeadline: string | null;
  minTotalScore: number | null;
  weeklyHoursTarget: number;
  parts: { code: string; name: string; itemCount: number; pointsPerItem: number; minScore: number | null }[];
  subjects: { name: string; partCode: string | null; examWeight: number; topics: ImportTopicItem[] }[];
}

/** Autoavaliação do Wizard: nível da matéria e, opcionalmente, de tópicos (null = herda da matéria). */
export interface SelfAssessmentInput {
  subjects: { subjectId: string; level: number }[];
  topics: { topicId: string; level: number | null }[];
}

