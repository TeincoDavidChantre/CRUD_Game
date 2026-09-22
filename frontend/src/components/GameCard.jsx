import { useState } from 'react';
import Cover from './Cover';
import Metacritic from './Metacritic';

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
  onUpdate,
  onDelete,
  busy = false,
  highlighted = false,
}) {
  const [editing, setEditing] = useState(false);
  const [askRating, setAskRating] = useState(false);
  const [draft, setDraft] = useState({
    etiquetas: game.etiquetas || '',
    comentario: game.comentario || '',
    calificacion: game.calificacion || '',
  });
  const statusClass = STATUS_COLORS[game.status] || 'bg-slate-700 text-slate-300';

  function changeStatus(event) {
    const next = event.target.value;
    if (next === 'COMPLETADO' && !game.calificacion) {
      setAskRating(true);
      return;
    }
    setAskRating(false);
    onStatusSelect?.(game, next, game.calificacion);
  }

  function saveRating(event) {
    event.preventDefault();
    onStatusSelect?.(game, 'COMPLETADO', Number(draft.calificacion));
    setAskRating(false);
  }

  function saveDetails(event) {
    event.preventDefault();
    onUpdate?.(game, {
      etiquetas: draft.etiquetas,
      comentario: draft.comentario,
      calificacion: game.status === 'COMPLETADO' ? Number(draft.calificacion) : undefined,
    });
    setEditing(false);
  }

  return (
    <div id={`juego-${game.id}`} className={`bg-slate-800 rounded-xl overflow-hidden border shadow-lg transition flex flex-col justify-between ${highlighted ? 'border-indigo-400 ring-2 ring-indigo-400' : 'border-slate-700/60 hover:border-slate-600'}`}>
      <div>
        <div className="relative">
          <Cover src={game.coverUrl} alt={game.title} frameClassName="h-56 w-full" />
          <span className={`absolute top-3 right-3 px-2.5 py-1 text-xs font-semibold rounded-full border backdrop-blur-md ${statusClass}`}>
            {game.status}
          </span>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-bold text-lg text-slate-100 truncate">{game.title}</h3>
            <p className="text-xs text-indigo-300 mt-1">{String(game.plataformas || '').split(',').map((item) => item.trim()).filter(Boolean).join(' · ') || 'Plataforma no indicada'}</p>
            {game.sistemas ? <p className="text-xs text-slate-300 mt-1">{String(game.sistemas).split(',').map((item) => item.trim()).filter(Boolean).join(' · ')}</p> : null}
            {game.desarrollador ? <p className="text-xs text-slate-500 mt-1">{game.desarrollador}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Metacritic nota={game.metacritic} />
              {game.calificacion ? <span className="text-xs text-amber-300">Tu nota {game.calificacion}/5</span> : null}
            </div>
          </div>
          {game.etiquetas ? <p className="text-xs text-indigo-300">{game.etiquetas}</p> : null}
          {game.comentario ? <p className="text-xs text-slate-400 line-clamp-3">{game.comentario}</p> : null}

          <label className="grid gap-1 text-xs text-slate-400">
            Estado de progreso
            <select value={game.status} disabled={busy} onChange={changeStatus} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-50">
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          {askRating && (
            <form onSubmit={saveRating} className="grid gap-2">
              <label className="grid gap-1 text-xs text-slate-400">
                Calificación al completar
                <input type="number" min="1" max="5" required value={draft.calificacion} onChange={(event) => setDraft((current) => ({ ...current, calificacion: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
              </label>
              <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">Guardar nota</button>
            </form>
          )}

          {editing && (
            <form onSubmit={saveDetails} className="grid gap-2">
              <input value={draft.etiquetas} onChange={(event) => setDraft((current) => ({ ...current, etiquetas: event.target.value }))} placeholder="Etiquetas, separadas por coma" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100" />
              <textarea value={draft.comentario} onChange={(event) => setDraft((current) => ({ ...current, comentario: event.target.value }))} rows={3} placeholder="Comentario" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100" />
              {game.status === 'COMPLETADO' && (
                <input type="number" min="1" max="5" required value={draft.calificacion} onChange={(event) => setDraft((current) => ({ ...current, calificacion: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100" />
              )}
              <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">Guardar ficha</button>
            </form>
          )}
        </div>
      </div>

      <div className="p-4 pt-0 flex gap-2 border-t border-slate-700/40 mt-3">
        <button type="button" disabled={busy} onClick={() => setEditing((open) => !open)} className="flex-1 py-1.5 px-3 bg-slate-700/50 hover:bg-slate-700 text-xs font-medium rounded-lg text-slate-200 disabled:opacity-50">
          {editing ? 'Cerrar' : 'Editar'}
        </button>
        <button type="button" disabled={busy} onClick={() => onDelete?.(game)} className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium rounded-lg border border-rose-500/20 disabled:opacity-50">
          Eliminar
        </button>
      </div>
    </div>
  );
}
