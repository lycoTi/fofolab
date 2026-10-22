// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { calculateDynamicStudyCycle, type CycleCalculationResult } from '../lib/cycleEngine';
import { estimateSubjectWeights, parseEdital, subjectsForRole } from '../lib/editalParser';
import { parentTopicCode } from '../lib/syllabusImport';
import type { ExamPart, StudyPlan, Subject, Topic } from '../types/database';
import { loadFixturePdfLines } from './helpers/loadPdfLines';

/** Autoavaliação do dono (docs/specs/07 §4): 1 Nunca vi · 2 Já vi por cima · 3 Sei bem · 4 Domino. */
const SUBJECT_LEVELS: Record<string, number> = {
  'Estado, Democracia, Direitos e Ciência Política': 1,
  'Sociedade Brasileira, Desigualdades, Diversidade e Desenvolvimento': 1,
  'Ética Pública e Responsabilidade Profissional': 2,
  'Administração Pública e Fundamentos de Políticas Públicas': 2,
  'Fundamentos de Governança, Riscos e Integridade Pública e Privada': 2,
  'Fundamentos de Transparência, Ouvidoria e Participação Social': 1,
  'Fundamentos de Direito Público Aplicado, Controle e Responsabilização': 1,
  'Fundamentos de Evidências, Dados e Inteligência Artificial': 2,
  'Fundamentos de Auditoria Governamental e Atuação Integrada da CGU': 4,
  'Engenharia de Software e Programação': 3,
  'Arquitetura e Integração de Sistemas': 1,
  'Persistência, Integração e Proteção de Dados': 2,
  'Desenvolvimento Seguro, Qualidade e Gestão da Entrega': 2,
};
/** Dentro de Engenharia de Software: requisitos e interfaces fortes, programação/concorrência (Java) fracas. */
const ENGENHARIA_TOPIC_LEVELS: Record<string, number> = { '1': 4, '2': 2, '3': 1, '4': 3, '5': 3 };

const plan: StudyPlan = {
  id: 'plan-cgu',
  track_id: null,
  title: 'CGU 2026',
  organ: 'CGU',
  exam_board: 'Cebraspe',
  role_title: 'Desenvolvimento de Sistemas',
  exam_date: '2026-12-13',
  weekly_hours_target: 20,
  is_active: 1,
  created_at: '2026-10-21T00:00:00Z',
  strategy_mode: null,
  study_moment: 'POS_EDITAL',
};

describe('Ciclo do edital real com a autoavaliação do dono', () => {
  let result: CycleCalculationResult;
  let examParts: ExamPart[];

  beforeAll(async () => {
    const edital = parseEdital(await loadFixturePdfLines('cgu-2026-affc-edital.pdf'));
    const editalSubjects = subjectsForRole(edital, 4);
    const weights = estimateSubjectWeights(edital.parts, editalSubjects);

    examParts = edital.parts.map((p, i) => ({
      id: `part-${p.code}`,
      plan_id: plan.id,
      code: p.code,
      name: p.name,
      item_count: p.itemCount,
      points_per_item: p.pointsPerItem ?? 1,
      min_score: p.minScore,
      sort_order: i,
    }));

    const subjects: Subject[] = editalSubjects.map((s, i) => ({
      id: `subj-${i}`,
      plan_id: plan.id,
      category: 'GERAL',
      name: s.name,
      color: '#f97316',
      initial_knowledge_level: SUBJECT_LEVELS[s.name],
      initial_affinity_level: 2,
      exam_weight: weights[i].weight,
      measured_mastery_score: 0,
      behavioral_friction_score: 0,
      cycle_allocated_minutes: 60,
      exam_part_id: `part-${s.partCode}`,
    }));

    const topicsBySubject: Record<string, Topic[]> = {};
    editalSubjects.forEach((s, i) => {
      const subjectId = subjects[i].id;
      const isEngenharia = s.name === 'Engenharia de Software e Programação';
      topicsBySubject[subjectId] = s.topics.map((t) => {
        const parentCode = parentTopicCode(t.code);
        return {
          id: `${subjectId}-${t.code}`,
          subject_id: subjectId,
          parent_id: parentCode ? `${subjectId}-${parentCode}` : null,
          code: t.code,
          title: t.title,
          mastery_score: 0,
          status: 'PENDING',
          last_studied_at: null,
          initial_knowledge_level: isEngenharia && t.code && !parentCode ? ENGENHARIA_TOPIC_LEVELS[t.code] : null,
        };
      });
    });

    result = calculateDynamicStudyCycle({
      plan,
      subjects,
      topicsBySubject,
      attempts: [],
      sessions: [],
      topicLinks: [],
      examParts,
      now: new Date('2026-10-21T08:00:00'),
    });
  }, 60_000);

  const minutesOf = (name: string) => result.allocations.find((a) => a.subject.name === name)!.recommendedWeeklyMinutes;

  it('nenhuma matéria de prova eliminatória fica sem tempo, e o orçamento semanal se mantém', () => {
    for (const allocation of result.allocations) {
      expect(allocation.recommendedWeeklyMinutes).toBeGreaterThanOrEqual(30);
      expect(allocation.floorMinutes).toBeGreaterThan(0);
    }
    const total = result.allocations.reduce((acc, a) => acc + a.recommendedWeeklyMinutes, 0);
    // Arredondamento em blocos de 15 min: até ±7,5 min por matéria
    expect(Math.abs(total - result.totalWeeklyMinutesBudget)).toBeLessThanOrEqual(7.5 * result.allocations.length);
    expect(result.daysUntilExam).toBe(53);
  });

  it('Arquitetura e Persistência ficam entre as 3 matérias com mais tempo', () => {
    const top3 = [...result.allocations]
      .sort((a, b) => b.recommendedWeeklyMinutes - a.recommendedWeeklyMinutes)
      .slice(0, 3)
      .map((a) => a.subject.name);
    expect(top3).toContain('Arquitetura e Integração de Sistemas');
    expect(top3).toContain('Persistência, Integração e Proteção de Dados');
  });

  it('a prova específica (vale o dobro) recebe a maior parte do tempo', () => {
    const minutesByPart = new Map<string, number>();
    for (const a of result.allocations) {
      const code = a.subject.exam_part_id!.replace('part-', '');
      minutesByPart.set(code, (minutesByPart.get(code) ?? 0) + a.recommendedWeeklyMinutes);
    }
    const total = [...minutesByPart.values()].reduce((x, y) => x + y, 0);
    expect(minutesByPart.get('P3')! / total).toBeGreaterThan(0.5);
  });

  it('matéria fraca vale mais tempo que uma forte da mesma prova', () => {
    expect(minutesOf('Fundamentos de Direito Público Aplicado, Controle e Responsabilização')).toBeGreaterThan(
      minutesOf('Fundamentos de Auditoria Governamental e Atuação Integrada da CGU')
    );
  });

  it('dentro de Engenharia de Software, programação e concorrência esquentam mais que requisitos', () => {
    const heatOf = (code: string) =>
      result.topicHeatmapRanking.find((t) => t.subjectName === 'Engenharia de Software e Programação' && t.topic.code === code)!
        .heatScore;
    expect(heatOf('3.1')).toBeGreaterThan(heatOf('1.1'));
    expect(heatOf('2.1')).toBeGreaterThan(heatOf('1.1'));
  });

  it('explica o tempo das básicas fracas pela nota mínima', () => {
    const estado = result.allocations.find((a) => a.subject.name.startsWith('Estado'))!;
    expect(estado.dominantReason).toBe('Tempo garantido para a nota mínima da P1 (Conhecimentos básicos)');
  });
});
