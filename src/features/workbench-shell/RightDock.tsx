import { useCallback, useState, type ReactNode } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { RailButton } from './SidePanel';

export type RightDockTab = 'copilot' | 'notebook';

const TAB_STORAGE_KEY = 'fofolab_layout_right_tab_v1';

/** Aba escolhida na coluna da direita, lembrada neste computador. */
export function useRightDockTab() {
  const [tab, setTabState] = useState<RightDockTab>(() => {
    try {
      return localStorage.getItem(TAB_STORAGE_KEY) === 'notebook' ? 'notebook' : 'copilot';
    } catch {
      return 'copilot';
    }
  });

  const setTab = useCallback((value: RightDockTab, options?: { persist?: boolean }) => {
    setTabState(value);
    if (options?.persist === false) return;
    try {
      localStorage.setItem(TAB_STORAGE_KEY, value);
    } catch {
      // Sem localStorage: a aba só não é lembrada
    }
  }, []);

  return { tab, setTab };
}

const TABS: { id: RightDockTab; label: string }[] = [
  { id: 'copilot', label: 'FofoIA' },
  { id: 'notebook', label: 'Caderno' },
];

interface RightDockProps {
  tab: RightDockTab;
  onTabChange: (tab: RightDockTab) => void;
  copilot: ReactNode;
  notebook: ReactNode;
}

/**
 * Copiloto e Caderno dividem a coluna da direita. As duas abas ficam sempre montadas (só a inativa é
 * escondida), para a conversa e o rascunho não se perderem ao alternar.
 */
export function RightDock({ tab, onTabChange, copilot, notebook }: RightDockProps) {
  const panels: Record<RightDockTab, ReactNode> = { copilot, notebook };

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="FofoIA e Caderno" className="flex shrink-0 gap-1 border-b border-slate-800 px-10 pt-2">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`right-dock-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`right-dock-panel-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? 'border-orange-500 text-orange-300' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {TABS.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`right-dock-panel-${item.id}`}
          aria-labelledby={`right-dock-tab-${item.id}`}
          hidden={item.id !== tab}
          className="min-h-0 flex-1"
        >
          {panels[item.id]}
        </div>
      ))}
    </div>
  );
}

/** Ícones do trilho da coluna recolhida: cada um reabre a coluna já na sua aba. */
export function rightDockRail({ tab, onOpenTab }: { tab: RightDockTab; onOpenTab: (tab: RightDockTab) => void }): ReactNode {
  return (
    <>
      <RailButton label="Abrir FofoIA" icon={<Sparkles size={15} />} active={tab === 'copilot'} onClick={() => onOpenTab('copilot')} />
      <RailButton label="Abrir Caderno" icon={<BookOpen size={15} />} active={tab === 'notebook'} onClick={() => onOpenTab('notebook')} />
    </>
  );
}
