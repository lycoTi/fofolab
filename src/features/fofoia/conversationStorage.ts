import type { FofoTurn } from './useFofoConversation';

/** Conversas em andamento neste computador: mapa indexado por questão ou tópico para não perder nem misturar contextos. */
export const FOFO_CONVERSATION_KEY = 'fofolab_fofoia_conversa_v1';

/** Depois disso a conversa é dada como encerrada (contado da última mensagem). */
export const RESTORE_WINDOW_MS = 20 * 60 * 1000;

export interface SavedSession {
  savedAt: number;
  turns: FofoTurn[];
}

export type SavedSessionsMap = Record<string, SavedSession>;

export function loadAllSavedSessions(): SavedSessionsMap {
  try {
    const raw = JSON.parse(localStorage.getItem(FOFO_CONVERSATION_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return {};
    // Retrocompatibilidade se tiver formato legado { topicKey, savedAt, turns }
    if ('topicKey' in raw && Array.isArray((raw as { turns?: unknown }).turns)) {
      const leg = raw as { topicKey?: string; savedAt?: number; turns: FofoTurn[] };
      return { [`t:${leg.topicKey}`]: { savedAt: leg.savedAt ?? Date.now(), turns: leg.turns } };
    }
    return raw as SavedSessionsMap;
  } catch {
    return {};
  }
}

export function loadSavedTurns(sessionKey: string): FofoTurn[] {
  const sessions = loadAllSavedSessions();
  const session = sessions[sessionKey];
  if (!session || typeof session.savedAt !== 'number' || !Array.isArray(session.turns)) return [];
  if (Date.now() - session.savedAt > RESTORE_WINDOW_MS) return [];
  return session.turns;
}

export function saveSessionTurns(sessionKey: string, turns: FofoTurn[]): void {
  try {
    const sessions = loadAllSavedSessions();
    if (turns.length === 0) {
      delete sessions[sessionKey];
    } else {
      sessions[sessionKey] = { savedAt: Date.now(), turns };
    }
    // Retém até 50 sessões recentes ativas no limite de 20 minutos para segurar espaço
    const entries = Object.entries(sessions)
      .filter(([, s]) => Date.now() - s.savedAt <= RESTORE_WINDOW_MS)
      .sort((a, b) => b[1].savedAt - a[1].savedAt)
      .slice(0, 50);
    localStorage.setItem(FOFO_CONVERSATION_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Sem localStorage (janela privada)
  }
}
