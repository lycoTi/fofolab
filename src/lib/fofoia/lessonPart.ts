/**
 * Aula em partes: lê "Parte N de M" do topo da resposta para mostrar o "Continuar". O prompt pede esse formato, mas o
 * modelo às vezes escreve "Parte 1/3" ou "Parte 1 de 3:" com Markdown em volta — tudo isso conta.
 */
export function readLessonPart(text: string): { n: number; total: number } | null {
  const match = /Parte\s+(\d+)\s*(?:de|\/)\s*(\d+)/i.exec(text);
  if (!match) return null;
  const n = Number(match[1]);
  const total = Number(match[2]);
  if (n < 1 || total < n) return null;
  return { n, total };
}
