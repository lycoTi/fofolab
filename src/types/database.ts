// ============================================================================
// FofoLab — Contratos TypeScript espelhando docs/specs/01-database-schema.sql
// ============================================================================

export type CareerSphere = 'FEDERAL' | 'ESTADUAL' | 'MUNICIPAL' | 'TRIBUNAIS' | 'TI' | 'DIREITO';
export type CatalogStatus = 'CATALOGED' | 'PARTIAL' | 'RADAR';
export type SubjectCategory = 'BASICO' | 'GERAL' | 'ESPECIFICO';
export type TopicStatus = 'PENDING' | 'STUDYING' | 'REVIEW' | 'MASTERED';
export type TopicRelationType = 'PREREQUISITE' | 'RELATED' | 'JURISPRUDENCE';
/** Quem escreveu a explicação guardada. `EXAMPLE` = exemplo escrito à mão (seed), não gerado pela IA. */
export type AiProviderUsed = 'GEMINI_FREE' | 'DEEPSEEK_FALLBACK' | 'GATEWAY' | 'EXAMPLE';
export type SelfDiagnosisType = 'MASTERED' | 'DOUBT' | 'BOARD_TRAP' | 'BASE_GAP';
export type StudyStrategy = 'BASE_COMUM' | 'MAIS_COBRADOS' | 'ALTO_PESO_CURTO';
export type StudyMoment = 'PRE_EDITAL' | 'POS_EDITAL';
export type StudySessionType = 'PDF_READING' | 'QUESTIONS' | 'REVIEW' | 'POMODORO';
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

