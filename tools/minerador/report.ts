/** Relatório de uma rodada do minerador (spec 12 §6.3): o que entrou, o que ficou de fora e por quê. */
export interface RunReport {
  concursos: number;
  provas: number;
  itens: number;
  anulados: number;
  comCodigo: number;
  comFigura: number;
  quarentena: { caderno: string; motivo: string }[];
  pendentes: string[];
  falhas: { identificador: string; erro: string }[];
  baixados: number;
  doCache: number;
}

export function emptyReport(): RunReport {
  return { concursos: 0, provas: 0, itens: 0, anulados: 0, comCodigo: 0, comFigura: 0, quarentena: [], pendentes: [], falhas: [], baixados: 0, doCache: 0 };
}

export function formatReport(r: RunReport): string {
  const lines = [
    '== Minerador da Cebraspe ==',
    `Concursos com itens: ${r.concursos}`,
    `Provas extraídas: ${r.provas}`,
    `Itens extraídos: ${r.itens} (anulados: ${r.anulados}; com código: ${r.comCodigo}; dependem de figura: ${r.comFigura})`,
    `Arquivos baixados agora: ${r.baixados} · já estavam no cache: ${r.doCache}`,
  ];
  if (r.quarentena.length > 0) {
    lines.push(`Quarentena (${r.quarentena.length}) — nada destas provas entrou:`);
    for (const q of r.quarentena) lines.push(`  ${q.caderno}: ${q.motivo}`);
  }
  if (r.pendentes.length > 0) lines.push(`Sem gabarito definitivo ainda (${r.pendentes.length}): ${r.pendentes.join(', ')}`);
  if (r.falhas.length > 0) {
    lines.push(`Falhas de rede (${r.falhas.length}) — tentadas de novo na próxima rodada:`);
    for (const f of r.falhas) lines.push(`  ${f.identificador}: ${f.erro}`);
  }
  return lines.join('\n');
}
