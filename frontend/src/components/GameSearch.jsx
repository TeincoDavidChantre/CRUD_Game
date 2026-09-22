import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cover from './Cover';
import Metacritic from './Metacritic';
import API from '../services/api';
import { unirLinea } from '../lib/fichas';

export default function GameSearch({ initialQuery = '', autoFocus = false, sobrio = false }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const boxRef = useRef(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const texto = query.trim();
    if (texto.length < 2) {
      setSuggestions([]);
      setHighlightIndex(-1);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await API.get('/catalogo/buscar', {
          params: { q: texto, limite: 'sugerencias' },
          signal: controller.signal,
        });
        setSuggestions(data.slice(0, 5));
        setHighlightIndex(-1);
        setError('');
        setOpen(true);
      } catch (err) {
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return;
        setSuggestions([]);
        setHighlightIndex(-1);
        setError(err?.response?.data?.error || '');
        setOpen(true);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function close(event) {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function go(texto) {
    const q = texto.trim();
    if (q.length < 2) return;
    setOpen(false);
    navigate(`/buscar?q=${encodeURIComponent(q)}`);
  }

  function handleKeyDown(event) {
    if (!open || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (event.key === 'Enter' && highlightIndex >= 0 && suggestions[highlightIndex]) {
      event.preventDefault();
      go(suggestions[highlightIndex].titulo);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setHighlightIndex(-1);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={(event) => { event.preventDefault(); go(query); }} className="flex flex-col sm:flex-row gap-3">
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Buscar"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="busqueda-sugerencias"
          aria-activedescendant={highlightIndex >= 0 ? `sug-${suggestions[highlightIndex]?.id}` : undefined}
          className={`flex-1 border bg-zinc-900 px-3 text-sm text-zinc-100 ${sobrio ? 'rounded-full border-white/10 py-2' : 'rounded-lg border-zinc-700 py-2.5'} focus:outline-none focus:border-amber-400`}
        />
        <button type="submit" className={`font-semibold text-zinc-950 ${sobrio ? 'rounded-full bg-zinc-100 px-4 py-2 text-sm hover:bg-white' : 'rounded-lg bg-amber-400 px-4 py-2.5 text-sm hover:bg-amber-300'}`}>
          Buscar
        </button>
      </form>
      {!sobrio && <p className="mt-2 text-xs text-zinc-400">Cuanto más preciso el nombre, menos resultados.</p>}
      {open && (suggestions.length > 0 || error) && (
        <div id="busqueda-sugerencias" role="listbox" className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-lg">
          {error && <p className="px-4 py-3 text-sm text-rose-300">{error}</p>}
          {suggestions.map((item, index) => (
            <button
              key={item.id}
              id={`sug-${item.id}`}
              type="button"
              role="option"
              aria-selected={index === highlightIndex}
              onClick={() => go(item.titulo)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                index === highlightIndex ? 'bg-zinc-800 ring-1 ring-amber-400/40' : 'hover:bg-zinc-800'
              }`}
            >
              <Cover src={item.portada} frameClassName="h-16 w-12 shrink-0 rounded" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-zinc-100">{item.titulo}</span>
                {unirLinea(item.donde || item.plataformas) && <span className="mt-0.5 block text-xs text-zinc-400">{unirLinea(item.donde || item.plataformas)}</span>}
                {unirLinea(item.sistemas) && <span className="block text-xs text-zinc-400">{unirLinea(item.sistemas)}</span>}
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  {item.lanzamiento ? <span>{item.lanzamiento.match(/\b(?:19|20)\d{2}\b/)?.[0]}</span> : null}
                  <Metacritic nota={item.metacritic} />
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
