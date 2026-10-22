import { useCallback, useState } from 'react';

interface SetOpenOptions {
  /** `false`: mudança automática (ex.: a leitura do PDF recolhe o painel) que não vira preferência do estudante. */
  persist?: boolean;
}

/**
 * Painel lateral aberto ou recolhido em trilho. A escolha fica neste computador (localStorage),
 * como a largura: é conforto visual, não dado de estudo.
 */
export function useCollapsiblePanel(storageKey: string, defaultOpen: boolean) {
  const [open, setOpenState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === '1') return true;
      if (saved === '0') return false;
    } catch {
      // Sem localStorage (janela privada): vale o padrão
    }
    return defaultOpen;
  });

  const setOpen = useCallback(
    (value: boolean, options?: SetOpenOptions) => {
      setOpenState(value);
      if (options?.persist === false) return;
      try {
        localStorage.setItem(storageKey, value ? '1' : '0');
      } catch {
        // Sem localStorage: a escolha só não é lembrada
      }
    },
    [storageKey]
  );

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  return { open, setOpen, toggle };
}
