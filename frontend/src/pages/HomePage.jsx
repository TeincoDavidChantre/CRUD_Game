import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CoverTile, { CoverSkeleton } from '../components/CoverTile';
import FichaDialog from '../components/FichaDialog';
import GameSearch from '../components/GameSearch';
import IconoPlataforma from '../components/IconoPlataforma';
import PlatformIcon from '../components/PlatformIcon';
import ApiKeysModal from '../components/ApiKeysModal';
import { useToast } from '../components/Toast';
import API from '../services/api';
import { combinarCatalogo, desdeBiblioteca, desdeCatalogo, normalizar, partir } from '../lib/fichas';
import { useMonedaLocal } from '../lib/moneda';

const POLL_OFERTAS_MS = 90_000;

function badgeOferta(item) {
  if (item?.gratis || item?.precio === 0 || item?.ahorroPct >= 100) return 'GRATIS';
  if (item?.ahorroPct > 0) return `−${Math.round(item.ahorroPct)}%`;
  return null;
}

function etiquetaTienda(item) {
  return item?.tienda || item?.plataforma || item?.claveTienda || '';
}

/** Precio estilo tienda: ~~antes~~ actual (precio real de la tienda/región) */
function PrecioOferta({ item, fmtOferta }) {
  const monedaFuente = item?.moneda || 'USD';
  if (item?.gratis || item?.precio === 0 || item?.ahorroPct >= 100) {
    return (
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[11px]">
        {item.precioAntes != null && item.precioAntes > 0 ? (
          <span className="text-zinc-500 line-through">{fmtOferta(item.precioAntes, monedaFuente)}</span>
        ) : null}
        <span className="font-bold text-emerald-400">Gratis</span>
      </p>
    );
  }
  if (item?.precio == null) return null;
  const actual = fmtOferta(item.precio, monedaFuente);
  const antes = item.precioAntes != null && item.precioAntes > item.precio
    ? fmtOferta(item.precioAntes, monedaFuente)
    : null;
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[11px]">
      {antes ? <span className="text-zinc-500 line-through">{antes}</span> : null}
      <span className="font-bold text-emerald-400">{actual}</span>
    </p>
  );
}

/** Convierte item de oferta → forma de catálogo (ficha), sin abrir la tienda. */
function enlacesDesdeOferta(item) {
  const steamAppId = item?.steamAppId ? String(item.steamAppId) : '';
  const clave = String(item?.claveTienda || item?.tienda || '').toLowerCase();
  const titulo = String(item?.titulo || '').trim();
  let url = String(item?.url || '').trim();
  // Nunca usar CheapShark como destino de los botones de tienda
  if (/cheapshark\.com/i.test(url)) url = '';

  const out = {};
  if (steamAppId) {
    out.steam = `https://store.steampowered.com/app/${steamAppId}`;
  }

  if (clave.includes('steam')) {
    out.steam = out.steam
      || (url && /steampowered\.com/i.test(url) ? url : '')
      || (titulo ? `https://store.steampowered.com/search/?term=${encodeURIComponent(titulo)}` : '');
  } else if (clave.includes('epic')) {
    out.epic = (url && /epicgames\.com/i.test(url) ? url : '')
      || (titulo ? `https://store.epicgames.com/es-ES/browse?q=${encodeURIComponent(titulo)}` : 'https://store.epicgames.com/free-games');
  } else if (clave.includes('gog')) {
    out.gog = (url && /gog\.com/i.test(url) ? url : '')
      || (titulo ? `https://www.gog.com/en/games?query=${encodeURIComponent(titulo)}` : 'https://www.gog.com');
  } else if (clave.includes('humble')) {
    out.humble = (url && /humblebundle\.com/i.test(url) ? url : '')
      || (titulo ? `https://www.humblebundle.com/store/search?search=${encodeURIComponent(titulo)}` : 'https://www.humblebundle.com/store');
  } else if (url && !/cheapshark\.com/i.test(url)) {
    out.oferta = url;
  } else if (steamAppId) {
    // ya tenemos steam
  } else if (titulo) {
    out.oferta = `https://store.steampowered.com/search/?term=${encodeURIComponent(titulo)}`;
  }

  // Limpiar vacíos
  for (const k of Object.keys(out)) {
    if (!out[k]) delete out[k];
  }
  return out;
}

