const STATUS_COLORS = {
  PENDIENTE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  JUGANDO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETADO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  ABANDONADO: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export default function GameCard({ game, onStatusChange, onDelete }) {
  const statusClass = STATUS_COLORS[game.status] || 'bg-slate-700 text-slate-300';

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700/60 shadow-lg hover:border-slate-600 transition flex flex-col justify-between">
      <div>
        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
          <img
            src={game.coverUrl || 'https://via.placeholder.com/400x225?text=Sin+Portada'}
            alt={game.title}
            className="w-full h-full object-cover"
          />
          <span className={`absolute top-3 right-3 px-2.5 py-1 text-xs font-semibold rounded-full border backdrop-blur-md ${statusClass}`}>
            {game.status}
          </span>
        </div>

        <div className="p-4">
          <h3 className="font-bold text-lg text-slate-100 truncate">{game.title}</h3>
          <p className="text-xs text-slate-400 mt-1">{game.genre || 'Sin género'}</p>
        </div>
      </div>

      <div className="p-4 pt-0 flex gap-2 border-t border-slate-700/40 mt-3">
        <button
          onClick={() => onStatusChange?.(game)}
          className="flex-1 py-1.5 px-3 bg-slate-700/50 hover:bg-slate-700 text-xs font-medium rounded-lg text-slate-200 transition"
        >
          Cambiar Estado
        </button>
        <button
          onClick={() => onDelete?.(game)}
          className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium rounded-lg border border-rose-500/20 transition"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}