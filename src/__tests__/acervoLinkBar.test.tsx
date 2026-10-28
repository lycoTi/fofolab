import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AcervoLinkBar } from '../features/questions/AcervoLinkBar';

describe('AcervoLinkBar (componente isolado de manutenção)', () => {
  it('linha "Do acervo" com "Desligar este assunto"; tirados podem ser devolvidos', () => {
    const onDisableLink = vi.fn();
    const onRestoreItem = vi.fn();
    const view = {
      topicId: 't1',
      links: [{ assuntoId: 'direito-administrativo>licitacoes>lei-14-133', caminho: ['Direito Administrativo', 'Licitações', 'Lei 14.133'] }],
      excluded: [{ itemId: 'TCU_25:c1:9', sourceLabel: 'Cebraspe · TCU 2025 · item 9' }],
      acervoMissing: false,
      groupCode: null,
    };

    render(<AcervoLinkBar view={view} onDisableLink={onDisableLink} onRestoreItem={onRestoreItem} />);
    expect(screen.getByText('Do acervo: Licitações › Lei 14.133')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Desligar este assunto' }));
    expect(onDisableLink).toHaveBeenCalledWith('direito-administrativo>licitacoes>lei-14-133');

    expect(screen.queryByRole('button', { name: 'Devolver ao tópico' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tirados deste tópico (1)' }));
    expect(screen.getByText('Cebraspe · TCU 2025 · item 9')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Devolver ao tópico' }));
    expect(onRestoreItem).toHaveBeenCalledWith('TCU_25:c1:9');
  });

  it('acervo que não está neste computador: avisa como trazer de volta', () => {
    const view = {
      topicId: 't1',
      links: [],
      excluded: [],
      acervoMissing: true,
      groupCode: null,
    };
    render(<AcervoLinkBar view={view} onDisableLink={vi.fn()} onRestoreItem={vi.fn()} />);
    expect(screen.getByText('O acervo da Cebraspe não está neste computador. Importe o pacote de novo em "Importar Questões".')).toBeTruthy();
  });
});