function ofertaComoCatalogo(item) {
  const steamAppId = item?.steamAppId ? String(item.steamAppId) : '';
  const crudo = String(item?.id || '');
  // epic:uuid / cs:… no son ids de detalle de catálogo → no usarlos aquí
  let id = '';
  if (steamAppId) id = `steam:${steamAppId}`;
  else if (crudo.startsWith('steam:')) id = crudo;

  const tiendaNombre = item?.tienda || (item?.claveTienda === 'epic' ? 'Epic Games' : '') || '';
  return {
    id,
    titulo: item?.titulo || '',
    portada: item?.portada || item?.portadas?.[0] || '',
    portadas: item?.portadas || [],
    portadaVertical: item?.portadaVertical !== false,
    steamAppId: steamAppId || undefined,
    donde: tiendaNombre ? [tiendaNombre] : [],
    enlacesTienda: enlacesDesdeOferta(item),
    ofertaMeta: {
      precio: item?.precio ?? null,
      precioAntes: item?.precioAntes ?? null,
      ahorroPct: item?.ahorroPct ?? null,
      gratis: Boolean(item?.gratis || item?.precio === 0 || item?.ahorroPct >= 100),
      tienda: tiendaNombre,
      url: item?.url || null,
      moneda: item?.moneda || 'USD',
    },
  };
}

function TileOferta({ item, fmtOferta, conIconoPlataforma = false, onAbrir }) {
  return (
    <div className="w-36 shrink-0 snap-start sm:w-40">
      <CoverTile
        minimo
        titulo={item.titulo}
        portada={item.portada}
        portadas={item.portadas}
        badge={badgeOferta(item)}
        plataformaIcono={conIconoPlataforma ? etiquetaTienda(item) : null}
        onClick={() => onAbrir?.(item)}
        ancho="w-full"
      />
      <PrecioOferta item={item} fmtOferta={fmtOferta} />
    </div>
  );
}

function errorMessage(error, fallback) {
  return error?.response?.data?.error || fallback;
}

