/**
 * Aquecimento antes da aula (spec 11 §5.4, camada 3): aparece uma vez por tópico. Guardado neste computador — é
 * conforto de tela, não dado de estudo.
 */
const WARMUP_KEY = 'fofolab_warmup_seen_v1';

function readSeen(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(WARMUP_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

export function warmupSeen(topicId: string): boolean {
  return readSeen().includes(topicId);
}

export function markWarmupSeen(topicId: string): void {
  try {
    const seen = readSeen();
    if (!seen.includes(topicId)) localStorage.setItem(WARMUP_KEY, JSON.stringify([...seen, topicId]));
  } catch {
    // Sem localStorage (janela privada): o convite só pode reaparecer
  }
}
