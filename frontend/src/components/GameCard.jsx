import { useState } from 'react';

const STATUS_COLORS = {
  PENDIENTE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  JUGANDO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETADO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  ABANDONADO: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export default function GameCard({
  game,
  statuses,
  onStatusSelect,
  onDelete,
  busy = false,
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const statusClass = STATUS_COLORS[game.status] || 'bg-slate-700 text-slate-300';
  const showCover = Boolean(game.coverUrl) && !coverFailed;

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700/60 shadow-lg hover:border-slate-600 transition flex flex-col justify-between">
      <div>
        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
          {showCover ? (
            <img
              src={game.coverUrl}
              alt={game.title}
              className="w-full h-full object-cover"
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">
              Sin portada
            </div>
          )}
          <span
            className={`absolute top-3 right-3 px-2.5 py-1 text-xs font-semibold rounded-full border backdrop-blur-md ${statusClass}`}
          >
            {game.status}
          </span>
        </div>

        <div className="p-4 space-y-3">
          <h3 className="font-bold text-lg text-slate-100 truncate">{game.title}</h3>
          <label className="grid gap-1 text-xs text-slate-400">
            Estado de progreso
            <select
              value={game.status}
              disabled={busy}
              onChange={(event) => onStatusSelect?.(game, event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="p-4 pt-0 flex gap-2 border-t border-slate-700/40 mt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDelete?.(game)}
          className="w-full py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium rounded-lg border border-rose-500/20 transition disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