function esCaratula(item) {
  const url = String(item?.portada || item?.urlPortada || '');
  if (!url) return false;
  if (item.portadaVertical === false) return false;
  // Capturas reales — no bloquear media.rawg.io/media/games ni IGDB covers
  if (/\/screenshots?\//i.test(url) || /rawg\.io\/media\/screenshots/i.test(url)) return false;
  if (/\/header\.jpg|capsule_\d+x\d+/i.test(url)) return false;
  if (/gameplay/i.test(url) && /(rawg\.io|steamstatic)/i.test(url)) return false;
  if (/library_600x900|\/05_packshots\/|store-images\.s-microsoft|playstation\.(net|com)|mzstatic\.com|t_cover_big|media\.rawg\.io\/media\/(?:resize\/[^/]+\/)?games\//i.test(url)) {
    return true;
  }
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
  try {
    const clave = 'gametracker_sugerencias_seed';
    const existente = sessionStorage.getItem(clave);
    if (existente) return existente;
    const nuevo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(clave, nuevo);
    return nuevo;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function aplicarSugerencias(data, setters) {
  const {
    setParecidos, setTendencias, setRecomendados, setFilas, setCasa,
  } = setters;
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
  const [descuentos, setDescuentos] = useState([]);
  const [gratis, setGratis] = useState([]); // lista plana
  const [ofertasMeta, setOfertasMeta] = useState({ actualizadoEn: null, cargando: true });
  const { moneda, fmtOferta, tieneTasa } = useMonedaLocal();
  const [explorando, setExplorando] = useState(true);
  const [ficha, setFicha] = useState(null);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    const seed = seedVisita();
    const setters = {
      setParecidos, setTendencias, setRecomendados, setFilas, setCasa,
    };

    // Biblioteca + sugerencias + amigos en paralelo (sin cascada)
    Promise.allSettled([
      API.get('/juegos'),
      API.get('/catalogo/sugerencias', { params: { seed } }),
      API.get('/catalogo/recomendaciones'),
    ]).then(([rJuegos, rSug, rRec]) => {
      if (!active) return;
      if (rJuegos.status === 'fulfilled') {
        setJuegos(rJuegos.value.data);
      } else {
        setError(errorMessage(rJuegos.reason, 'No se pudo cargar el inicio'));
      }
      if (rSug.status === 'fulfilled') {
        aplicarSugerencias(rSug.value.data, setters);
      } else {
        console.warn('Sugerencias:', rSug.reason?.message || rSug.reason);
      }
      if (rRec.status === 'fulfilled') {
        setAmigosJugando(rRec.value.data.amigosJugando || []);
      }
    }).finally(() => {
      if (active) {
        setLoading(false);
        setExplorando(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // Ofertas + gratis: carga inicial, poll corto y al volver a la pestaña
  useEffect(() => {
    let active = true;
    let timer = null;

    async function cargarOfertas({ silencioso = false } = {}) {
      if (!silencioso) setOfertasMeta((m) => ({ ...m, cargando: true }));
      try {
        const { data } = await API.get('/catalogo/ofertas', { params: { moneda } });
        if (!active) return;
        setDescuentos(Array.isArray(data.descuentos) ? data.descuentos : []);
        // v3: gratis es lista plana; compat si llegara seccionado
        const rawGratis = data.gratis;
        let plano = [];
        if (Array.isArray(rawGratis)) {
          if (rawGratis[0]?.items) {
            plano = rawGratis.flatMap((f) => (f.items || []).map((it) => ({
              ...it,
              tienda: it.tienda || f.plataforma,
              claveTienda: it.claveTienda || f.clave,
            })));
          } else {
            plano = rawGratis;
          }
        }
        setGratis(plano);
        setOfertasMeta({
          actualizadoEn: data.actualizadoEn || new Date().toISOString(),
          cargando: false,
        });
      } catch {
        if (active) setOfertasMeta((m) => ({ ...m, cargando: false }));
      }
    }

    function programar() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        cargarOfertas({ silencioso: true }).finally(() => {
          if (active) programar();
        });
      }, POLL_OFERTAS_MS);
    }

    function onVisibilidad() {
      if (document.visibilityState === 'visible') {
        cargarOfertas({ silencioso: true });
      }
    }

    cargarOfertas().finally(() => {
      if (active) programar();
    });
    document.addEventListener('visibilitychange', onVisibilidad);

    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilidad);
    };
  }, [moneda]);

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
      // Mantener ficha provisional (p. ej. oferta sin id de catálogo resoluble)
    } finally {
      setOpening(false);
    }
  }

  /** Click en oferta: abre ficha enriquecida; el enlace a tienda va dentro de la ficha. */
  async function abrirOferta(item) {
    const base = ofertaComoCatalogo(item);
    const propio = juegos.find((juego) => normalizar(juego.tituloJuego) === normalizar(item.titulo));
    setFicha(desdeCatalogo(base, propio));
    setOpening(true);

    try {
      let hit = null;

      // 1) Detalle por steam:appId si existe
      if (base.id) {
        try {
          const { data } = await API.get(`/catalogo/juegos/${encodeURIComponent(base.id)}`);
          hit = data;
        } catch {
          /* seguir a búsqueda */
        }
      }

      // 2) Búsqueda por título (Epic free, GOG sin steamAppId, etc.)
      if (!hit?.descripcion && item.titulo) {
        try {
          const { data } = await API.get('/catalogo/buscar', { params: { q: item.titulo } });
          const lista = Array.isArray(data) ? data : (data?.resultados || data?.juegos || []);
          const n = normalizar(item.titulo);
          const cand = lista.find((j) => normalizar(j.titulo) === n)
            || lista.find((j) => {
              const t = normalizar(j.titulo);
              return t.includes(n) || n.includes(t);
            })
            || null;
          if (cand?.id) {
            try {
              const det = await API.get(`/catalogo/juegos/${encodeURIComponent(cand.id)}`);
              hit = det.data || cand;
            } catch {
              hit = cand;
            }
          } else if (cand) {
            hit = cand;
          }
        } catch {
          /* ficha mínima */
        }
      }

      if (hit) {
        const mezclado = combinarCatalogo(
          {
            ...base,
            ...hit,
            portada: hit.portada || hit.urlPortada || base.portada,
            enlacesTienda: {
              ...(typeof hit.enlacesTienda === 'object' && hit.enlacesTienda ? hit.enlacesTienda : {}),
              ...base.enlacesTienda,
            },
            donde: [...new Set([
              ...partir(hit.donde || hit.plataformas),
              ...partir(base.donde),
            ])],
            ofertaMeta: base.ofertaMeta,
          },
          hit,
        );
        setFicha(desdeCatalogo({
          ...mezclado,
          enlacesTienda: {
            ...(mezclado.enlacesTienda || {}),
            ...base.enlacesTienda,
          },
          ofertaMeta: base.ofertaMeta,
        }, propio));
      } else {
        setFicha(desdeCatalogo(base, propio));
      }
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

      {/* Ofertas ahora: 100% arriba (mezclado) + descuentos por tienda sin repetir */}
      {(ofertasMeta.cargando || gratis.length > 0 || descuentos.length > 0) && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-white">Ofertas ahora</h2>
            <p className="text-xs text-zinc-400">
              Precios en {moneda}
              {tieneTasa ? null : (
                <span className="text-amber-400/80"> · conversión pendiente</span>
              )}
              {ofertasMeta.actualizadoEn ? (
                <span className="text-zinc-500">
                  {' '}· actualizado {new Date(ofertasMeta.actualizadoEn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
            </p>
          </div>

          {(ofertasMeta.cargando && gratis.length === 0 && descuentos.length === 0) ? (
            <Fila titulo={<span className="text-zinc-400">Cargando ofertas…</span>}>
              {Array.from({ length: 8 }, (_, i) => <CoverSkeleton key={i} />)}
            </Fila>
          ) : null}

          {gratis.length > 0 && (
            <Fila titulo={`Gratis / 100% de descuento`}>
              {gratis.map((item) => (
                <TileOferta
                  key={item.id}
                  item={item}
                  fmtOferta={fmtOferta}
                  conIconoPlataforma
                  onAbrir={abrirOferta}
                />
              ))}
            </Fila>
          )}

          {descuentos.map((fila) => (
            <Fila
              key={`dto-${fila.clave}`}
              titulo={(
                <span className="inline-flex items-center gap-2">
                  <IconoPlataforma etiqueta={fila.plataforma} size={16} className="w-4 h-4" />
                  {fila.plataforma}
                </span>
              )}
            >
              {(fila.items || []).map((item) => (
                <TileOferta
                  key={item.id}
                  item={item}
                  fmtOferta={fmtOferta}
                  onAbrir={abrirOferta}
                />
              ))}
            </Fila>
          ))}
        </div>
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
          setExplorando(true);
          API.get('/catalogo/sugerencias', { params: { seed: seedVisita() } })
            .then(({ data }) => {
              aplicarSugerencias(data, {
                setParecidos, setTendencias, setRecomendados, setFilas, setCasa,
              });
            })
            .catch(() => {})
            .finally(() => setExplorando(false));
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
