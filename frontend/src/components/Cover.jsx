import { useState } from 'react';

export default function Cover({ src, alt = '', frameClassName = '' }) {
  const [failed, setFailed] = useState(false);
  const [ancha, setAncha] = useState(false);
  const visible = Boolean(src) && !failed;

  function alCargar(event) {
    const { naturalWidth: ancho, naturalHeight: alto } = event.currentTarget;
    if (ancho > 0 && alto > 0 && ancho / alto > 0.82) setAncha(true);
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950 ${frameClassName}`}>
      {visible && ancha && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-lg filter pointer-events-none"
        />
      )}
      {visible ? (
        <img
          src={src}
          alt={alt}
          className={`relative max-h-full max-w-full transition-transform duration-300 ${
            ancha ? 'object-contain p-1.5 drop-shadow-xl' : 'h-full w-full object-cover'
          }`}
          onLoad={alCargar}
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-900/80 p-3 text-center">
          <svg className="h-8 w-8 mb-1.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[11px] font-medium leading-tight text-zinc-500 line-clamp-2">{alt || 'Sin portada'}</span>
        </div>
      )}
    </div>
  );
}
