import Cover from './Cover';
import IconoPlataforma from './IconoPlataforma';
import PlatformIcon from './PlatformIcon';
import { partir, unirLinea } from '../lib/fichas';

const CINTA = {
  PENDIENTE: 'bg-sky-500/90 text-white border border-sky-400/30 shadow-sky-500/20',
  JUGANDO: 'bg-emerald-500/90 text-white border border-emerald-400/30 shadow-emerald-500/20',
  COMPLETADO: 'bg-amber-400 text-zinc-950 font-black border border-amber-300/40 shadow-amber-500/20',
  ABANDONADO: 'bg-rose-500/90 text-white border border-rose-400/30 shadow-rose-500/20',
};

const PUNTO = {
  PENDIENTE: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]',
  JUGANDO: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]',
  COMPLETADO: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]',
  ABANDONADO: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]',
};

export default function CoverTile({
  titulo,
  portada,
  portadas = [],
  donde,
  estado,
  nota,
  sugerido = false,
  badge = null,
  plataformaIcono = null,
  onClick,
  ancho = 'w-36 shrink-0 snap-start sm:w-40',
  minimo = false,
}) {
  const fallbacks = (Array.isArray(portadas) ? portadas : []).filter((u) => u && u !== portada);
  const labelAria = [
    titulo,
    estado ? `Estado: ${estado.toLowerCase()}` : null,
    nota ? `Calificación: ${nota} de 5` : null,
    badge ? String(badge) : null,
    plataformaIcono ? `En ${plataformaIcono}` : null,
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
        <Cover
          src={portada}
          alt={titulo}
          fallbacks={fallbacks}
          frameClassName="aspect-[2/3] w-full"
        />

        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {estado && !minimo && (
          <span className={`absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md ${CINTA[estado] || 'bg-zinc-200 text-zinc-950'}`}>
            {estado}
          </span>
        )}

        {estado && minimo && (
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 backdrop-blur-md ring-1 ring-white/10">
            <span className={`h-2 w-2 rounded-full ${PUNTO[estado] || 'bg-zinc-300'}`} />
            <span className="capitalize">{estado.toLowerCase()}</span>
          </span>
        )}

        {plataformaIcono && !estado && (
          <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-zinc-100 ring-1 ring-white/15 backdrop-blur-md">
            <IconoPlataforma etiqueta={plataformaIcono} size={14} className="h-3.5 w-3.5" />
          </span>
        )}

        {badge ? (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-md">
            {badge}
          </span>
        ) : null}

        {sugerido && !badge && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-zinc-950 shadow-md">
            ★ Top
          </span>
        )}

        {nota ? (
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-xs font-bold text-amber-300 ring-1 ring-amber-400/30 backdrop-blur-md shadow-md">
            <span>★</span>
            <span>{nota}</span>
          </span>
        ) : null}
      </span>

      <span className="mt-2.5 block truncate text-sm font-semibold text-zinc-100 transition-colors group-hover:text-amber-300">
        {titulo}
      </span>
      {!minimo && partir(donde).length > 0 && (
        <span className="mt-1 flex items-center gap-1.5">
          {partir(donde).slice(0, 4).map((marca) => (
            <PlatformIcon key={marca} platform={marca} className="w-3.5 h-3.5 shrink-0" />
          ))}
        </span>
      )}
    </button>
  );
}

export function CoverSkeleton({ ancho = 'w-36 shrink-0 sm:w-40' }) {
  return (
    <div className={ancho}>
      <div className="aspect-[2/3] animate-pulse rounded-2xl bg-zinc-800/80 ring-1 ring-white/5" />
      <div className="mt-2.5 h-3.5 w-3/4 animate-pulse rounded-md bg-zinc-800" />
      <div className="mt-1 h-3 w-1/2 animate-pulse rounded-md bg-zinc-800/60" />
    </div>
  );
}
