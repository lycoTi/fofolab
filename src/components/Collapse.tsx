import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Um pouco mais que a transição de fechar (60 ms de espera + 320 ms, em index.css): só depois dela o conteúdo antigo sai. */
const CLOSE_MS = 400;

/**
 * Área que abre e fecha com a altura animada (grade de 0fr ↔ 1fr: anima até "auto" sem medir nada com JS).
 * Fechada, sai do teclado e dos leitores de tela. Ao fechar, continua mostrando o último conteúdo enquanto
 * encolhe — quem chama costuma trocar o conteúdo por `null` no mesmo instante, e ele sumiria de supetão —
 * e depois o desmonta (nada escondido fica montado com textos repetidos). O que já nasce fechado não monta.
 * O movimento (curvas, atrasos, "menos movimento") fica em `.fofolab-collapse` no index.css.
 * `afterExit`: ao abrir, espera quem está fechando ao lado sair (troca da prévia pelo relógio sem sobreposição).
 */
export function Collapse({
  open,
  children,
  className = '',
  afterExit = false,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
  afterExit?: boolean;
}) {
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
      className={`fofolab-collapse ${afterExit ? 'fofolab-collapse--after-exit' : ''} ${className}`}
      data-open={open}
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      <div className="fofolab-collapse-inner">{open ? children : lastOpenChildren.current}</div>
    </div>
  );
}
