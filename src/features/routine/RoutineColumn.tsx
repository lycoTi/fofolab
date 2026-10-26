import type { ReactNode } from 'react';
import { Coffee, Compass, Layers, Settings2 } from 'lucide-react';
import { Collapse } from '../../components/Collapse';
import { formatDuration } from '../../lib/timeFormat';
import type { RoutineItem, TopicGroup } from '../../lib/dailyRoutine';
import type { Topic } from '../../types/database';
import { PeekBanner, type PeekInfo } from './PeekBanner';
import { QuestionLogPanel, type QuestionLogPanelProps } from './QuestionLogPanel';
import { RoutineBlockItem, type RoutineMaterials } from './RoutineBlockItem';
import { TodayTimeControl, type TodayTime } from './TodayTimeControl';

export interface RoutineColumnProps {
  items: RoutineItem[];
  dayTotalMinutes: number;
  weekStudiedMinutes: number;
  weekTargetMinutes: number;
  /** Roteiro cumprido: bloco extra escolhido pelo motor (o estudante não monta o roteiro). */
  extraBlock: RoutineItem | null;
  blockRunning: boolean;
  /** Grupo do tópico do bloco (árvore). */
  group: TopicGroup;
  selectedTopicId: string | null;
  liveFocusMs: number;
  materials: RoutineMaterials;
  peek: PeekInfo | null;
  /** Registro rápido de questões feitas fora do app (topo da coluna). */
  questionLog: QuestionLogPanelProps;
  /** Aviso discreto quando o desempenho contraria a autoavaliação. */
  hint: string | null;
  onStartBlock: (item: RoutineItem) => void;
  onSelectTopic: (subjectId: string, topicId: string) => void;
  onReturnToBlock: () => void;
  onOpenMaterial: (kind: 'pdf' | 'questions' | 'notes') => void;
  onOpenCycle: () => void;
  onOpenEdital: () => void;
  onRecalibrate: () => void;
  adminToggle: ReactNode;
  /** FofoDoro do bloco em andamento, mostrado dentro do bloco atual quando é ele que está rodando. */
  fofodoro?: ReactNode | null;
  /** Prévia do plano do bloco (pomodoros e pausas), antes do play. */
  preview?: ReactNode | null;
  /** Bloco começado fora do roteiro: cartão próprio no topo. */
  freeBlock?: ReactNode | null;
  /** Título do cartão do bloco fora do item atual (padrão: bloco livre, fora do roteiro). */
  freeBlockTitle?: string;
  /** Estudo registrado hoje (todas as matérias), para o resumo do fim do dia. */
  todayStudiedMinutes?: number;
  /** Tempo de hoje (spec 13): "Mudar o tempo de hoje" e a folga. */
  todayTime?: TodayTime;
}

const footerLink = 'flex items-center gap-1.5 text-xs font-medium text-orange-400 hover:text-orange-300';

