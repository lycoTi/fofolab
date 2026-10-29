import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LawExcerpt } from '../lib/fofoia/context';
import { LawPillsBar } from '../features/laws/LawPillsBar';
import { LawReaderModal } from '../features/laws/LawReaderModal';

const sampleExcerpts: LawExcerpt[] = [
  {
    lawName: 'CF/88',
    article: 'Art. 37',
    text: 'A administração pública direta e indireta de qualquer dos Poderes da União obedecerá aos princípios de legalidade...',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
  },
  {
    lawName: 'Lei 8.112/1990',
    article: 'Art. 5º',
    text: 'São requisitos básicos para investidura em cargo público: I - a nacionalidade brasileira...',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm',
  },
];

vi.mock('../lib/laws/resolver', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../lib/laws/resolver');
  return {
    ...actual,
    resolveLawExcerpts: vi.fn(async ({ text }: { text?: string }) => {
      if (text && (text.includes('8112') || text.includes('lei 8112'))) {
        return [
          {
            lawName: 'Lei 8.112/1990',
            article: 'Art. 1º',
            text: 'Esta Lei institui o Regime Jurídico dos Servidores Públicos Civis da União...',
            sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm#art1',
          },
        ];
      }
      return [];
    }),
  };
});

describe('LawPillsBar & LawReaderModal (Fatia 11.2.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não renderiza nada se a lista de excerpts for vazia e não houver conversa com leis', () => {
    const { container } = render(<LawPillsBar excerpts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza as pílulas de lei com ícone e texto corretos', () => {
    render(<LawPillsBar excerpts={sampleExcerpts} />);

    expect(screen.getByRole('region', { name: 'Legislação citada' })).toBeTruthy();
    expect(screen.getByText('Letra da lei:')).toBeTruthy();
    expect(screen.getByText('CF/88')).toBeTruthy();
    expect(screen.getByText('Art. 37')).toBeTruthy();
    expect(screen.getByText('Lei 8.112/1990')).toBeTruthy();
    expect(screen.getByText('Art. 5º')).toBeTruthy();
  });

  it('resolve pílulas dinamicamente da conversa quando alguém cita lei no chat da FofoIA', async () => {
    render(
      <LawPillsBar
        excerpts={[]}
        conversationText="oi, me fale sobre a lei 8112"
      />
    );

    expect(await screen.findByText('Lei 8.112/1990')).toBeTruthy();
    expect(screen.getByText('Art. 1º')).toBeTruthy();
  });

  it('abre o modal de leitura tátil ao clicar na pílula', () => {
    render(<LawPillsBar excerpts={sampleExcerpts} />);

    const pill = screen.getByTitle('Consultar CF/88 Art. 37');
    fireEvent.click(pill);

    const dialog = screen.getByRole('dialog', { name: 'CF/88 Art. 37' });
    expect(dialog).toBeTruthy();
    expect(screen.getByText(/A administração pública direta e indireta/)).toBeTruthy();

    const planaltoLink = screen.getByRole('link', { name: /Planalto/i });
    expect(planaltoLink.getAttribute('href')).toBe(
      'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm'
    );
  });

  it('fecha o modal ao clicar no botão fechar ou pressionar Escape', () => {
    const handleClose = vi.fn();
    render(<LawReaderModal excerpt={sampleExcerpts[0]} onClose={handleClose} />);

    // Fecha via botão X (ícone no topo com aria-label)
    const closeButtons = screen.getAllByRole('button', { name: /fechar/i });
    expect(closeButtons.length).toBe(2);

    fireEvent.click(closeButtons[0]);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Fecha via botão Fechar no rodapé
    fireEvent.click(closeButtons[1]);
    expect(handleClose).toHaveBeenCalledTimes(2);

    // Fecha via tecla Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(3);
  });

  it('permite copiar o texto do dispositivo legal para a área de transferência', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<LawReaderModal excerpt={sampleExcerpts[0]} onClose={vi.fn()} />);

    const copyBtn = screen.getByRole('button', { name: /Copiar texto/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      `CF/88 - Art. 37\n\n${sampleExcerpts[0].text}`
    );
    expect(await screen.findByText('Copiado!')).toBeTruthy();
  });

  it('permite salvar o dispositivo no caderno do tópico (+ Caderno)', async () => {
    const onSaveToNotebook = vi.fn();
    render(
      <LawReaderModal
        excerpt={sampleExcerpts[0]}
        onClose={vi.fn()}
        onSaveToNotebook={onSaveToNotebook}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /\+ Caderno/i });
    fireEvent.click(saveBtn);

    expect(onSaveToNotebook).toHaveBeenCalledWith(
      `**CF/88 - Art. 37**\n\n> ${sampleExcerpts[0].text}`
    );
    expect(await screen.findByText('Salvo no caderno')).toBeTruthy();
  });

  it('não possui emojis crus nos componentes (Anti-IA design)', () => {
    const { container } = render(
      <>
        <LawPillsBar excerpts={sampleExcerpts} />
        <LawReaderModal excerpt={sampleExcerpts[0]} onClose={vi.fn()} />
      </>
    );

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(container.innerHTML)).toBe(false);
  });
});
