import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Um pouco mais que a transição (200 ms): só depois dela o conteúdo antigo sai da tela. */
const CLOSE_MS = 220;

/**
 * Área que abre e fecha com a altura animada (grade de 0fr ↔ 1fr: anima até "auto" sem medir nada com JS).
 * Fechada, sai do teclado e dos leitores de tela. Ao fechar, continua mostrando o último conteúdo enquanto
 * encolhe — quem chama costuma trocar o conteúdo por `null` no mesmo instante, e ele sumiria de supetão —
 * e depois o desmonta (nada escondido fica montado com textos repetidos). O que já nasce fechado não monta.
 */
export function Collapse({ open, children, className = '' }: { open: boolean; children: ReactNode; className?: string }) {
  const lastOpenChildren = useRef<ReactNode>(open ? children : null);
  const [, setCleared] = useState(0);
  if (open) lastOpenChildren.current = children;

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      lastOpenChildren.current = null;
      setCleared((n) => n + 1);
    }, CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${className}`}
      style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">{open ? children : lastOpenChildren.current}</div>
    </div>
  );
}
