import { describe, expect, it } from 'vitest';
import { detectLawReferences } from '../lib/laws/detector';

describe('Detector de Referências a Leis (Fatia 11.2.3)', () => {
  it('detecta referência à CF/88 e artigo específico no enunciado', () => {
    const text = 'De acordo com a Constituição Federal de 1988, art. 37, § 6º, as pessoas jurídicas de direito público responderão pelos danos causados por seus agentes.';
    const detected = detectLawReferences(text);

    expect(detected).toHaveLength(1);
    expect(detected[0]).toEqual({
      lawId: 'cf88',
      articleKey: '37',
      rawReference: 'Art. 37 (cf88)',
    });
  });

  it('detecta menções abreviadas como CF/88 ou Carta Magna', () => {
    const text1 = 'Nos termos do art. 5º da CF/88, todos são iguais perante a lei.';
    const detected1 = detectLawReferences(text1);
    expect(detected1).toHaveLength(1);
    expect(detected1[0].lawId).toBe('cf88');
    expect(detected1[0].articleKey).toBe('5');

    const text2 = 'Conforme preceitua o art. 103-A da Carta Magna:';
    const detected2 = detectLawReferences(text2);
    expect(detected2).toHaveLength(1);
    expect(detected2[0].lawId).toBe('cf88');
    expect(detected2[0].articleKey).toBe('103-a');
  });

  it('detecta referência à Lei 8.112/90 (Estatuto dos Servidores Federais)', () => {
    const text = 'Com base na Lei nº 8.112/1990, art. 20, o servidor nomeado para cargo efetivo ficará sujeito a estágio probatório.';
    const detected = detectLawReferences(text);

    expect(detected).toHaveLength(1);
    expect(detected[0]).toEqual({
      lawId: 'lei-8112-1990',
      articleKey: '20',
      rawReference: 'Art. 20 (lei-8112-1990)',
    });
  });

  it('detecta referência à Nova Lei de Licitações (Lei 14.133/2021)', () => {
    const text = 'Segundo a Lei 14.133/21, art. 74, é inexigível a licitação quando inviável a competição.';
    const detected = detectLawReferences(text);

    expect(detected).toHaveLength(1);
    expect(detected[0].lawId).toBe('lei-14133-2021');
    expect(detected[0].articleKey).toBe('74');
  });

  it('detecta referências a múltiplos artigos na mesma questão (máx 3)', () => {
    const text = 'Considerando os arts. 37 e 41 da CF/88 e o art. 5º...';
    const detected = detectLawReferences(text);

    expect(detected.length).toBeGreaterThanOrEqual(2);
    expect(detected.map((d) => d.articleKey)).toContain('37');
    expect(detected.map((d) => d.articleKey)).toContain('41');
  });

  it('retorna array vazio quando o texto não contém menção a normas ou artigos', () => {
    expect(detectLawReferences('Em microsserviços, a comunicação assíncrona desacopla os serviços.')).toEqual([]);
    expect(detectLawReferences('O algoritmo de Dijkstra calcula o caminho mais curto.')).toEqual([]);
    expect(detectLawReferences('')).toEqual([]);
  });
});

