export default function Metacritic({ nota }) {
  const valor = Number(nota);
  if (!Number.isInteger(valor) || valor < 1) return null;
  const color = valor >= 75
    ? 'bg-emerald-500/15 text-emerald-300'
    : valor >= 50
      ? 'bg-amber-500/15 text-amber-300'
      : 'bg-rose-500/15 text-rose-300';
  return (
    <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${color}`}>
      Metacritic {valor}
    </span>
  );
}
