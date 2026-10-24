import { callAiProviders, getAiStatus, type AiReply, type ChatTurn } from '../aiRouter';
import type { FofoContext } from './context';
import { demoFofoReply } from './demo';
import type { EditalCandidate } from './editalMatch';
import { buildFofoPrompt } from './prompts';
import type { FofoMode } from './signals';

/** Linha acolhedora quando o provedor falha; o detalhe técnico fica só no console. */
export const FOFO_UNAVAILABLE_REPLY = 'Não consegui falar com a IA agora. Tente de novo em instantes.';

/** Aula completa e "Cai no meu edital?" podem usar o modelo mais forte, se configurado ("pensar mais"). */
export function isStrongMode(mode: FofoMode): boolean {
  return mode === 'LESSON' || mode === 'EDITAL';
}

export async function askFofoIa(input: {
  mode: FofoMode;
  ctx: FofoContext;
  conversation: ChatTurn[];
  message: string;
  extra?: { editalCandidates?: EditalCandidate[]; part?: number };
}): Promise<AiReply> {
  const { mode, ctx, conversation, message, extra } = input;
  if (!getAiStatus().configured) {
    return { reply: demoFofoReply(mode, ctx, message, extra), provider: 'OFFLINE_DEMO', simulated: true };
  }
  const result = await callAiProviders(buildFofoPrompt(mode, ctx, conversation, message, extra), { strong: isStrongMode(mode) });
  if (!result) return { reply: FOFO_UNAVAILABLE_REPLY, provider: 'OFFLINE_DEMO', simulated: false, failed: true };
  return { reply: result.text, provider: result.provider, simulated: false };
}
