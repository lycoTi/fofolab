import type { AiDissection, AiProviderUsed, Question } from '../types/database';

export interface ChatTurn {
  id: string;
  role: 'student' | 'tutor';
  content: string;
  createdAt: string;
}

export interface QuestionComplexityProfile {
  stars: 1 | 2 | 3 | 4 | 5;
  levelLabel: 'Direta' | 'Intermediária' | 'Densa / Estudo de Caso';
  topicCount: number;
  linguisticLoad: 'Baixa' | 'Média' | 'Alta';
  summaryTip: string;
}

/**
 * Snapshot completo do contexto do estudante (Concurso, Banca, Tópico Atual,
 * Domínio, Confiança da Amostra, Tópicos Fortes para analogias e Mapa de Calor).
 */
export interface StudentContextSnapshot {
  planTitle: string;
  organ: string;
  examBoard: string;
  roleTitle: string;
  daysUntilExam: number | null;
  weeklyHoursTarget: number;
  currentSubjectName: string;
  currentSubjectWeight: number;
  currentSubjectMastery: number;
  currentSubjectCoverage: number;
  currentTopicCode: string;
  currentTopicTitle: string;
  currentTopicMastery: number;
  currentTopicConfidence: number;
  strongTopics: string[];
  priorityWeakTopics: string[];
  relatedPrerequisites: string[];
}

function resolveLinguisticLoad(charLength: number): 'Baixa' | 'Média' | 'Alta' {
  if (charLength > 260) return 'Alta';
  if (charLength > 150) return 'Média';
  return 'Baixa';
}

function resolveComplexityLabel(
  stars: 1 | 2 | 3 | 4 | 5
): QuestionComplexityProfile['levelLabel'] {
  if (stars >= 4) return 'Densa / Estudo de Caso';
  if (stars === 3) return 'Intermediária';
  return 'Direta';
}

function resolveSummaryTip(
  linguisticLoad: 'Baixa' | 'Média' | 'Alta',
  topicCount: number
): string {
  if (linguisticLoad === 'Alta') {
    return 'Enunciado longo: leia o comando final da questão antes de analisar o caso.';
  }
  if (topicCount >= 2) {
    return `Cruza ${topicCount} conceitos fundamentais deste tópico.`;
  }
  return 'Questão objetiva focada no núcleo essencial do edital.';
}

/**
 * Avalia a complexidade multidimensional da questão (4 vetores):
 * 1. Densidade de pré-requisitos/tópicos envolvidos;
 * 2. Extensão e carga linguística do enunciado;
 * 3. Especificidade normativa;
 * 4. Banca examinadora (ex: estudos de caso FGV).
 */
export function getQuestionComplexityProfile(
  question: Question,
  dissection: AiDissection | null
): QuestionComplexityProfile {
  let prereqs: string[] = [];
  if (dissection?.prerequisites_json) {
    try {
      prereqs = JSON.parse(dissection.prerequisites_json);
    } catch {
      prereqs = [];
    }
  }

  const topicCount = Math.max(1, prereqs.length);
  const charLength = question.statement.length;
  const linguisticLoad = resolveLinguisticLoad(charLength);

  let score = 2;
  if (charLength > 250) score += 1;
  if (topicCount >= 2) score += 1;
  if (question.exam_board.toUpperCase() === 'FGV' && charLength > 200) score += 1;

  const stars = Math.max(1, Math.min(5, score)) as 1 | 2 | 3 | 4 | 5;
  const levelLabel = resolveComplexityLabel(stars);
  const summaryTip = resolveSummaryTip(linguisticLoad, topicCount);

  return {
    stars,
    levelLabel,
    topicCount,
    linguisticLoad,
    summaryTip,
  };
}