/** Coluna esquerda da bancada (spec 09): o roteiro de hoje, com o bloco atual aberto e os outros recolhidos. */
export function RoutineColumn(props: RoutineColumnProps) {
  const { items, extraBlock, blockRunning, peek, hint } = props;
  const currentIndex = items.findIndex((i) => i.status === 'current');
  const allDone = items.length > 0 && currentIndex === -1;
  const afterBreak = currentIndex > 0 && items[currentIndex - 1].status === 'done';
  const restDay = props.todayTime?.minutes === 0;

  const currentExtras = (startLabel: string, item: RoutineItem) => ({
    group: props.group,
    selectedTopicId: props.selectedTopicId,
    liveFocusMs: props.liveFocusMs,
    materials: props.materials,
    blockRunning,
    startLabel,
    onStart: () => props.onStartBlock(item),
    onSelectTopic: props.onSelectTopic,
    onOpenMaterial: props.onOpenMaterial,
    fofodoro: props.fofodoro ?? null,
    preview: props.preview ?? null,
  });

  return (
    <div aria-label="Roteiro de hoje" className="flex h-full w-full min-w-0 flex-col">
      <div className="shrink-0 border-b border-slate-800 py-3 pl-4 pr-10">
        <h2 className="text-sm font-semibold text-white">{`Hoje · ${formatDuration(props.dayTotalMinutes)}`}</h2>
        {props.todayTime && <TodayTimeControl {...props.todayTime} />}
      </div>

      <Collapse open={peek !== null} className="shrink-0">
        {peek && <PeekBanner peek={peek} onReturnToBlock={props.onReturnToBlock} />}
      </Collapse>
      <QuestionLogPanel {...props.questionLog} />
      <Collapse open={Boolean(props.freeBlock)} className="shrink-0">
        {props.freeBlock && (
          <section aria-label={props.freeBlockTitle ?? 'Bloco livre'} className="mx-3 mt-3 space-y-2 rounded-xl border border-orange-500/40 bg-orange-500/5 p-3">
            <h3 className="text-xs font-semibold text-orange-300">{props.freeBlockTitle ?? 'Bloco livre · fora do roteiro de hoje'}</h3>
            {props.freeBlock}
          </section>
        )}
      </Collapse>

      <ol className="flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 && restDay && (
          <li className="text-xs text-slate-300">Hoje é dia de folga. Descansar também faz parte: a memória se firma no intervalo.</li>
        )}
        {items.length === 0 && !restDay && (
          <li className="text-xs text-slate-400">Calibre seu perfil para o roteiro de hoje aparecer aqui.</li>
        )}
        {items.map((item, index) => (
          <RoutineItemRow key={item.block.blockNumber} showBreak={afterBreak && index === currentIndex}>
            <RoutineBlockItem item={item} current={index === currentIndex ? currentExtras('Iniciar bloco', item) : undefined} />
          </RoutineItemRow>
        ))}
        {allDone && (
          <li className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-emerald-300">Roteiro de hoje cumprido</p>
            <p className="text-xs text-slate-200">{`Parabéns: ${formatDuration(props.todayStudiedMinutes ?? 0)} de estudo hoje! Amanhã tem mais.`}</p>
            {extraBlock && (
              <p className="text-xs text-slate-400">{`Próximo passo indicado: ${extraBlock.subject.name}${extraBlock.topic ? ` · ${[extraBlock.topic.code, extraBlock.topic.title].filter(Boolean).join(' ')}` : ''}`}</p>
            )}
            {extraBlock && (
              <ol>
                <RoutineBlockItem item={extraBlock} current={currentExtras('Iniciar bloco extra', extraBlock)} />
              </ol>
            )}
          </li>
        )}
      </ol>

      <div className="shrink-0 space-y-2 border-t border-slate-800 px-4 py-3">
        {hint && (
          <div className="space-y-1.5 text-xs text-slate-300">
            <p>{hint}</p>
            <button type="button" onClick={props.onRecalibrate} className={footerLink}>
              <Compass size={13} />
              Recalibrar perfil
            </button>
          </div>
        )}
        <p className="text-xs text-slate-400">{`Semana: ${formatDuration(props.weekStudiedMinutes)} de ${formatDuration(props.weekTargetMinutes)}`}</p>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={props.onOpenCycle} className={footerLink}>
            <Layers size={13} />
            Ver ciclo
          </button>
          <button type="button" onClick={props.onOpenEdital} className={footerLink}>
            <Settings2 size={13} />
            Edital
          </button>
          {props.adminToggle}
        </div>
      </div>
    </div>
  );
}

function RoutineItemRow({ showBreak, children }: { showBreak: boolean; children: ReactNode }) {
  if (!showBreak) return <>{children}</>;
  return (
    <>
      <li className="flex items-center gap-1.5 px-1 text-[11px] text-slate-400">
        <Coffee size={12} />
        Intervalo sugerido de 10 minutos antes deste bloco
      </li>
      {children}
    </>
  );
}
