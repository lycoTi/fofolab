/**
 * Tópico sem questões (spec 12c §5.4, decisão do dono): a lista fica vazia e o grupo só aparece se o estudante pedir —
 * nada de questão de outro tópico entrando sozinha.
 */
export function EmptyTopicQuestions(props: { groupCode: string | null; onShowGroup?: () => void; canImport: boolean }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-xs text-slate-400">
      <p className="text-sm text-slate-300">Ainda não há questões classificadas neste tópico.</p>
      {props.groupCode && props.onShowGroup && (
        <button
          type="button"
          onClick={props.onShowGroup}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-orange-500/40 hover:text-orange-200"
        >
          Ver as do grupo {props.groupCode}
        </button>
      )}
      {props.canImport && <p>Ou traga as questões das suas provas em "Importar Questões".</p>}
    </div>
  );
}
