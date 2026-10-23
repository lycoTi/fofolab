import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { formatDuration } from '../../lib/timeFormat';
import { planPreview, shortBreakMinutes, type BlockState } from '../study-block/studyBlockMachine';
import { BlockModePicker } from '../study-block/StudyBlockParts';
import type { StudyBlockController } from '../study-block/useStudyBlock';
import { FofoDoroSettings } from './FofoDoroSettings';

function plural(count: number, singular: string, pluralWord: string): string {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

/** "4 pomodoros de 25 min + 3 pausas de 5 min → 01:55" — o plano do bloco antes do play. */
export function describePlan(state: BlockState, targetMinutes: number | null): string {
  if (state.mode === 'LIVRE') return targetMinutes ? `Relógio livre até ${formatDuration(targetMinutes)}` : 'Relógio livre';
  const plan = planPreview(targetMinutes, state.focusMinutes, state.settings, state.cyclePomodoros);
  const parts = [`${plural(plan.pomodoros, 'pomodoro', 'pomodoros')} de ${state.focusMinutes} min`];
  if (plan.shortBreaks > 0) {
    parts.push(`${plural(plan.shortBreaks, 'pausa', 'pausas')} de ${shortBreakMinutes(state.focusMinutes, state.settings)} min`);
  }
  if (plan.longBreaks > 0) {
    parts.push(`${plural(plan.longBreaks, 'pausa longa', 'pausas longas')} de ${state.settings.longBreakMinutes} min`);
  }
  return `${parts.join(' + ')} → ${formatDuration(plan.totalMinutes)}`;
}

/** Antes do play: o plano do bloco, o tamanho do pomodoro e os ajustes do FofoDoro. */
export function FofoDoroPreview({ controller, targetMinutes }: { controller: StudyBlockController; targetMinutes: number | null }) {
  const [showSettings, setShowSettings] = useState(false);
  const { state } = controller;
  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-xs">
      <p className="text-slate-200">{describePlan(state, targetMinutes)}</p>
      <div className="flex items-center justify-between gap-2">
        <BlockModePicker state={state} onChange={controller.setMode} compact />
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
          aria-label="Ajustes do FofoDoro"
          title="Ajustes do FofoDoro"
          className={`rounded-md p-1.5 transition-colors duration-150 ${showSettings ? 'bg-slate-800 text-orange-300' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Settings2 size={14} />
        </button>
      </div>
      {showSettings && <FofoDoroSettings state={state} onChange={controller.setSettings} />}
    </div>
  );
}
