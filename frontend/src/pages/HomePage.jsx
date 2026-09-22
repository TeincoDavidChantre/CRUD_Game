import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CoverTile, { CoverSkeleton } from '../components/CoverTile';
import FichaDialog from '../components/FichaDialog';
import GameSearch from '../components/GameSearch';
import PlatformIcon from '../components/PlatformIcon';
import ApiKeysModal from '../components/ApiKeysModal';
import { useToast } from '../components/Toast';
import API from '../services/api';
import { combinarCatalogo, desdeBiblioteca, desdeCatalogo, normalizar } from '../lib/fichas';

function errorMessage(error, fallback) {
  return error?.response?.data?.error || fallback;
}

function esCaratula(item) {
  const url = String(item?.portada || item?.urlPortada || '');
  if (!url) return false;
  if (item.portadaVertical === false) return false;
  if (/rawg\.io|\/screenshots?\/|\/header\.jpg|capsule_\d+x\d+|gameplay/i.test(url)) return false;
  if (/library_600x900|\/05_packshots\/|store-images\.s-microsoft|playstation\.(net|com)|mzstatic\.com|t_cover_big/i.test(url)) return true;
  return Boolean(item.portadaVertical);
}

function propioExacto(titulo, propios) {
  const n = normalizar(titulo);
  if (!n || propios.has(n)) return true;
  for (const propio of propios) {
    const corto = n.length < propio.length ? n : propio;
    const largo = n.length < propio.length ? propio : n;
    if (largo.startsWith(`${corto} `) && /remaster|remake|definitiv|deluxe|edition|goty/.test(largo)) return true;
  }
  return false;
}

function tomarSinRepetir(lista, usados, limite) {
  const salida = [];
  for (const item of lista || []) {
    if (!esCaratula(item)) continue;
    const clave = normalizar(item.titulo);
    if (!clave || usados.has(clave) || propioExacto(item.titulo, usados)) continue;
    usados.add(clave);
    salida.push(item);
    if (salida.length >= limite) break;
  }
  return salida;
}

