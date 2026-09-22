import { unirLinea } from '../lib/fichas';

const CINTA = {
  PENDIENTE: 'bg-sky-500/90 text-white border border-sky-400/30',
  JUGANDO: 'bg-emerald-500/90 text-white border border-emerald-400/30',
  COMPLETADO: 'bg-amber-400 text-zinc-950 font-black border border-amber-300/40',
  ABANDONADO: 'bg-rose-500/90 text-white border border-rose-400/30',
};

const PUNTO = {
  PENDIENTE: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]',
  JUGANDO: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]',
  COMPLETADO: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]',
  ABANDONADO: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]',
};

export default function BannerTile({
  titulo,
  portada,
  donde,
  estado,
  nota,
  sugerido = false,
  onClick,
  ancho = 'w-64 shrink-0 snap-start sm:w-72',
  minimo = false,
}) {
  const labelAria = [
    titulo,
    estado ? `Estado: ${estado.toLowerCase()}` : null,
    nota ? `Calificación: ${nota} de 5` : null,
    donde ? `Disponible en ${unirLinea(donde)}` : null,
  ].filter(Boolean).join('. ');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={labelAria}
      className={`group ${ancho} text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-2xl`}
    >
      <span className="relative block overflow-hidden rounded-2xl bg-zinc-950 shadow-md ring-1 ring-white/10 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:ring-amber-400/60 group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.85),0_0_18px_rgba(251,191,36,0.2)]">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-950">
          {portada ? (
            <img
              src={portada}
              alt={titulo}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-600">
              <span className="text-xs font-bold uppercase">{titulo}</span>
            </div>
          )}
        </div>

        {/* Gradiente inferior para contraste */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Badge de Estado Completo */}
        {estado && !minimo && (
          <span className={`absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md ${CINTA[estado] || 'bg-zinc-200 text-zinc-950'}`}>
            {estado}
          </span>
        )}

        {/* Badge de Estado Minimalista (LED Glow) */}
        {estado && minimo && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-200 backdrop-blur-md ring-1 ring-white/10">
            <span className={`h-2 w-2 rounded-full ${PUNTO[estado] || 'bg-zinc-300'}`} />
            <span className="capitalize">{estado.toLowerCase()}</span>
          </span>
        )}

        {/* Indicador de Sugerido */}
        {sugerido && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-zinc-950 shadow-md">
            ★ Top
          </span>
        )}

        {/* Badge de Calificación */}
        {nota ? (
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-0.5 text-xs font-bold text-amber-300 ring-1 ring-amber-400/30 backdrop-blur-md shadow-md">
            <span>★</span>
            <span>{nota}</span>
          </span>
        ) : null}

        {/* Título en la tarjeta si tiene espacio */}
        <span className="absolute bottom-2.5 left-2.5 right-14 block truncate text-xs font-bold text-white drop-shadow">
          {unirLinea(donde)}
        </span>
      </span>

      <span className="mt-2 block truncate text-sm font-semibold text-zinc-100 transition-colors group-hover:text-amber-300">
        {titulo}
      </span>
    </button>
  );
}

export function BannerSkeleton({ ancho = 'w-64 shrink-0 sm:w-72' }) {
  return (
    <div className={ancho}>
      <div className="aspect-[16/9] animate-pulse rounded-2xl bg-zinc-800/80 ring-1 ring-white/5" />
      <div className="mt-2.5 h-3.5 w-3/4 animate-pulse rounded-md bg-zinc-800" />
    </div>
  );
}
