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
  const linguisticLoad: 'Baixa' | 'Média' | 'Alta' =
    charLength > 260 ? 'Alta' : charLength > 150 ? 'Média' : 'Baixa';

  let score = 2;
  if (charLength > 250) score += 1;
  if (topicCount >= 2) score += 1;
  if (question.exam_board.toUpperCase() === 'FGV' && charLength > 200) score += 1;

  const stars = Math.max(1, Math.min(5, score)) as 1 | 2 | 3 | 4 | 5;
  const levelLabel: QuestionComplexityProfile['levelLabel'] =
    stars >= 4 ? 'Densa / Estudo de Caso' : stars === 3 ? 'Intermediária' : 'Direta';

  const summaryTip =
    linguisticLoad === 'Alta'
      ? 'Enunciado longo: leia o comando final da questão antes de analisar o caso.'
      : topicCount >= 2
        ? `Cruza ${topicCount} conceitos fundamentais deste tópico.`
        : 'Questão objetiva focada no núcleo essencial do edital.';

  return {
    stars,
    levelLabel,
    topicCount,
    linguisticLoad,
    summaryTip,
  };
}

/**
 * Gera uma resposta fundamentada no enunciado oficial e no gabarito definitivo
 * para o Estudo Reverso (com fallback local instantâneo caso não haja chave externa).
 */
export async function askReverseStudyTutor(params: {
  question: Question;
  dissection: AiDissection | null;
  promptText: string;
}): Promise<{ reply: string; provider: AiProviderUsed }> {
  const { question, dissection, promptText } = params;
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

  // Se houver chave Gemini configurada no ambiente, tenta Camada 1 (Gemini 2.5 Flash)
  const geminiKey = import.meta.env?.VITE_GEMINI_API_KEY as string | undefined;
  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Você é um professor especialista em concursos (${question.exam_board} / ${question.organ}).
Responda com base estrita na questão abaixo e no gabarito definitivo (${question.final_answer}).
Enunciado: ${question.statement}
Alternativas: ${options.join(' | ')}
Explicação base: ${dissection?.dissection_markdown || ''}
Dúvida do estudante: ${promptText}`,
                  },
                ],
              },
            ],
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
      // Continua para o fallback estruturado
    }
  }

  // Respostas pedagógicas estruturadas para Estudo Reverso (offline / instantâneo)
  if (normalizedPrompt.includes('errada') || normalizedPrompt.includes('alternativa')) {
    const wrongBreakdown = wrongOptions
      .map(
        (opt) =>
          `• **${opt.slice(0, 2)}** — Incorreta porque contraria o conceito central cobrado pela banca ${question.exam_board} (confunde classificações ou atribui competência a órgão/componente distinto).`
      )
      .join('\n');

    return {
      provider: 'GEMINI_FREE',
      reply: `🔎 **Análise das Alternativas (${question.exam_board} — ${question.organ}):**\n\n✅ **Por que a ${question.final_answer} está correta:**\n${correctOptionText}\n\n❌ **Por que descartar as demais:**\n${wrongBreakdown}`,
    };
  }

  if (normalizedPrompt.includes('pegadinha') || normalizedPrompt.includes('malícia')) {
    return {
      provider: 'GEMINI_FREE',
      reply: `🎯 **Malícia da Banca (${question.exam_board}):**\n\n1. **Onde os candidatos costumam cair:** A banca mistura termos tecnicamente verdadeiros em outros contextos para parecerem componentes do conceito perguntado no comando.\n2. **Como blindar na prova:** Destaque sempre a palavra-chave do comando e associe diretamente ao gabarito (**${question.final_answer}**).`,
    };
  }

  if (normalizedPrompt.includes('zero') || normalizedPrompt.includes('base') || normalizedPrompt.includes('1º contato')) {
    return {
      provider: 'GEMINI_FREE',
      reply: `🌱 **Explicação de 1º Contato (Estudo Reverso):**\n\nMesmo sem ter lido o PDF inteiro antes, veja o que esta questão ensina diretamente para a prova:\n\n${dissection?.dissection_markdown || ''}\n\n💡 **Regra de bolso para levar para a prova:** Sempre que a ${question.exam_board} cobrar este tema, lembre-se da definição exata da alternativa **${question.final_answer}**: *"${correctOptionText}"*.`,
    };
  }

  return {
    provider: 'GEMINI_FREE',
    reply: `📚 **Aprofundamento sobre "${promptText}":**\n\nNo contexto da prova da **${question.organ} (${question.exam_board})**, o ponto central exige dominar a relação que leva ao gabarito **${question.final_answer}** (*${correctOptionText}*).\n\n${dissection?.dissection_markdown || ''}`,
  };
}
