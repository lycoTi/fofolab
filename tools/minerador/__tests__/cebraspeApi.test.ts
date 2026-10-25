// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { eventDetailUrl, eventListUrl, fileUrl, FormatoCebraspeMudou, parseEventDetail, parseEventList } from '../cebraspeApi';

const fixture = (name: string): unknown => JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8'));

function campoDoErro(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof FormatoCebraspeMudou ? err.campo : 'outro erro';
  }
}

describe('API da Cebraspe: lista e detalhe validados', () => {
  it('achata os grupos da lista de concursos encerrados', () => {
    const events = parseEventList(fixture('eventos-encerrado.json'));
    expect(events).toHaveLength(5);
    const serpro = events.find((e) => e.identificador === 'SERPRO_23');
    expect(serpro).toEqual({ identificador: 'SERPRO_23', nome: 'SERPRO 23', ano: 2023, tipo: 'concursos', status: 'encerrado' });
  });

  it('o detalhe junta os arquivos de gabarito e de edital e traz as áreas', () => {
    const detail = parseEventDetail(fixture('evento-SERPRO_23.json'));
    expect(detail.identificador).toBe('SERPRO_23');
    expect(detail.areas).toContain('ANALISTA – ESPECIALIZAÇÃO: TECNOLOGIA');
    expect(detail.arquivos.map((a) => a.nomeArquivo)).toContain('846_SERPRO_23_001_01.PDF');
    expect(detail.arquivos.some((a) => a.descricao.startsWith('Edital nº'))).toBe(true);
  });

  it('formato inesperado para com o nome do campo que faltou', () => {
    expect(campoDoErro(() => parseEventList({}))).toBe('eventos');
    expect(campoDoErro(() => parseEventList([{ faseEvento: 'x', ordem: 1, eventos: [{ eventoAno: 2023 }] }]))).toBe('eventoURL');
    // Identificador que viraria caminho fora do acervo ("../") também é formato inesperado
    expect(campoDoErro(() => parseEventDetail({ eventoURL: '../x', eventoAno: 2023, eventoTipo: 'concursos', arquivosGabarito: [], arquivosEdital: [], eventoCargos: [] }))).toBe('eventoURL');
    expect(campoDoErro(() => parseEventDetail({ eventoURL: 'X_23', eventoAno: 2023, eventoTipo: 'concursos' }))).toBe('arquivosGabarito');
  });

  it('monta os endereços da API e do CDN', () => {
    expect(eventListUrl()).toBe('https://apis.cebraspe.org.br/cebraspe/eventos/tipo/concursos/fase/encerrado');
    expect(eventDetailUrl('SERPRO_23')).toBe('https://apis.cebraspe.org.br/cebraspe/eventos/SERPRO_23');
    expect(fileUrl('concursos', 'SERPRO_23', '846_SERPRO_23_001_01.PDF')).toBe(
      'https://cdn.cebraspe.org.br/concursos/SERPRO_23/arquivos/846_SERPRO_23_001_01.PDF'
    );
  });
});
