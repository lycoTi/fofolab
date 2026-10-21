import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResizeHandle, useResizableWidth } from '../components/ResizeHandle';
import { NOTEBOOK_AUTOSAVE_MS, useNotebookDraft } from '../features/notebook-dock/useNotebookDraft';
import * as database from '../lib/database';
import { SEED_SUBJECTS, SEED_TOPICS } from '../data/initialSeed';
import type { Notebook } from '../types/database';

vi.mock('../lib/database', () => {
  const store = new Map<string, Notebook>();
  return {
    flushDatabase: vi.fn(async () => {}),
    getNotebookForTopic: vi.fn((topicId: string) => store.get(topicId) ?? null),
    saveTopicNotebook: vi.fn(
      (params: { subjectId: string; topicId: string; title: string; contentMarkdown: string }) => {
        const notebook: Notebook = {
          id: `nb-${params.topicId}`,
          subject_id: params.subjectId,
          topic_id: params.topicId,
          title: params.title,
          content_markdown: params.contentMarkdown,
          ai_summary_markdown: null,
          updated_at: new Date().toISOString(),
        };
        store.set(params.topicId, notebook);
        return notebook;
      }
    ),
  };
});

const subject = SEED_SUBJECTS[0];
const [topicA, topicB] = SEED_TOPICS.filter((t) => t.subject_id === subject.id);
const saveMock = vi.mocked(database.saveTopicNotebook);

describe('Caderno com salvamento automático', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('grava sozinho alguns instantes depois de parar de digitar', () => {
    const { result } = renderHook(() => useNotebookDraft({ subject, topic: topicA, reloadKey: 0 }));

    act(() => result.current.setDraft('Resumo de risco de auditoria'));
    expect(saveMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('pending');

    act(() => {
      vi.advanceTimersByTime(NOTEBOOK_AUTOSAVE_MS);
    });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0][0]).toMatchObject({ topicId: topicA.id, contentMarkdown: 'Resumo de risco de auditoria' });
    expect(result.current.status).toBe('saved');
  });

  it('trocar de tópico grava o rascunho pendente no tópico CERTO antes de carregar o próximo', () => {
    const { result, rerender } = renderHook(({ topic }) => useNotebookDraft({ subject, topic, reloadKey: 0 }), {
      initialProps: { topic: topicA },
    });

    act(() => result.current.setDraft('Anotação do tópico A'));
    rerender({ topic: topicB });

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0][0]).toMatchObject({ topicId: topicA.id, contentMarkdown: 'Anotação do tópico A' });
    expect(result.current.draft).not.toBe('Anotação do tópico A');

    act(() => {
      vi.advanceTimersByTime(NOTEBOOK_AUTOSAVE_MS * 2);
    });
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('ao restaurar um backup (banco trocado) descarta o rascunho pendente dos dados antigos', () => {
    const { result, rerender } = renderHook(({ reloadKey }) => useNotebookDraft({ subject, topic: topicA, reloadKey }), {
      initialProps: { reloadKey: 0 },
    });

    act(() => result.current.setDraft('rascunho antigo'));
    rerender({ reloadKey: 1 });
    act(() => {
      vi.advanceTimersByTime(NOTEBOOK_AUTOSAVE_MS * 2);
    });
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('"Salvar Aula no Caderno" acrescenta a anotação e grava na hora', () => {
    const { result } = renderHook(() => useNotebookDraft({ subject, topic: topicB, reloadKey: 0 }));

    act(() => {
      result.current.appendAndSave('Explicação da questão');
    });
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0][0].contentMarkdown).toContain('Explicação da questão');
  });
});

describe('Colunas redimensionáveis', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('a divisória ajusta a largura pelo teclado, no sentido certo para cada lado da tela', () => {
    const onResize = vi.fn();
    const { rerender } = render(
      <ResizeHandle label="Largura A" direction="grow-right" width={320} min={240} max={520} onResize={onResize} />
    );
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Largura A' }), { key: 'ArrowRight' });
    expect(onResize).toHaveBeenLastCalledWith(336);

    rerender(<ResizeHandle label="Largura A" direction="grow-left" width={320} min={240} max={520} onResize={onResize} />);
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Largura A' }), { key: 'ArrowRight' });
    expect(onResize).toHaveBeenLastCalledWith(304);
  });

  it('respeita os limites e lembra a largura escolhida neste computador', () => {
    const { result, unmount } = renderHook(() => useResizableWidth('teste_largura', 384, 300, 900));
    act(() => result.current.setWidth(5000));
    expect(result.current.width).toBe(900);
    unmount();

    const again = renderHook(() => useResizableWidth('teste_largura', 384, 300, 900));
    expect(again.result.current.width).toBe(900);
    act(() => again.result.current.reset());
    expect(again.result.current.width).toBe(384);
  });
});
