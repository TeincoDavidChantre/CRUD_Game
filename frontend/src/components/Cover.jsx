import { useEffect, useState } from 'react';
import PlaceholderCaratula from './PlaceholderCaratula';

/**
 * @param {string} src
 * @param {string[]} [fallbacks] URLs alternativas si la principal falla
 */
export default function Cover({ src, alt = '', frameClassName = '', fallbacks = [] }) {
  const candidatos = [...new Set([src, ...(fallbacks || [])].filter(Boolean))];
  const [indice, setIndice] = useState(0);
  const [ancha, setAncha] = useState(false);

  useEffect(() => {
    setIndice(0);
    setAncha(false);
  }, [src, candidatos.join('|')]);

  const actual = candidatos[indice] || '';
  const visible = Boolean(actual);

  function alCargar(event) {
    const { naturalWidth: ancho, naturalHeight: alto } = event.currentTarget;
    if (ancho > 0 && alto > 0 && ancho / alto > 0.82) setAncha(true);
  }

  function alError() {
    setAncha(false);
    setIndice((i) => (i + 1 < candidatos.length ? i + 1 : candidatos.length));
  }

  const agotado = indice >= candidatos.length;

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-zinc-950 ${frameClassName}`}>
      {visible && !agotado && ancha && (
        <img
          src={actual}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-lg filter pointer-events-none"
        />
      )}
      {visible && !agotado ? (
        <img
          key={actual}
          src={actual}
          alt={alt}
          className={`relative max-h-full max-w-full transition-transform duration-300 ${
            ancha ? 'object-contain p-1.5 drop-shadow-xl' : 'h-full w-full object-cover'
          }`}
          onLoad={alCargar}
          onError={alError}
          loading="lazy"
        />
      ) : (
        <PlaceholderCaratula titulo={alt} />
      )}
    </div>
  );
}
