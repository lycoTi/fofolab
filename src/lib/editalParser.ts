import type { ImportTopicItem } from '../types/database';
import { parseSyllabusTopics } from './syllabusImport';

/**
 * Lê o texto de um edital (linhas extraídas do PDF) e monta o que o plano de estudos precisa:
 * concurso, cargos, provas com pontuação e nota mínima, matérias e tópicos, datas.
 *
 * Feito para o modelo Cebraspe (edital CGU 2026 é o caso de teste). É heurístico: campo que não
 * for achado fica `null` e a tela de prévia pede para o estudante conferir — nunca inventa valor.
 */

export interface EditalExamPart {
  code: string; // "P1"
  name: string; // "Conhecimentos básicos"
  itemCount: number;
  pointsPerItem: number | null;
  minScore: number | null;
}

export interface EditalSubject {
  name: string;
  partCode: string | null;
  topics: ImportTopicItem[];
}

export interface EditalRole {
  number: number;
  /** Especialidade quando houver ("Tecnologia da Informação – Desenvolvimento de Sistemas"), senão o cargo. */
  label: string;
}

export interface ParsedEdital {
  organ: string | null;
  board: string | null;
  roleBaseTitle: string | null;
  examDate: string | null; // AAAA-MM-DD
  registrationDeadline: string | null; // AAAA-MM-DD
  fee: number | null;
  minTotalScore: number | null;
  parts: EditalExamPart[];
  roles: EditalRole[];
  /** Matérias que valem para todos os cargos. */
  commonSubjects: EditalSubject[];
  /** Matérias específicas de cada cargo (chave = número do cargo). */
  roleSubjects: Record<number, EditalSubject[]>;
}

const LOWERCASE_WORDS = new Set([
  'a', 'o', 'as', 'os', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
  'para', 'por', 'com', 'à', 'ao', 'aos', 'às',
]);

const ACRONYMS = new Set(['ti', 'ia', 'cgu', 'tcu', 'affc', 'sql', 'api', 'ux', 'ui', 'lgpd']);

