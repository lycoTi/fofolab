import { describe, expect, it } from 'vitest';
import { shortSubjectName } from '../lib/subjectShortName';

describe('Nome curto da matéria para os cartões da semana (spec 13)', () => {
  it('matérias do edital da CGU 2026 (cargo 4) ficam reconhecíveis em até 22 letras', () => {
    const cases: [string, string][] = [
      ['Arquitetura e Integração de Sistemas', 'Arquitetura'],
      ['Desenvolvimento Seguro, Qualidade e Gestão da Entrega', 'Desenv. Seguro'],
      ['Engenharia de Software e Programação', 'Eng. de Software'],
      ['Persistência, Integração e Proteção de Dados', 'Persistência'],
      ['Fundamentos de Auditoria Governamental e Atuação Integrada da CGU', 'Auditoria'],
      ['Fundamentos de Direito Público Aplicado, Controle e Responsabilização', 'Direito Público'],
      ['Fundamentos de Governança, Riscos e Integridade Pública e Privada', 'Governança, Riscos'],
      ['Fundamentos de Evidências, Dados e Inteligência Artificial', 'Evidências, Dados'],
      ['Fundamentos de Transparência, Ouvidoria e Participação Social', 'Transparência'],
      ['Estado, Democracia, Direitos e Ciência Política', 'Estado, Democracia'],
      ['Sociedade Brasileira, Desigualdades, Diversidade e Desenvolvimento', 'Sociedade Brasileira'],
      ['Ética Pública e Responsabilidade Profissional', 'Ética Pública'],
      ['Administração Pública e Fundamentos de Políticas Públicas', 'Adm. Pública'],
    ];
    for (const [name, short] of cases) {
      expect(shortSubjectName(name), name).toBe(short);
      expect(short.length).toBeLessThanOrEqual(22);
    }
  });

  it('nomes do exemplo inicial e casos simples', () => {
    expect(shortSubjectName('Contabilidade Pública (CASP)')).toBe('Contabilidade Pública');
    expect(shortSubjectName('TI — Desenvolvimento & Arquitetura')).toBe('TI');
    expect(shortSubjectName('Língua Portuguesa')).toBe('Língua Portuguesa');
    expect(shortSubjectName('Direito Administrativo & Licitações (Lei 14.133)')).toBe('Direito Administrativo');
    // Uma palavra só, comprida: fica inteira
    expect(shortSubjectName('Otorrinolaringologia')).toBe('Otorrinolaringologia');
    expect(shortSubjectName('   ')).toBe('');
  });
});