function seedVisita() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function HomePage() {
  const [juegos, setJuegos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [parecidos, setParecidos] = useState([]);
  const [tendencias, setTendencias] = useState([]);
  const [recomendados, setRecomendados] = useState([]);
  const [amigosJugando, setAmigosJugando] = useState([]);
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [showBanner, setShowBanner] = useState(!localStorage.getItem('gametracker_keys_configured'));
  const [casa, setCasa] = useState({ nombre: '', juegos: [], sugeridos: [] });
  const [filas, setFilas] = useState([]);
  const [explorando, setExplorando] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    API.get('/juegos')
      .then(({ data }) => {
        if (active) setJuegos(data);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, 'No se pudo cargar el inicio'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    API.get('/catalogo/recomendaciones')
      .then(({ data }) => {
        if (active) setAmigosJugando(data.amigosJugando || []);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return undefined;
    let active = true;
    setExplorando(true);
    const seed = seedVisita();
    API.get('/catalogo/sugerencias', { params: { seed } })
      .then(({ data }) => {
        if (!active) return;
        setParecidos(data.paraTi || []);
        setTendencias(data.tendencias || []);
        setRecomendados([]);
        setFilas((data.porFamilia || []).map((fila) => ({
          marca: fila.nombre,
          clave: fila.familia,
          sugeridos: fila.sugeridos || [],
        })));
        setCasa(data.estudio
          ? { nombre: data.estudio.nombre, juegos: [], sugeridos: data.estudio.sugeridos || [] }
          : { nombre: '', juegos: [], sugeridos: [] });
      })
      .catch((err) => {
        if (active) console.warn('Sugerencias:', err.message);
      })
      .finally(() => {
        if (active) setExplorando(false);
      });
    return () => {
      active = false;
    };
  }, [juegos, loading]);

  function abrirBiblioteca(juego) {
    setFicha(desdeBiblioteca(juego));
  }

  async function abrirCatalogo(item) {
    const propio = juegos.find((juego) => normalizar(juego.tituloJuego) === normalizar(item.titulo));
    setFicha(desdeCatalogo(item, propio));
    if (propio || !item.id) return;
    setOpening(true);
    try {
      const { data } = await API.get(`/catalogo/juegos/${encodeURIComponent(item.id)}`);
      setFicha(desdeCatalogo(combinarCatalogo(item, data), propio));
    } catch {
      setError('No se pudo cargar la ficha');
    } finally {
      setOpening(false);
    }
  }

  async function agregar(formulario = {}) {
    if (!ficha || ficha.libraryId) return;
    setSaving(true);
    try {
      const { data } = await API.post('/juegos', {
        tituloJuego: ficha.titulo,
        urlPortada: ficha.portada,
        descripcion: ficha.descripcion,
        plataformas: formulario.plataformas || ficha.donde,
        sistemas: formulario.sistemas || ficha.sistemas,
        generos: ficha.generos,
        metacritic: ficha.metacritic,
        desarrollador: ficha.desarrollador,
        estado: formulario.estado || 'PENDIENTE',
        calificacion: formulario.calificacion || null,
        etiquetas: formulario.etiquetas || '',
        comentario: formulario.comentario || '',
      });
      setJuegos((prev) => [data, ...prev]);
      setFicha(desdeBiblioteca(data));
      toast.show(`"${data.tituloJuego}" añadido a tu biblioteca.`);
    } catch (err) {
      toast.show(errorMessage(err, 'No se pudo agregar el juego'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function guardar(cambios) {
    if (!ficha?.libraryId) return;
    setSaving(true);
    try {
      const { data } = await API.patch(`/juegos/${ficha.libraryId}`, cambios);
      setJuegos((prev) => prev.map((juego) => (juego.id === data.id ? data : juego)));
      setFicha(desdeBiblioteca(data));
      toast.show(`Ficha de "${data.tituloJuego}" actualizada.`);
    } catch (err) {
      toast.show(errorMessage(err, 'No se pudo guardar la ficha'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function quitar() {
    if (!ficha?.libraryId) return;
    setSaving(true);
    try {
      await API.delete(`/juegos/${ficha.libraryId}`);
      setJuegos((prev) => prev.filter((juego) => juego.id !== ficha.libraryId));
      toast.show(`"${ficha.titulo}" se quitó de tu biblioteca.`);
      setFicha(null);
    } catch (err) {
      toast.show(errorMessage(err, 'No se pudo quitar el juego'), 'error');
    } finally {
      setSaving(false);
    }
  }

    const propiosSet = new Set(juegos.map((j) => normalizar(j.tituloJuego)));

  const jugando = juegos.filter((juego) => juego.estado === 'JUGANDO');
  const pendientes = juegos.filter((juego) => juego.estado === 'PENDIENTE');
  const mejores = juegos
    .filter((juego) => juego.estado === 'COMPLETADO' && Number(juego.calificacion) >= 1)
    .sort((a, b) => Number(b.calificacion) - Number(a.calificacion));
  const destacado = jugando[0] || mejores[0] || juegos[0];

  // Deduplicación global: un juego solo en una fila del inicio.
  const usadosInicio = new Set(propiosSet);
  const tendenciasUnicas = tomarSinRepetir(tendencias, usadosInicio, 25);
  const recomendadosUnicos = tomarSinRepetir(recomendados, usadosInicio, 25);
  const parecidosUnicos = tomarSinRepetir(parecidos, usadosInicio, 25);
  const filasUnicas = filas
    .map((fila) => ({
      ...fila,
      sugeridos: tomarSinRepetir(fila.sugeridos, usadosInicio, 25),
    }))
    .filter((fila) => fila.sugeridos.length > 0);
  const casaUnicos = tomarSinRepetir(casa.sugeridos, usadosInicio, 25);

  return (
    <div className="space-y-8">
      <GameSearch sobrio autoFocus />
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {/* Banner de onboarding para configurar claves gratis */}
      {showBanner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <span className="text-base">⚡</span>
            <p>
              <strong>¡Desbloquea el catálogo universal!</strong> Conecta gratis tu clave de RAWG o IGDB en 1 minuto. Se guarda únicamente en este navegador.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeysModal(true)}
              className="rounded-lg bg-amber-400 px-3 py-1.5 font-bold text-zinc-950 transition hover:bg-amber-300"
            >
              Configurar claves ↗
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('gametracker_keys_configured', 'true');
                setShowBanner(false);
              }}
              className="rounded-lg px-2.5 py-1.5 text-zinc-400 hover:text-zinc-200"
            >
              Omitir
            </button>
          </div>
        </div>
      )}

      {/* Tendencias y Más Jugados (Pósteres Verticales 2:3) */}
      {tendenciasUnicas.length > 0 && (
        <Fila titulo="Tendencias y Más Jugados">
          {tendenciasUnicas.map((item) => (
            <CoverTile
              key={item.id}
              minimo
              titulo={item.titulo}
              portada={item.urlPortada || item.portada}
              sugerido
              onClick={() => abrirCatalogo(item)}
            />
          ))}
        </Fila>
      )}

      {/* Tus amigos están jugando */}
      {amigosJugando.length > 0 && (
        <Fila titulo="Tus amigos están jugando">
          {amigosJugando.filter((item) => esCaratula({ ...item, portada: item.urlPortada })).map((item) => (
            <div key={item.id} className="relative group/amigo shrink-0">
              <CoverTile
                minimo
                titulo={item.titulo}
                portada={item.urlPortada}
                estado={item.estado}
                onClick={() => abrirCatalogo({ id: item.id, titulo: item.titulo, portada: item.urlPortada })}
              />
              <Link
                to={`/perfil/${item.amigo.username}`}
                className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-zinc-950/85 px-2 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur border border-amber-500/30 hover:bg-zinc-900"
              >
                👤 @{item.amigo.username}
              </Link>
            </div>
          ))}
        </Fila>
      )}

      {/* Recomendado para ti según tus gustos (Pósteres Verticales) */}
      {recomendadosUnicos.length > 0 && (
        <Fila titulo="Recomendado para ti">
          {recomendadosUnicos.map((item) => (
            <CoverTile
              key={item.id}
              minimo
              titulo={item.titulo}
              portada={item.urlPortada || item.portada}
              sugerido
              onClick={() => abrirCatalogo(item)}
            />
          ))}
        </Fila>
      )}

      {destacado && (
        <button type="button" onClick={() => abrirBiblioteca(destacado)} className="group relative flex h-[28vh] min-h-48 max-h-72 w-full items-end overflow-hidden rounded-2xl bg-zinc-950 text-left border border-white/10 transition hover:border-amber-400/40">
          {destacado.urlPortada && <img src={destacado.urlPortada} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-2xl transition duration-500 group-hover:scale-135" />}
          {destacado.urlPortada && <img src={destacado.urlPortada} alt="" className="relative z-10 h-full w-auto max-w-[42%] object-contain p-2" />}
          <div className="relative z-10 flex-1 p-5 sm:p-8">
            <span className="mb-1 inline-block rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">Destacado en tu colección</span>
            <span className="block text-xl font-extrabold text-white sm:text-3xl line-clamp-1">{destacado.tituloJuego}</span>
            {destacado.plataformas && <span className="mt-1 block text-xs text-zinc-300 line-clamp-1">{destacado.plataformas}</span>}
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-zinc-950 transition group-hover:bg-amber-300">
              Ver ficha →
            </span>
          </div>
        </button>
      )}

      {!loading && juegos.length === 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center sm:text-left">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">🎮 Tu biblioteca está vacía</h3>
            <p className="text-xs text-zinc-400">Comienza a registrar tus títulos para desbloquear sugerencias personalizadas de juego.</p>
          </div>
          <Link
            to="/buscar"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-300 shadow-md shadow-amber-400/10 shrink-0"
          >
            Explorar catálogo →
          </Link>
        </div>
      )}

      {jugando.length > 0 && (
        <Fila titulo="Jugando actualmente">
          {jugando.map((juego) => (
            <CoverTile key={juego.id} minimo titulo={juego.tituloJuego} portada={juego.urlPortada} estado={juego.estado} onClick={() => abrirBiblioteca(juego)} />
          ))}
        </Fila>
      )}

      {(parecidosUnicos.length > 0 || explorando) && (
        <Fila titulo="Para ti">
          {parecidosUnicos.map((item) => (
            <CoverTile key={item.id} minimo titulo={item.titulo} portada={item.portada} sugerido onClick={() => abrirCatalogo(item)} />
          ))}
          {explorando && parecidosUnicos.length === 0 && Array.from({ length: 6 }, (_, index) => <CoverSkeleton key={index} />)}
        </Fila>
      )}

      {filasUnicas.map((fila) => (
        <Fila key={fila.marca} titulo={<span className="inline-flex items-center gap-2"><PlatformIcon platform={fila.marca} className="w-4 h-4" />Explorar en {fila.marca}</span>}>
          {fila.sugeridos.map((item) => (
            <CoverTile key={item.id} minimo titulo={item.titulo} portada={item.portada} sugerido onClick={() => abrirCatalogo(item)} />
          ))}
        </Fila>
      ))}

      {casa.nombre && casaUnicos.length > 0 && (
        <Fila titulo={`Más de ${casa.nombre}`}>
          {casaUnicos.map((item) => (
            <CoverTile key={`casa-${item.id}`} minimo titulo={item.titulo} portada={item.portada} sugerido onClick={() => abrirCatalogo(item)} />
          ))}
        </Fila>
      )}

      {pendientes.length > 0 && (
        <Fila titulo="Pendientes">
          {pendientes.map((juego) => (
            <CoverTile key={juego.id} minimo titulo={juego.tituloJuego} portada={juego.urlPortada} estado={juego.estado} onClick={() => abrirBiblioteca(juego)} />
          ))}
        </Fila>
      )}

      {mejores.length > 0 && (
        <Fila titulo="Tus notas">
          {mejores.map((juego) => (
            <CoverTile key={juego.id} minimo titulo={juego.tituloJuego} portada={juego.urlPortada} estado={juego.estado} nota={juego.calificacion} onClick={() => abrirBiblioteca(juego)} />
          ))}
        </Fila>
      )}

      {ficha && (
        <FichaDialog item={ficha} opening={opening} saving={saving} onClose={() => setFicha(null)} onAdd={agregar} onSave={guardar} onDelete={quitar} />
      )}

      {/* Modal de configuración de claves locales */}
      <ApiKeysModal
        isOpen={showKeysModal}
        onClose={() => setShowKeysModal(false)}
        onSaved={() => {
          setShowBanner(false);
          API.get('/catalogo/sugerencias', { params: { seed: seedVisita() } })
            .then(({ data }) => {
              setParecidos(data.paraTi || []);
              setTendencias(data.tendencias || []);
              setFilas((data.porFamilia || []).map((fila) => ({
                marca: fila.nombre,
                clave: fila.familia,
                sugeridos: fila.sugeridos || [],
              })));
            })
            .catch(() => {});
        }}
      />
    </div>
  );
}

function Fila({ titulo, children }) {
  const ref = useRef(null);

  const arrayHijos = Array.isArray(children) ? children.flat().filter(Boolean) : (children ? [children] : []);
  const cantidad = arrayHijos.length;

  function mover(direccion) {
    const caja = ref.current;
    if (!caja) return;
    caja.scrollBy({ left: direccion * Math.max(caja.clientWidth * 0.75, 240), behavior: 'smooth' });
  }

  if (cantidad === 0) return null;

  return (
    <section className="group/fila space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-100">{titulo}</h2>
          <span className="text-xs text-zinc-400 font-normal">({cantidad})</span>
        </div>
        <span className="flex gap-1 opacity-75 sm:opacity-0 transition sm:group-hover/fila:opacity-100">
          <button type="button" aria-label="Desplazar a la izquierda" onClick={() => mover(-1)} className="h-7 w-7 rounded-full bg-zinc-800 text-sm text-zinc-200 hover:bg-zinc-700 active:scale-95 transition">‹</button>
          <button type="button" aria-label="Desplazar a la derecha" onClick={() => mover(1)} className="h-7 w-7 rounded-full bg-zinc-800 text-sm text-zinc-200 hover:bg-zinc-700 active:scale-95 transition">›</button>
        </span>
      </div>
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}
