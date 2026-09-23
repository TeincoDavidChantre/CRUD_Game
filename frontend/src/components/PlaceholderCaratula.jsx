import { ImageOff } from 'lucide-react';

/**
 * Carátula ausente o rechazada (sin falsos positivos de franquicia).
 */
export default function PlaceholderCaratula({ titulo = '', className = '' }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 p-3 text-center ${className}`}
      role="img"
      aria-label={titulo ? `Sin carátula: ${titulo}` : 'Sin carátula'}
    >
      <ImageOff className="h-8 w-8 shrink-0 text-zinc-600" aria-hidden="true" strokeWidth={1.5} />
      <span className="line-clamp-3 text-[11px] font-medium leading-snug text-zinc-500">
        {titulo || 'Sin portada'}
      </span>
    </div>
  );
}
