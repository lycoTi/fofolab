import { useEffect } from 'react';
import type { ReviewConfidence } from '../../types/database';

export interface UseQuestionKeyboardShortcutsOptions {
  enabled?: boolean;
  confidence: ReviewConfidence | null;
  answered: boolean;
  options: { key: string }[];
  onConfidence: (confidence: ReviewConfidence) => void;
  onPick: (key: string) => void;
  onToggleEliminate?: (key: string) => void;
  onFirstContact?: () => void;
  onHint?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

/**
 * Atalhos de Teclado da Bancada de Questões (spec 11 / ergonomia de alta velocidade):
 * - 1, 2, 3, 4: Calibra a confiança (1: Sei, 2: Estudando, 3: Acho que sei, 4: Chuto).
 * - C / E ou A, B, C, D, E: Seleciona e responde a alternativa correspondente (após calibrar).
 * - Alt + Letra (ex.: Alt+A): Descarta / risca distrator na múltipla escolha.
 * - Enter / Espaço / Seta Direita: Avança para a próxima questão (quando respondida).
 * - Seta Esquerda: Volta para a questão anterior.
 * - P: Pede pista à FofoIA.
 * - V: Ver explicação antes de responder (1º contato consciente).
 */
export function useQuestionKeyboardShortcuts(options: UseQuestionKeyboardShortcutsOptions): void {
  const {
    enabled = true,
    confidence,
    answered,
    options: questionOptions,
    onConfidence,
    onPick,
    onToggleEliminate,
    onFirstContact,
    onHint,
    onNext,
    onPrev,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorar com modificadores normais (Ctrl+C, Cmd+R, etc.)
      if (event.ctrlKey || event.metaKey) return;

      // Ignorar se o foco estiver em campo digitável (busca, FofoIA, caderno)
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Atalho de descarte de alternativa com Alt + Letra (ex.: Alt+A)
      if (event.altKey) {
        if (onToggleEliminate && !answered) {
          const upper = event.key.toUpperCase();
          const matched = questionOptions.find((opt) => opt.key.toUpperCase() === upper);
          if (matched) {
            event.preventDefault();
            onToggleEliminate(matched.key);
          }
        }
        return;
      }

      const key = event.key;

      // 1. Navegação para próxima: Seta Direita sempre; Enter ou Espaço após responder
      if (key === 'ArrowRight' || (answered && (key === 'Enter' || key === ' '))) {
        if (onNext) {
          event.preventDefault();
          onNext();
          return;
        }
      }

      // Navegação para anterior: Seta Esquerda
      if (key === 'ArrowLeft') {
        if (onPrev) {
          event.preventDefault();
          onPrev();
          return;
        }
      }

      // Se a questão já foi respondida, não processa respostas adicionais
      if (answered) return;

      // 2. Ações antes de responder: Pista (P) e 1º Contato (V)
      if (key === 'p' || key === 'P') {
        if (onHint) {
          event.preventDefault();
          onHint();
          return;
        }
      }

      if (key === 'v' || key === 'V') {
        if (onFirstContact) {
          event.preventDefault();
          onFirstContact();
          return;
        }
      }

      // 3. Calibração de Confiança (teclas 1 a 4)
      if (key === '1') {
        event.preventDefault();
        onConfidence('SURE');
        return;
      }
      if (key === '2') {
        event.preventDefault();
        onConfidence('RECENT');
        return;
      }
      if (key === '3') {
        event.preventDefault();
        onConfidence('THINK');
        return;
      }
      if (key === '4') {
        event.preventDefault();
        onConfidence('GUESS');
        return;
      }

      // 4. Seleção de Alternativa (ativa após a calibração de confiança)
      if (confidence) {
        const upper = key.toUpperCase();
        const matched = questionOptions.find((opt) => opt.key.toUpperCase() === upper);
        if (matched) {
          event.preventDefault();
          onPick(matched.key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, confidence, answered, questionOptions, onConfidence, onPick, onToggleEliminate, onFirstContact, onHint, onNext, onPrev]);
}

