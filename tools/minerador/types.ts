/**
 * Tipos do minerador da Cebraspe (spec 12). A ferramenta roda fora do app: nada em `src/` importa esta pasta.
 */
export interface CebraspeEvent {
  identificador: string;
  nome: string;
  ano: number;
  tipo: string;
  status: string;
}

export interface CebraspeFile {
  descricao: string;
  nomeArquivo: string;
  data: string;
}

export interface CebraspeEventDetail extends CebraspeEvent {
  areas: string[];
  arquivos: CebraspeFile[];
}

export interface ExamPair {
  prova: CebraspeFile;
  gabarito: CebraspeFile;
  caderno: string;
}

export interface PdfLine {
  page: number;
  column: 'L' | 'R';
  x: number;
  y: number;
  text: string;
  atMargin: boolean;
}

export type ItemFormat = 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';

export interface ExtractedItem {
  numero: number;
  formato: ItemFormat;
  textoBase: string | null;
  enunciado: string;
  alternativas: string[] | null;
  materiaOrigem: string | null;
}

/** 'E' serve aos dois formatos (Errado e alternativa E); 'X' = item anulado. */
export type AnswerMark = 'C' | 'E' | 'A' | 'B' | 'D' | 'X';

export interface Procedencia {
  banca: 'Cebraspe';
  identificador: string;
  concurso: string;
  ano: number;
  areas: string[];
  prova: string;
  caderno: string;
  numero: number;
}

export interface AcervoItem {
  /** `${identificador}:${caderno}:${numero}` */
  id: string;
  formato: ItemFormat;
  textoBase: string | null;
  enunciado: string;
  /** ["A) …", …] na múltipla escolha. */
  alternativas: string[] | null;
  gabarito: Exclude<AnswerMark, 'X'> | null;
  anulado: boolean;
  /** Pista da prova de origem, nunca verdade: o assunto vem do conteúdo (spec 12 §1). */
  materiaOrigem: string | null;
  temCodigo: boolean;
  dependeDeFigura: boolean;
  /** Item reaplicado em outra prova acumula procedências. */
  procedencias: Procedencia[];
}

export type ExamOutcome = { kind: 'ok'; itens: AcervoItem[] } | { kind: 'quarentena'; motivo: string };
