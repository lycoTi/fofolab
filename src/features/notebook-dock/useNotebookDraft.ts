import { useCallback, useEffect, useRef, useState } from 'react';
import { flushDatabase, getNotebookForTopic, saveTopicNotebook } from '../../lib/database';
import type { Notebook, Subject, Topic } from '../../types/database';

/** Espera após a última tecla antes de gravar o caderno automaticamente. */
export const NOTEBOOK_AUTOSAVE_MS = 800;

export type NotebookDraftStatus = 'idle' | 'pending' | 'saved';

interface DraftOwner {
  subjectId: string;
  topicId: string;
  title: string;
}

function notebookTitle(topic: Topic): string {
  return `Caderno ${topic.code ?? ''} — ${topic.title}`.replace(/\s+/g, ' ').trim();
}

/**
 * Rascunho do caderno do tópico atual com salvamento automático.
 * Antes, trocar de tópico (ou até de filtro de questões) descartava o que não tinha sido salvo;
 * agora o rascunho pendente é gravado no tópico DONO dele antes de carregar o próximo.
 */
export function useNotebookDraft(params: {
  subject: Subject | null;
  topic: Topic | null;
  /** Mude este número quando o banco inteiro for substituído (restaurar backup/exemplo). */
  reloadKey: number;
  onSaved?: (notebook: Notebook) => void;
}) {
  const { subject, topic, reloadKey, onSaved } = params;
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [draft, setDraftState] = useState<string>('');
  const [status, setStatus] = useState<NotebookDraftStatus>('idle');

  const ownerRef = useRef<DraftOwner | null>(null);
  const draftRef = useRef<string>('');
  const dirtyRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadKeyRef = useRef<number>(reloadKey);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const saveNow = useCallback((): Notebook | null => {
    clearTimer();
    const owner = ownerRef.current;
    if (!dirtyRef.current || !owner) return null;
    dirtyRef.current = false;
    const saved = saveTopicNotebook({
      subjectId: owner.subjectId,
      topicId: owner.topicId,
      title: owner.title,
      contentMarkdown: draftRef.current,
    });
    setNotebook(saved);
    setStatus('saved');
    onSavedRef.current?.(saved);
    return saved;
  }, []);

  const subjectId = subject?.id ?? null;
  const topicId = topic?.id ?? null;
  const title = topic ? notebookTitle(topic) : '';

  useEffect(() => {
    if (reloadKeyRef.current !== reloadKey) {
      // O banco foi substituído: o rascunho pendente pertence aos dados antigos e é descartado
      reloadKeyRef.current = reloadKey;
      clearTimer();
      dirtyRef.current = false;
    } else {
      saveNow();
    }

    if (!subjectId || !topicId) {
      ownerRef.current = null;
      setNotebook(null);
      draftRef.current = '';
      setDraftState('');
      setStatus('idle');
      return;
    }

    ownerRef.current = { subjectId, topicId, title: '' };
    const loaded = getNotebookForTopic(topicId);
    setNotebook(loaded);
    draftRef.current = loaded?.content_markdown ?? '';
    setDraftState(draftRef.current);
    dirtyRef.current = false;
    setStatus('idle');
  }, [subjectId, topicId, reloadKey, saveNow]);

  // O título acompanha renomeações do tópico sem recarregar o rascunho
  useEffect(() => {
    if (ownerRef.current) ownerRef.current.title = title;
  }, [title, topicId]);

  // Ao desmontar, grava o que estiver pendente
  useEffect(() => () => {
    saveNow();
  }, [saveNow]);

  // Janela escondida/fechando: grava o rascunho e manda o banco para o disco na hora
  // (os timers de espera não rodam mais depois que a página começa a ser descarregada)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const flushPending = () => {
      if (saveNow()) void flushDatabase();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };
    window.addEventListener('pagehide', flushPending);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveNow]);

  const setDraft = useCallback(
    (value: string) => {
      draftRef.current = value;
      setDraftState(value);
      if (!ownerRef.current) return;
      dirtyRef.current = true;
      setStatus('pending');
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        saveNow();
      }, NOTEBOOK_AUTOSAVE_MS);
    },
    [saveNow]
  );

  /** Acrescenta uma anotação (ex: "Salvar Aula no Caderno") e grava na hora. */
  const appendAndSave = useCallback(
    (markdown: string): Notebook | null => {
      if (!ownerRef.current) return null;
      const header = '### 📌 Anotação de Estudo Reverso';
      const next = draftRef.current.trim()
        ? `${draftRef.current}\n\n---\n${header}\n${markdown}`
        : `${header}\n${markdown}`;
      draftRef.current = next;
      setDraftState(next);
      dirtyRef.current = true;
      return saveNow();
    },
    [saveNow]
  );

  return { notebook, draft, setDraft, saveNow, appendAndSave, status };
}