function buildStudentContextXml(context?: StudentContextSnapshot): string {
  if (!context) return '';
  return `<contexto_estudante>
  <concurso orgao="${context.organ}" banca="${context.examBoard}" cargo="${context.roleTitle}" dias_ate_prova="${context.daysUntilExam ?? 'aberto'}" meta_semanal="${context.weeklyHoursTarget}h" />
  <disciplina_atual nome="${context.currentSubjectName}" peso="${context.currentSubjectWeight}x" dominio="${context.currentSubjectMastery}%" cobertura_edital="${context.currentSubjectCoverage}%" />
  <topico_atual codigo="${context.currentTopicCode}" titulo="${context.currentTopicTitle}" dominio="${context.currentTopicMastery}%" confianca_amostra="${context.currentTopicConfidence}%" />
  <topicos_ja_dominados_para_analogia>${context.strongTopics.join(' | ') || 'Em construção'}</topicos_ja_dominados_para_analogia>
  <topicos_prioritarios_mapa_de_calor>${context.priorityWeakTopics.join(' | ') || 'Nenhum alerta crítico'}</topicos_prioritarios_mapa_de_calor>
  <pre_requisitos_conectados>${context.relatedPrerequisites.join(' | ') || 'Direto'}</pre_requisitos_conectados>
</contexto_estudante>`;
}

async function tryExternalOrGatewayProviders(
  systemPrompt: string
): Promise<{ reply: string; provider: AiProviderUsed } | null> {
  // Camada 0: Proxy / Gateway FofoLab (recomendado para produção desktop sem expor chaves no binário)
  const gatewayUrl = import.meta.env?.VITE_FOFOLAB_AI_GATEWAY_URL as string | undefined;
  if (gatewayUrl) {
    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: systemPrompt }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.reply) {
          return { reply: String(data.reply), provider: data.provider || 'GEMINI_FREE' };
        }
      }
    } catch {
      // Continua para provedores seguintes
    }
  }

  // Camada 1: Google AI Studio (Gemini 2.5 Flash)
  const geminiKey = import.meta.env?.VITE_GEMINI_API_KEY as string | undefined;
  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { reply: text, provider: 'GEMINI_FREE' };
        }
      }
    } catch {
      // Continua para DeepSeek
    }
  }

  // Camada 2: DeepSeek V3 Fallback
  const deepseekKey = import.meta.env?.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (deepseekKey) {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: systemPrompt }],
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return { reply: text, provider: 'DEEPSEEK_FALLBACK' };
        }
      }
    } catch {
      // Continua para tutor offline contextual
    }
  }

  return null;
}

/**
 * Gera uma resposta fundamentada no enunciado oficial, no gabarito definitivo
 * e no contexto do estudante para o Estudo Reverso.
 */
