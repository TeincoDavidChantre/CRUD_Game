function colorPorNota(valor) {
  if (valor >= 75) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (valor >= 50) return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
  return 'bg-rose-500/15 text-rose-300 border-rose-500/25';
}

/** Chip de puntuación externa (Metacritic, OpenCritic, etc.). */
export function ScoreBadge({ fuente, nota }) {
  const valor = Number(nota);
  if (!Number.isInteger(valor) || valor < 1) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${colorPorNota(valor)}`}
    >
      <span className="opacity-80">{fuente}</span>
      <span className="tabular-nums">{valor}</span>
    </span>
  );
}

export default function Metacritic({ nota }) {
  return <ScoreBadge fuente="Metacritic" nota={nota} />;
}