/** "ENGENHARIA DE SOFTWARE E PROGRAMAÇÃO" → "Engenharia de Software e Programação" (siglas conhecidas ficam: TI, IA). */
export function toTitleCasePt(text: string): string {
  return text
    .toLowerCase()
    .split(/(\s+|[–()/-])/)
    .map((word, index) => {
      if (!/\p{L}/u.test(word)) return word;
      if (ACRONYMS.has(word)) return word.toUpperCase();
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDecimal(text: string): number {
  return Number(text.replace(/\./g, '').replace(',', '.'));
}

function toIsoDate(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function hasLowercase(text: string): boolean {
  return /\p{Ll}/u.test(text);
}

// ============================================================================
// Cabeçalho, datas e pontuação (procurados no texto corrido)
// ============================================================================

function findOrgan(lines: string[]): string | null {
  for (const line of lines.slice(0, 5)) {
    const match = line.match(/\(([A-Z]{2,10})\)\s*$/);
    if (match) return match[1];
  }
  return null;
}

function findBoard(joined: string): string | null {
  return joined.match(/executado pel[oa] [^.]*?\(([^)]+)\)/)?.[1] ?? null;
}

function findExamDate(joined: string): string | null {
  const match = joined.match(/Aplicação das provas[^\d]{0,80}?(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? toIsoDate(match[1], match[2], match[3]) : null;
}

function findRegistrationDeadline(joined: string): string | null {
  const match = joined.match(
    /Período de solicitação de inscrições\s+\d{1,2}(?:\/\d{1,2})?(?:\/\d{4})?\s+a\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/
  );
  return match ? toIsoDate(match[1], match[2], match[3]) : null;
}

function findFee(joined: string): number | null {
  const match = joined.match(/TAXA:\s*R\$\s*([\d.]+,\d{2})/);
  return match ? parseDecimal(match[1]) : null;
}

function findParts(lines: string[], joined: string): EditalExamPart[] {
  const start = lines.findIndex((line) => /^PROVA\/TIPO/i.test(line));
  if (start < 0) return [];
  const end = lines.findIndex((line, i) => i > start && /^\d+\.\d+ /.test(line));
  const table = lines.slice(start + 1, end < 0 ? start + 30 : end).join(' ');

  const points = new Map<string, number>();
  for (const match of joined.matchAll(/(P\d),\s*(\d+,\d+) pontos?,? caso a resposta/g)) {
    points.set(match[1], parseDecimal(match[2]));
  }
  const minimums = new Map<string, number>();
  for (const match of joined.matchAll(/obtiver N(P\d) < (\d+,\d+)/g)) {
    minimums.set(match[1], parseDecimal(match[2]));
  }

  const parts: EditalExamPart[] = [];
  for (const match of table.matchAll(/Prova objetiva \((P\d)\)\s+(.+?)\s+(\d+)(?=\s|$)/g)) {
    const code = match[1];
    parts.push({
      code,
      name: match[2].trim(),
      itemCount: Number(match[3]),
      pointsPerItem: points.get(code) ?? null,
      minScore: minimums.get(code) ?? null,
    });
  }
  return parts;
}

function findMinTotal(joined: string): number | null {
  const match = joined.match(/(?:NP\d \+ )+NP\d < (\d+,\d+)/);
  return match ? parseDecimal(match[1]) : null;
}

// ============================================================================
// Cargos
// ============================================================================

function findRoles(lines: string[]): { roles: EditalRole[]; baseTitle: string | null } {
  const roles: EditalRole[] = [];
  let baseTitle: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\d+\.\d+\.\d+ CARGO (\d+): (.+)$/);
    if (!match) continue;
    // O nome do cargo pode quebrar em mais de uma linha (até a próxima linha numerada)
    let full = match[2];
    for (let j = i + 1; j < lines.length && !/^\d+(\.\d+)* /.test(lines[j]) && !hasLowercase(lines[j]); j++) {
      full += ` ${lines[j]}`;
    }
    const [cargo, specialty] = full.split(/\s+[–-]\s+ESPECIALIDADE:\s+/);
    baseTitle ??= toTitleCasePt(cargo);
    roles.push({ number: Number(match[1]), label: toTitleCasePt(specialty ?? cargo) });
  }
  return { roles, baseTitle };
}

// ============================================================================
// Conteúdo programático: "15.2.x CONHECIMENTOS …" → matérias "NOME: 1 Tópico. 1.1 …"
// ============================================================================

const SECTION_HEADING = /^\d+(?:\.\d+)+\s+CONHECIMENTOS\s+(.+)$/;
const ROLE_HEADING = /^CARGO (\d+):/;
// O nome pode ter dois-pontos ("AUDITORIA GOVERNAMENTAL: AVALIAÇÃO, …: 1 Avaliação"): vale o último antes do "1 "
const SUBJECT_HEADING = /^(.{6,}?):\s+(\d+\s.*)$/;

function joinBody(lines: string[]): string {
  return lines.reduce((text, line) => {
    if (!text) return line;
    // Palavra hifenizada na quebra de linha ("étnico-" + "raciais")
    if (/-$/.test(text) && /^\p{Ll}/u.test(line)) return text + line;
    return `${text} ${line}`;
  }, '');
}

function findContent(lines: string[], parts: EditalExamPart[]) {
  const commonSubjects: EditalSubject[] = [];
  const roleSubjects: Record<number, EditalSubject[]> = {};

  const partForSection = (sectionName: string): string | null => {
    const wanted = normalize(`conhecimentos ${sectionName}`);
    return parts.find((p) => normalize(p.name) === wanted)?.code ?? null;
  };

  let partCode: string | null = null;
  let inContent = false;
  let roleNumber: number | null = null;
  let current: { name: string; partCode: string | null; role: number | null; body: string[] } | null = null;
  let upperBuffer: string[] = [];
  // O título "CARGO N: …" pode continuar na linha seguinte, que não é nome de matéria
  let inRoleHeading = false;

  const closeSubject = () => {
    if (!current) return;
    const subject: EditalSubject = {
      name: toTitleCasePt(current.name),
      partCode: current.partCode,
      topics: parseSyllabusTopics(joinBody(current.body)),
    };
    if (current.role === null) commonSubjects.push(subject);
    else (roleSubjects[current.role] ??= []).push(subject);
    current = null;
  };

  for (const line of lines) {
    const section = line.match(SECTION_HEADING);
    if (section) {
      closeSubject();
      inContent = true;
      partCode = partForSection(section[1]);
      roleNumber = null;
      upperBuffer = [];
      continue;
    }
    if (!inContent) continue;
    if (/^ANEXO\b/.test(line)) break;

    const role = line.match(ROLE_HEADING);
    if (role) {
      closeSubject();
      roleNumber = Number(role[1]);
      upperBuffer = [];
      inRoleHeading = true;
      continue;
    }

    const heading = line.match(SUBJECT_HEADING);
    if (heading && !hasLowercase(heading[1])) {
      closeSubject();
      const name = [...upperBuffer, heading[1]].join(' ');
      current = { name, partCode, role: roleNumber, body: [heading[2]] };
      upperBuffer = [];
      inRoleHeading = false;
      continue;
    }

    // Linha toda em maiúsculas: começo de um título que continua na próxima linha,
    // resto do nome do cargo ou assinatura no fim do edital — nunca conteúdo
    if (!hasLowercase(line) && /\p{Lu}{3}/u.test(line)) {
      if (current && upperBuffer.length === 0) closeSubject();
      if (!inRoleHeading) upperBuffer.push(line);
      continue;
    }

    upperBuffer = [];
    current?.body.push(line);
  }
  closeSubject();
  return { commonSubjects, roleSubjects };
}

// ============================================================================

export function parseEdital(lines: string[]): ParsedEdital {
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean);
  const joined = cleanLines.join(' ');
  const parts = findParts(cleanLines, joined);
  const { roles, baseTitle } = findRoles(cleanLines);
  const { commonSubjects, roleSubjects } = findContent(cleanLines, parts);

  return {
    organ: findOrgan(cleanLines),
    board: findBoard(joined),
    roleBaseTitle: baseTitle,
    examDate: findExamDate(joined),
    registrationDeadline: findRegistrationDeadline(joined),
    fee: findFee(joined),
    minTotalScore: findMinTotal(joined),
    parts,
    roles,
    commonSubjects,
    roleSubjects,
  };
}

/** Matérias que o candidato daquele cargo estuda: as comuns + as específicas do cargo. */
export function subjectsForRole(edital: ParsedEdital, roleNumber: number | null): EditalSubject[] {
  const specific = roleNumber === null ? [] : (edital.roleSubjects[roleNumber] ?? []);
  return [...edital.commonSubjects, ...specific];
}

/**
 * O edital diz quantos itens cada PROVA tem, não cada matéria: divide-se por igual entre as
 * matérias da prova. `points` = quanto a matéria vale na prova; `weight` = relativo à média
 * das matérias (1 = média), na escala que o motor do ciclo usa.
 */
export function estimateSubjectWeights(
  parts: EditalExamPart[],
  subjects: EditalSubject[]
): { points: number; weight: number }[] {
  const subjectsPerPart = new Map<string, number>();
  for (const s of subjects) {
    if (s.partCode) subjectsPerPart.set(s.partCode, (subjectsPerPart.get(s.partCode) ?? 0) + 1);
  }
  const points = subjects.map((s) => {
    const part = parts.find((p) => p.code === s.partCode);
    if (!part) return 0;
    return (part.itemCount * (part.pointsPerItem ?? 1)) / (subjectsPerPart.get(part.code) ?? 1);
  });
  const known = points.filter((p) => p > 0);
  const mean = known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  return points.map((p) => ({
    points: Math.round(p * 10) / 10,
    weight: p > 0 ? Math.round((p / mean) * 100) / 100 : 1,
  }));
}