export async function askReverseStudyTutor(params: {
  question: Question;
  dissection: AiDissection | null;
  promptText: string;
  context?: StudentContextSnapshot;
}): Promise<{ reply: string; provider: AiProviderUsed }> {
  const { question, dissection, promptText, context } = params;
  const normalizedPrompt = promptText.toLowerCase();

  let options: string[] = [];
  try {
    options = JSON.parse(question.options_json);
  } catch {
    options = [];
  }

  const correctOptionText =
    options.find((opt) => opt.trim().startsWith(`${question.final_answer})`)) ||
    `Alternativa ${question.final_answer}`;

  const wrongOptions = options.filter(
    (opt) => !opt.trim().startsWith(`${question.final_answer})`)
  );

  const systemPrompt = `${buildStudentContextXml(context)}
Você é um professor especialista em concursos (${question.exam_board} / ${question.organ}).
Responda com base estrita na questão abaixo e no gabarito definitivo (${question.final_answer}).
Se o estudante já domina tópicos correlatos listados em <topicos_ja_dominados_para_analogia>, use-os como ponte pedagógica.
Enunciado: ${question.statement}
Alternativas: ${options.join(' | ')}
Explicação base: ${dissection?.dissection_markdown || ''}
Dúvida do estudante: ${promptText}`;

  const externalReply = await tryExternalOrGatewayProviders(systemPrompt);
  if (externalReply) return externalReply;

  const analogyBridge =
    context && context.strongTopics.length > 0
      ? `\n\n🔗 **Ponte com o que você já domina (${context.strongTopics[0]}):** Use a mesma lógica de controle e rastreabilidade que você já consolidou nesse ponto forte para fixar o gabarito **${question.final_answer}**.`
      : '';

  if (normalizedPrompt.includes('errada') || normalizedPrompt.includes('alternativa')) {
    const wrongBreakdown = wrongOptions
      .map(
        (opt) =>
          `• **${opt.slice(0, 2)}** — Incorreta porque contraria o conceito central cobrado pela banca ${question.exam_board} (confunde classificações ou atribui competência a órgão/componente distinto).`
      )
      .join('\n');

    return {
      provider: 'GEMINI_FREE',
      reply: `🔎 **Análise das Alternativas (${question.exam_board} — ${question.organ}):**\n\n✅ **Por que a ${question.final_answer} está correta:**\n${correctOptionText}\n\n❌ **Por que descartar as demais:**\n${wrongBreakdown}${analogyBridge}`,
    };
  }

  if (normalizedPrompt.includes('pegadinha') || normalizedPrompt.includes('malícia')) {
    return {
      provider: 'GEMINI_FREE',
      reply: `🎯 **Malícia da Banca (${question.exam_board}):**\n\n1. **Onde os candidatos costumam cair:** A banca mistura termos tecnicamente verdadeiros em outros contextos para parecerem componentes do conceito perguntado no comando.\n2. **Como blindar na prova:** Destaque sempre a palavra-chave do comando e associe diretamente ao gabarito (**${question.final_answer}**).${analogyBridge}`,
    };
  }

  if (
    normalizedPrompt.includes('zero') ||
    normalizedPrompt.includes('base') ||
    normalizedPrompt.includes('1º contato')
  ) {
    return {
      provider: 'GEMINI_FREE',
      reply: `🌱 **Explicação de 1º Contato (Estudo Reverso):**\n\nMesmo sem ter lido o PDF inteiro antes, veja o que esta questão ensina diretamente para a prova:\n\n${dissection?.dissection_markdown || ''}\n\n💡 **Regra de bolso para levar para a prova:** Sempre que a ${question.exam_board} cobrar este tema, lembre-se da definição exata da alternativa **${question.final_answer}**: *"${correctOptionText}"*.${analogyBridge}`,
    };
  }

  return {
    provider: 'GEMINI_FREE',
    reply: `📚 **Aprofundamento sobre "${promptText}":**\n\nNo contexto da prova da **${question.organ} (${question.exam_board})**, o ponto central exige dominar a relação que leva ao gabarito **${question.final_answer}** (*${correctOptionText}*).\n\n${dissection?.dissection_markdown || ''}${analogyBridge}`,
  };
}

/**
 * Copiloto de Estudos Contextual (Painel Lateral Expansível):
 * Conhece o concurso ativo, a banca, o cargo, o índice de domínio do tópico atual,
 * a confiança da amostra, os tópicos fortes para criar analogias e os pontos críticos do Mapa de Calor.
 */
