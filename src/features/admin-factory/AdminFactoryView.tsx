import { FolderGit2, ShieldAlert, Wrench } from 'lucide-react';
import type { AdminBoardBlueprint, CareerTrack } from '../../types/database';

interface AdminFactoryViewProps {
  adminData: {
    tracks: CareerTrack[];
    blueprints: AdminBoardBlueprint[];
    stats: { plans: number; subjects: number; topics: number; questions: number; attempts: number };
  } | null;
}

function getCatalogStatusClass(status: CareerTrack['catalog_status']): string {
  if (status === 'CATALOGED') return 'text-emerald-400 font-semibold';
  if (status === 'PARTIAL') return 'text-amber-400 font-semibold';
  return 'text-slate-400';
}

function getCatalogStatusLabel(status: CareerTrack['catalog_status']): string {
  if (status === 'CATALOGED') return '🟢 Catalogada';
  if (status === 'PARTIAL') return '🟡 Parcial / Em Dossiê';
  return '⚪ No Radar';
}

export function AdminFactoryView({ adminData }: AdminFactoryViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="text-purple-400" size={20} />
            Painel Administrador ("A Fábrica")
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Catálogo de Trilhas de Concursos e Monitoramento de Bancas Examinadoras
          </p>
        </div>
        {adminData && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
              Editais: <strong>{adminData.stats.plans}</strong> • Disciplinas:{' '}
              <strong>{adminData.stats.subjects}</strong> • Tópicos:{' '}
              <strong>{adminData.stats.topics}</strong> • Questões Resolvidas:{' '}
              <strong>{adminData.stats.attempts}</strong>
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <FolderGit2 size={16} className="text-orange-400" />
            Catálogo de Trilhas Prontas
          </h3>
          <div className="space-y-2 text-xs">
            {adminData?.tracks.map((track) => (
              <div
                key={track.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between"
              >
                <span>{track.name}</span>
                <span className={getCatalogStatusClass(track.catalog_status)}>
                  {getCatalogStatusLabel(track.catalog_status)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShieldAlert size={16} className="text-purple-400" />
            Integridade das Páginas das Bancas
          </h3>
          <div className="space-y-2 text-xs">
            {adminData?.blueprints.map((bp) => (
              <div
                key={bp.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex justify-between"
              >
                <span>{bp.board_name}</span>
                <span className="text-emerald-400 font-semibold">
                  {bp.health_status === 'OK' ? '🟢 Estrutura Íntegra' : '🔴 Mudança Detectada'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

