import { aiPauseReply, callAiProviders, getAiStatus, type AiReply, type ChatTurn } from '../aiRouter';
import type { FofoContext } from './context';
import { trimCutReply } from './cut';
import { demoFofoReply } from './demo';
import type { EditalCandidate } from './editalMatch';
import { buildFofoPrompt, type FofoPromptExtra } from './prompts';
import type { FofoMode } from './signals';
import { isTrueFalseQuestion, trueFalseHint } from './trueFalseHint';

/** Linha acolhedora quando o provedor falha; o detalhe técnico fica só no console. */
export const FOFO_UNAVAILABLE_REPLY = 'Não consegui falar com a IA agora. Tente de novo em instantes.';

/**
 * Teto de resposta por jeito (tokens). Cabe no limite grátis do Groq (1.000 por minuto) e segura o tamanho que o prompt
 * pede: a aula vem em partes justamente para cada parte caber no teto.
 */
export const MODE_MAX_TOKENS: Record<FofoMode, number> = {
  QUICK: 350,
  FROM_ZERO: 600,
  LESSON: 900,
  SUMMARY: 300,
  EDITAL: 400,
  HINT: 350,
  CONTRAST: 600,
};

/** Aula completa e "Cai no meu edital?" podem usar o modelo mais forte, se configurado ("pensar mais"). */
export function isStrongMode(mode: FofoMode): boolean {
  return mode === 'LESSON' || mode === 'EDITAL';
}

export async function askFofoIa(input: {
  mode: FofoMode;
  ctx: FofoContext;
  conversation: ChatTurn[];
  message: string;
  extra?: FofoPromptExtra & { hintsGiven?: number };
}): Promise<AiReply> {
  const { mode, ctx, conversation, message, extra } = input;
  const active = ctx.activeQuestion;
  if (mode === 'HINT' && active && !active.answered && isTrueFalseQuestion(active.question)) {
    const topicLabel = `${ctx.student.currentTopicCode} ${ctx.student.currentTopicTitle}`.trim();
    return { reply: trueFalseHint(topicLabel, extra?.hintsGiven ?? 0), provider: 'LOCAL', simulated: false };
  }
  if (!getAiStatus().configured) {
    return { reply: demoFofoReply(mode, ctx, message, extra), provider: 'OFFLINE_DEMO', simulated: true };
  }
  const result = await callAiProviders(buildFofoPrompt(mode, ctx, conversation, message, extra), {
    strong: isStrongMode(mode),
    maxTokens: MODE_MAX_TOKENS[mode],
  });
  if (!result.ok) {
    const reply = result.retryAfterSec === null ? FOFO_UNAVAILABLE_REPLY : aiPauseReply(result.retryAfterSec);
    return { reply, provider: 'OFFLINE_DEMO', simulated: false, failed: true };
  }
  if (result.truncated) return { reply: trimCutReply(result.text), provider: result.provider, simulated: false, cut: true };
  return { reply: result.text, provider: result.provider, simulated: false };
}
