/**
 * Tópico sem questões (spec 12c §5.4 e 12d): a lista fica vazia e o tópico-pai ou a matéria inteira só entram se o
 * estudante pedir — nada de questão de outro tópico entrando sozinha sem aviso.
 */
export function EmptyTopicQuestions(props: {
  groupCode: string | null;
  onShowGroup?: () => void;
  onShowSubject?: () => void;
  canImport?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-xs text-slate-400">
      <p className="text-sm text-slate-300">Ainda não há questões classificadas neste tópico.</p>
      {((props.groupCode && props.onShowGroup) || props.onShowSubject) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {props.groupCode && props.onShowGroup && (
            <button
              type="button"
              onClick={props.onShowGroup}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-orange-500/40 hover:text-orange-200"
            >
              Ver do tópico {props.groupCode}
            </button>
          )}
          {props.onShowSubject && (
            <button
              type="button"
              onClick={props.onShowSubject}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-orange-500/40 hover:text-orange-200"
            >
              Ver toda a matéria
            </button>
          )}
        </div>
      )}
    </div>
  );
}
