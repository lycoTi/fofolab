/**
 * Toda duração na tela aparece em HH:mm ("04:00", "00:47", "21:00"), nunca em minutos soltos
 * ("240 min") ou horas decimais ("0.8h"). Contagens regressivas de relógio usam mm:ss.
 */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  return `${String(hours).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Relógio de contagem: "18:42" (mm:ss); a partir de 1 hora, "1:05:09". */
export function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}
