import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AcervoImportResult } from '../lib/acervo/importAcervo';

type ImportInput = { planId: string; ai: unknown; onProgress?: (done: number, total: number) => void };
const importMock = vi.fn<(text: string, input: ImportInput) => Promise<AcervoImportResult>>();
vi.mock('../lib/acervo/importAcervo', () => ({ importAcervoPacote: (text: string, input: ImportInput) => importMock(text, input) }));

const { AcervoImportPanel } = await import('../features/acervo/AcervoImportPanel');

const FORBIDDEN = ['SQLite', 'JSON', 'banco', 'Cache', 'IndexedDB', 'null', 'undefined', 'NaN'];
const EMOJI = /\p{Extended_Pictographic}/u;

function setup() {
  const onImported = vi.fn();
  const ai = vi.fn();
  const view = render(<AcervoImportPanel planId="p1" ai={ai} onImported={onImported} />);
  const file = new File(['{"formato":"fofolab-acervo"}'], 'fofolab-acervo-cebraspe.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('Escolher o arquivo do pacote'), { target: { files: [file] } });
  return { ...view, onImported, ai };
}

describe('Importar o acervo da Cebraspe (spec 12c §5.2)', () => {
  // Com chaves: função devolvida pelo beforeEach vira limpeza, e o Vitest chamaria o mock sem argumentos
  beforeEach(() => {
    importMock.mockReset();
  });

  it('escolher o arquivo e importar mostra o resumo com os números', async () => {
    importMock.mockResolvedValue({
      ok: true,
      summary: { withSubject: 619, hidden: 32, invalidItems: 1, topicsLinked: 273, topicsWithoutLink: 2, copiesUpdated: 1, aiSkipped: true },
    });
    const { onImported, ai, container } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Importar acervo' }));

    await screen.findByText('619 questões com assunto · 273 tópicos do seu plano ligados · 2 sem ligação');
    expect(screen.getByText('32 ficaram de fora (figura ou fórmula que não dá para ler).')).toBeTruthy();
    expect(screen.getByText('1 item com problema foi ignorado.')).toBeTruthy();
    expect(screen.getByText('1 questão que você já usou foi atualizada.')).toBeTruthy();
    expect(screen.getByText('Sem IA configurada, os tópicos sem ligação ficam para a próxima importação.')).toBeTruthy();
    expect(importMock).toHaveBeenCalledWith('{"formato":"fofolab-acervo"}', expect.objectContaining({ planId: 'p1', ai }));
    expect(onImported).toHaveBeenCalledTimes(1);
    for (const term of FORBIDDEN) expect(container.textContent).not.toContain(term);
    expect(EMOJI.test(container.textContent ?? '')).toBe(false);
  });

  it('erro mostra a mensagem e não avisa que importou', async () => {
    importMock.mockResolvedValue({ ok: false, message: 'Este arquivo não é um pacote do acervo.' });
    const { onImported } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Importar acervo' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Este arquivo não é um pacote do acervo.');
    expect(onImported).not.toHaveBeenCalled();
  });

  it('mostra o progresso enquanto a IA liga os tópicos', async () => {
    let finish: (r: AcervoImportResult) => void = () => {};
    importMock.mockImplementation((_text, input) => {
      input.onProgress?.(1, 4);
      return new Promise((resolve) => (finish = resolve));
    });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Importar acervo' }));
    await screen.findByText('Ligando tópicos: 1 de 4');
    expect(screen.getByText('Pode fechar: o que faltar fica para a próxima importação.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Importar acervo' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () =>
      finish({ ok: true, summary: { withSubject: 3, hidden: 0, invalidItems: 0, topicsLinked: 4, topicsWithoutLink: 0, copiesUpdated: 0, aiSkipped: false } })
    );
    await waitFor(() => expect(screen.queryByText('Ligando tópicos: 1 de 4')).toBeNull());
  });

  it('resumo no singular quando é um só', async () => {
    const { summaryLines } = await import('../features/acervo/AcervoImportPanel');
    expect(
      summaryLines({ withSubject: 1, hidden: 1, invalidItems: 0, topicsLinked: 1, topicsWithoutLink: 0, copiesUpdated: 0, aiSkipped: false })
    ).toEqual(['1 questão com assunto · 1 tópico do seu plano ligado · 0 sem ligação', '1 ficou de fora (figura ou fórmula que não dá para ler).']);
  });

  it('sem arquivo escolhido, o botão fica desligado', () => {
    render(<AcervoImportPanel planId="p1" ai={null} onImported={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Importar acervo' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