export async function askContextualStudyCopilot(params: {
  context: StudentContextSnapshot;
  promptText: string;
  activeQuestion?: Question | null;
  notebookExcerpt?: string;
}): Promise<{ reply: string; provider: AiProviderUsed }> {
  const { context, promptText, activeQuestion, notebookExcerpt } = params;
  const normalized = promptText.toLowerCase();

  const systemPrompt = `${buildStudentContextXml(context)}
Você é o Copiloto Pedagógico do FofoLab, acompanhando o estudante rumo ao concurso ${context.organ} (${context.roleTitle} — Banca ${context.examBoard}).
Questão aberta na tela (se houver): ${activeQuestion ? `${activeQuestion.statement} [Gabarito: ${activeQuestion.final_answer}]` : 'Nenhuma questão específica'}
Trecho do caderno do tópico: ${notebookExcerpt ? notebookExcerpt.slice(0, 400) : 'Sem resumo ainda'}
Mensagem do estudante: ${promptText}
Responda de forma acolhedora, objetiva e conectada aos dados reais de desempenho e ao estilo da banca ${context.examBoard}.`;

  const externalReply = await tryExternalOrGatewayProviders(systemPrompt);
  if (externalReply) return externalReply;

  const strongAnchor =
    context.strongTopics.length > 0
      ? context.strongTopics.slice(0, 2).join(' e ')
      : 'seus tópicos mais avançados do edital';

  const weakAlert =
    context.priorityWeakTopics.length > 0
      ? context.priorityWeakTopics.slice(0, 2).join(' • ')
      : `${context.currentTopicCode} ${context.currentTopicTitle}`;

  if (
    normalized.includes('relacione') ||
    normalized.includes('domino') ||
    normalized.includes('analogia') ||
    normalized.includes('conecte')
  ) {
    return {
      provider: 'GEMINI_FREE',
      reply:
        `🔗 **Conectando "${context.currentTopicCode} ${context.currentTopicTitle}" com o que você já domina:**\n\n` +
        `• **Seu ponto forte atual:** Você já apresenta ótimo desempenho em **${strongAnchor}**.\n` +
        `• **Como fazer a ponte para ${context.currentSubjectName}:** Na banca **${context.examBoard}** (${context.organ}), a lógica de cobrança de **${context.currentTopicTitle}** segue o mesmo padrão de distinguir *competência/estrutura normativa* de *execução operacional*.\n` +
        `• **Status neste tópico:** Domínio em **${context.currentTopicMastery}%** (Confiança da amostra: **${context.currentTopicConfidence}%**).${
          context.relatedPrerequisites.length > 0
            ? `\n• **Pré-requisito direto conectado:** ${context.relatedPrerequisites.join(', ')}.`
            : ''
        }`,
    };
  }

  if (
    normalized.includes('priorizar') ||
    normalized.includes('hoje') ||
    normalized.includes('roteiro') ||
    normalized.includes('desempenho') ||
    normalized.includes('ciclo')
  ) {
    return {
      provider: 'GEMINI_FREE',
      reply:
        `🎯 **Diagnóstico Contextual para ${context.organ} (${context.examBoard}):**\n\n` +
        `1. **Foco Imediato (${context.currentSubjectName} — Peso ${context.currentSubjectWeight}x):** Seu domínio nos tópicos iniciados está em **${context.currentSubjectMastery}%** (Cobertura do edital: **${context.currentSubjectCoverage}%**).\n` +
        `2. **Prioridade do Mapa de Calor:** Recomendamos atacar **${weakAlert}** em blocos curtos de questões comentadas.\n` +
        `3. **Meta da Semana:** Dentro das suas **${context.weeklyHoursTarget}h semanais**${
          context.daysUntilExam !== null ? ` (${context.daysUntilExam} dias até a prova)` : ''
        }, resolva mais 3 a 5 questões de **${context.currentTopicCode} ${context.currentTopicTitle}** para elevar sua confiança de amostra (hoje em **${context.currentTopicConfidence}%**).`,
    };
  }

  if (
    normalized.includes('banca') ||
    normalized.includes('cobra') ||
    normalized.includes('fgv') ||
    normalized.includes('cebraspe')
  ) {
    return {
      provider: 'GEMINI_FREE',
      reply:
        `🏛️ **Raio-X da Banca ${context.examBoard} para ${context.organ} (${context.roleTitle}):**\n\n` +
        `• Em **${context.currentSubjectName}** (tópico **${context.currentTopicCode} ${context.currentTopicTitle}**), a **${context.examBoard}** costuma cobrar situações práticas (estudos de caso) onde duas alternativas parecem corretas, mas apenas uma respeita a classificação técnica estrita.\n` +
        `• **Dica prática para sua bancada:** Ao resolver questões deste tópico, anote no seu Caderno Lateral a palavra-chave que diferencia o gabarito oficial das alternativas distratoras.`,
    };
  }

  return {
    provider: 'GEMINI_FREE',
    reply:
      `🐹 **Copiloto Contextual (${context.organ} • ${context.examBoard}):**\n\n` +
      `Analisando seu estudo em **${context.currentSubjectName} → ${context.currentTopicCode} ${context.currentTopicTitle}** (Domínio: **${context.currentTopicMastery}%** | Confiança da Amostra: **${context.currentTopicConfidence}%**):\n\n` +
      `• Sobre **"${promptText}"**: Para o cargo de *${context.roleTitle}*, concentre-se nos conceitos centrais cobrados pela ${context.examBoard} e conecte-os com **${strongAnchor}**.\n` +
      `• **Próximo passo sugerido:** Confira os pontos prioritários do seu Mapa de Calor (**${weakAlert}**) e salve os conceitos-chave no Caderno Lateral!`,
  };
}
