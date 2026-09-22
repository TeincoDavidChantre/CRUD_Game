import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CoverTile, { CoverSkeleton } from '../components/CoverTile';
import FichaDialog from '../components/FichaDialog';
import GameSearch from '../components/GameSearch';
import PlatformIcon from '../components/PlatformIcon';
import { agruparFichas, combinarCatalogo, desdeCatalogo, puntajeNombre } from '../lib/fichas';
import API from '../services/api';

const FUENTES = ['steam', 'microsoft', 'nintendo', 'playstation', 'epic', 'apple', 'wikipedia'];

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const ORDENES = [
  { id: 'anio-desc', label: 'Año, del más nuevo al más antiguo' },
  { id: 'anio-asc', label: 'Año, del más antiguo al más nuevo' },
  { id: 'az', label: 'Alfabético, A–Z' },
  { id: 'za', label: 'Alfabético, Z–A' },
  { id: 'nota', label: 'Nota Metacritic, de mayor a menor' },
  { id: 'nombre', label: 'Más parecido al nombre' },
];

function anioDe(item) {
  const match = String(item?.lanzamiento || '').match(/\b(?:19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function claseDe(titulo) {
  const texto = String(titulo || '');
  if (/\b(remake|rework|re-work)\b/i.test(texto)) return 'Remake';
  if (/\bremasters?\b|\bremastered\b/i.test(texto)) return 'Remaster';
  if (/\bdefinitive\b/i.test(texto)) return 'Definitiva';
  return '';
}

function baseDe(titulo) {
  return String(titulo || '')
    .replace(/\b(hd\s+)?(remastered|remasters?|remake|rework|re-work)\b/gi, '')
    .replace(/\bdefinitive(?:\s+edition)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-:]\s*$/g, '')
    .trim()
    .toLowerCase();
}

function conEtiquetas(lista) {
  const bases = new Set(lista.map((item) => claseDe(item.titulo) && baseDe(item.titulo)).filter(Boolean));
  return lista.map((item, index) => {
    const clase = claseDe(item.titulo);
    const etiqueta = clase || (bases.has(baseDe(item.titulo)) ? 'Original' : '');
    return { ...item, etiqueta, _orden: index };
  });
}

function comparar(orden, consulta) {
  return (a, b) => {
    if (orden === 'nombre') return puntajeNombre(b, consulta) - puntajeNombre(a, consulta) || a.titulo.localeCompare(b.titulo, 'es');
    if (orden === 'az' || orden === 'za') {
      const texto = a.titulo.localeCompare(b.titulo, 'es');
      return orden === 'az' ? texto : -texto;
    }
    if (orden === 'nota') {
      const notaA = Number.isInteger(a.metacritic) ? a.metacritic : null;
      const notaB = Number.isInteger(b.metacritic) ? b.metacritic : null;
      if (notaA == null && notaB == null) return a.titulo.localeCompare(b.titulo, 'es');
      if (notaA == null) return 1;
      if (notaB == null) return -1;
      return notaB - notaA;
    }
    const anioA = anioDe(a);
    const anioB = anioDe(b);
    if (anioA == null && anioB == null) return a.titulo.localeCompare(b.titulo, 'es');
    if (anioA == null) return 1;
    if (anioB == null) return -1;
    if (anioA === anioB) return puntajeNombre(b, consulta) - puntajeNombre(a, consulta) || a.titulo.localeCompare(b.titulo, 'es');
    return orden === 'anio-asc' ? anioA - anioB : anioB - anioA;
  };
}

function errorMessage(error, fallback) {
  return error?.response?.data?.error || fallback;
}

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [orden, setOrden] = useState('anio-desc');
  const [filtro, setFiltro] = useState('todas');
  const [biblioteca, setBiblioteca] = useState([]);

  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) {
      setResults([]);
      return undefined;
    }
    let active = true;
    const conteo = { fichas: 0, listas: 0 };
    setLoading(true);
    setError('');
    setSelected(null);
    setResults([]);
    FUENTES.forEach((fuente) => {
      API.get('/catalogo/buscar', { params: { q: texto, fuente } })
        .then(({ data }) => {
          if (!active) return;
          conteo.fichas += data.length;
          setResults((prev) => agruparFichas([...prev, ...data]));
        })
        .catch(() => {})
        .finally(() => {
          conteo.listas += 1;
          if (!active || conteo.listas < FUENTES.length) return;
          setLoading(false);
          if (conteo.fichas === 0) setError('No hay fichas de consola, PC o celular con ese nombre.');
        });
    });
    return () => {
      active = false;
    };
  }, [q]);

  useEffect(() => {
    API.get('/juegos').then(({ data }) => setBiblioteca(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setFiltro('todas');
  }, [q]);

  async function choose(item) {
    setSelected(item);
    setOpening(true);
    setError('');
    try {
      const { data } = await API.get(`/catalogo/juegos/${encodeURIComponent(item.id)}`);
      setSelected(combinarCatalogo(item, data));
    } catch (err) {
      setError(errorMessage(err, 'No se pudo cargar el juego'));
    } finally {
      setOpening(false);
    }
  }

  function guardadoDe(titulo) {
    const clave = normalizar(titulo);
    return biblioteca.find((juego) => normalizar(juego.tituloJuego) === clave);
  }

  async function addToLibrary(formulario = {}) {
    if (!selected || guardadoDe(selected.titulo)) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await API.post('/juegos', {
        tituloJuego: selected.titulo,
        urlPortada: selected.portada,
        descripcion: selected.descripcion,
        plataformas: formulario.plataformas || (selected.donde?.length ? selected.donde : selected.plataformas),
        sistemas: formulario.sistemas || selected.sistemas,
        generos: selected.generos,
        metacritic: selected.metacritic,
        desarrollador: selected.desarrollador,
        estado: formulario.estado || 'PENDIENTE',
        calificacion: formulario.calificacion || null,
        etiquetas: formulario.etiquetas || '',
        comentario: formulario.comentario || '',
      });
      setBiblioteca((prev) => [data, ...prev]);
    } catch (err) {
      const mensaje = errorMessage(err, 'No se pudo agregar el juego');
      if (mensaje.includes('ya se encuentra')) {
        const { data } = await API.get('/juegos').catch(() => ({ data: biblioteca }));
        setBiblioteca(data);
      }
      setError(mensaje);
    } finally {
      setSaving(false);
    }
  }

  async function guardarBiblioteca(cambios) {
    const propio = selected ? guardadoDe(selected.titulo) : null;
    if (!propio) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await API.patch(`/juegos/${propio.id}`, cambios);
      setBiblioteca((prev) => prev.map((juego) => (juego.id === data.id ? data : juego)));
    } catch (err) {
      setError(errorMessage(err, 'No se pudo guardar la ficha'));
    } finally {
      setSaving(false);
    }
  }

  const etiquetados = conEtiquetas(results);
  const consolas = [...new Set(etiquetados.flatMap((item) => [...(item.donde || item.plataformas || []), ...(item.sistemas || [])]))].sort((a, b) => a.localeCompare(b, 'es'));
  const visibles = etiquetados
    .filter((item) => filtro === 'todas' || (item.donde || item.plataformas || []).includes(filtro) || (item.sistemas || []).includes(filtro))
    .sort(comparar(orden, q));
  const guardado = selected ? guardadoDe(selected.titulo) : null;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/" className="text-sm text-amber-300 hover:text-amber-200">Volver al inicio</Link>
        <h1 className="mt-2 text-3xl font-extrabold">Fichas</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {q ? `Búsqueda: ${q}. ` : ''}
          Cada ficha sale de Steam, Epic, Microsoft Store, Xbox, PlayStation, Nintendo, App Store o, si el juego ya no se vende, de Wikipedia.
          Un nombre amplio muestra todos los juegos que lo contienen. Cuanto más preciso, menos fichas quedan.
        </p>
      </div>

      <GameSearch initialQuery={q} />

      {results.length > 0 && (
        <div className="space-y-3">
          <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            Ordenar
            <select
              value={orden}
              onChange={(event) => setOrden(event.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              {ORDENES.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.label}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFiltro('todas')} className={`rounded-full px-3 py-1 text-xs font-semibold ${filtro === 'todas' ? 'bg-amber-400 text-zinc-950 font-bold' : 'bg-zinc-800 text-zinc-300'}`}>Todas</button>
            {consolas.map((consola) => (
              <button key={consola} type="button" onClick={() => setFiltro(consola)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${filtro === consola ? 'bg-amber-400 text-zinc-950 font-bold' : 'bg-zinc-800 text-zinc-300'}`}>
                <PlatformIcon platform={consola} className="w-3.5 h-3.5" color={filtro !== consola} />
                {consola}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <p className="text-sm text-zinc-400">
          {visibles.length === results.length
            ? `${results.length} ${results.length === 1 ? 'ficha' : 'fichas'}`
            : `${visibles.length} de ${results.length} fichas`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {visibles.map((item) => (
          <CoverTile
            key={item.id}
            titulo={item.titulo}
            portada={item.portada}
            donde={item.donde || item.plataformas}
            ancho="w-full"
            onClick={() => choose(item)}
          />
        ))}
        {loading && Array.from({ length: visibles.length ? 4 : 12 }, (_, index) => <CoverSkeleton key={`hueco-${index}`} ancho="w-full" />)}
      </div>
      {loading && results.length > 0 && <p className="text-sm text-zinc-400">Siguen llegando fichas de otras tiendas...</p>}

      {selected && (
        <FichaDialog
          item={desdeCatalogo(selected, guardado)}
          opening={opening}
          saving={saving}
          onClose={() => setSelected(null)}
          onAdd={addToLibrary}
          onSave={guardarBiblioteca}
        />
      )}
    </div>
  );
}
