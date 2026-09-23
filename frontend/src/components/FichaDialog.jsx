import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  Bookmark,
  Check,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Gamepad2,
  Hourglass,
  MessageSquare,
  MessagesSquare,
  Plus,
  Settings,
  Star,
  Tags,
  Trash2,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import Cover from './Cover';
import { ScoreBadge } from './Metacritic';
import PlatformIcon from './PlatformIcon';
import IconoPlataforma, { ListaPlataformas } from './IconoPlataforma';
import API from '../services/api';
import { anioDe, partir, clasificarDisponibilidad } from '../lib/fichas';
import { useMonedaLocal } from '../lib/moneda';
import { sinopsisParaMostrar } from '../lib/sinopsis';
import ErrorBoundary from './ErrorBoundary';

function puntuacionesExternas(item) {
  const lista = [];
  if (item?.metacritic != null) lista.push({ fuente: 'Metacritic', nota: item.metacritic });
  if (item?.openCritic != null) lista.push({ fuente: 'OpenCritic', nota: item.openCritic });
  if (item?.igdbRating != null) lista.push({ fuente: 'IGDB', nota: item.igdbRating });
  if (Array.isArray(item?.puntuaciones)) {
    for (const p of item.puntuaciones) {
      if (p?.fuente && p?.nota != null && !lista.some((x) => x.fuente === p.fuente)) {
        lista.push({ fuente: p.fuente, nota: p.nota });
      }
    }
  }
  return lista;
}

function textoJugadores(item) {
  if (item?.jugadores) return String(item.jugadores).trim();
  if (item?.modosJuego) {
    const modos = partir(item.modosJuego);
    if (modos.length) return modos.join(' · ');
  }
  return '';
}

function estadoInternet(item) {
  if (typeof item?.requiereInternet === 'boolean') return item.requiereInternet;
  if (typeof item?.online === 'boolean') return item.online;
  const raw = String(item?.conexion || '').trim().toLowerCase();
  if (!raw) return null;
  if (/requer|obligat|necesita|always|siempre|online only|online-only/.test(raw)) return true;
  if (/no\b|offline|sin conex|local/.test(raw)) return false;
  return null;
}

function FichaDialogContent({ item, opening = false, saving = false, onClose, onAdd, onSave, onDelete }) {
  const { fmtOferta } = useMonedaLocal();
  const plataformasJuego = [...new Set([...partir(item?.donde), ...partir(item?.sistemas), ...partir(item?.plataformas)])].filter((p) => p.length > 1);
  const opcionesPlataforma = plataformasJuego.length > 0 ? plataformasJuego : ['PC', 'PlayStation 5', 'Nintendo Switch', 'Xbox Series X|S', 'Android', 'iOS'];

  const [estado, setEstado] = useState(item?.estado || 'PENDIENTE');
  const [plataformaElegida, setPlataformaElegida] = useState('');
  const [otraPlataforma, setOtraPlataforma] = useState('');
  const [mostrarOtra, setMostrarOtra] = useState(false);
  const [etiquetas, setEtiquetas] = useState(item?.etiquetas || '');
  const [comentario, setComentario] = useState(item?.comentario || '');
  const [calificacion, setCalificacion] = useState(item?.calificacion || '');
  const [aviso, setAviso] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [comunidad, setComunidad] = useState({ promedio: null, totalVotos: 0, resenas: [] });
  const [tab, setTab] = useState('info');
  const [mostrarOpciones, setMostrarOpciones] = useState(false);

  useEffect(() => {
    if (!item?.titulo) return;
    let active = true;
    API.get('/social/comunidad/juego', { params: { titulo: item.titulo } })
      .then(({ data }) => {
        if (active) setComunidad(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [item?.titulo]);

  useEffect(() => {
    setEstado(item?.estado || 'PENDIENTE');
    setEtiquetas(item?.etiquetas || '');
    setComentario(item?.comentario || '');
    setCalificacion(item?.calificacion || '');
    const predeterminada = partir(item?.plataformas || item?.donde)[0] || opcionesPlataforma[0] || 'PC';
    setPlataformaElegida(predeterminada);
    setMostrarOtra(false);
    setOtraPlataforma('');
    setAviso('');
    setConfirmar(false);
    setTab('info');
    setMostrarOpciones(!!(item?.calificacion || item?.etiquetas || item?.comentario));
  }, [item?.libraryId, item?.titulo, item?.estado, item?.etiquetas, item?.comentario, item?.calificacion]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!item) return null;

  function enviarFormulario(event) {
    event.preventDefault();
    if (estado === 'COMPLETADO' && !calificacion) {
      setAviso('Por favor asigna una calificación de 1 a 5 estrellas para marcarlo como completado');
      return;
    }
    setAviso('');
    const platFinal = mostrarOtra && otraPlataforma.trim() ? otraPlataforma.trim() : (plataformaElegida || opcionesPlataforma[0] || 'PC');
    const datos = {
      estado,
      calificacion: calificacion ? Number(calificacion) : null,
      plataformas: [platFinal],
      sistemas: item.sistemas || [],
      etiquetas,
      comentario,
    };
    if (item.libraryId) {
      onSave?.(datos);
    } else {
      onAdd?.(datos);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ficha-titulo" className="grid max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl md:grid-cols-[280px_1fr] animate-modal-up">
        <Cover src={item.portada} alt={item.titulo} frameClassName="min-h-72 w-full md:min-h-full" />
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {item.etiqueta ? <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{item.etiqueta}</p> : null}
                {item.logoUrl ? (
                  <img
                    src={item.logoUrl}
                    alt=""
                    className="max-h-16 w-auto max-w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const titulo = document.getElementById('ficha-titulo');
                      if (titulo) titulo.classList.remove('sr-only');
                    }}
                  />
                ) : null}
                <h2
                  id="ficha-titulo"
                  className={`text-3xl font-black tracking-tight text-white ${item.logoUrl ? 'sr-only' : ''}`}
                >
                  {item.titulo}
                </h2>
              </div>
              <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">Cerrar</button>
            </div>

            {/* 2. Puntuaciones externas */}
            {(() => {
              const scores = puntuacionesExternas(item);
              if (scores.length === 0) return null;
              return (
                <div className="flex flex-wrap items-center gap-2">
                  {scores.map((s) => (
                    <ScoreBadge key={s.fuente} fuente={s.fuente} nota={s.nota} />
                  ))}
                </div>
              );
            })()}

            {/* 3. Nota de la plataforma (GameTracker) */}
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-300/80" aria-hidden="true" />
              <span className="font-bold">
                {comunidad.promedio ? `${comunidad.promedio} / 5` : 'Sin nota comunitaria'}
              </span>
              <span className="text-zinc-400">
                ({comunidad.totalVotos} {comunidad.totalVotos === 1 ? 'voto' : 'votos'})
              </span>
            </div>

            {/* 4–5. Plataformas/tiendas, luego consolas (sin solape ni títulos) */}
            {(() => {
              const { tiendas, consolas } = clasificarDisponibilidad(item);
              return (
                <>
                  {tiendas.length > 0 && <ListaPlataformas etiquetas={tiendas} size={15} className="text-sm" />}
                  {consolas.length > 0 && <ListaPlataformas etiquetas={consolas} size={15} className="text-sm" />}
                </>
              );
            })()}

            {/* 6–7. Desarrollador y año (sin rótulos) */}
            {item.desarrollador ? (
              <p className="text-sm text-zinc-300">{item.desarrollador}</p>
            ) : null}
            {anioDe(item.lanzamiento) ? (
              <p className="text-sm text-zinc-400">{anioDe(item.lanzamiento)}</p>
            ) : null}

            {/* Ediciones (si hay) */}
            {partir(item.ediciones).length > 0 && (
              <p className="text-sm text-zinc-400">Edición: {partir(item.ediciones).join(', ')}</p>
            )}

            {/* 8. Etiquetas / géneros */}
            {partir(item.generos).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {partir(item.generos).map((g) => (
                  <span
                    key={g}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-xs font-medium text-zinc-200"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* 9. Jugadores (si hay dato) */}
            {textoJugadores(item) ? (
              <p className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200">
                <Users className="w-4 h-4 shrink-0 text-amber-500" aria-hidden="true" />
                <span>{textoJugadores(item)}</span>
              </p>
            ) : null}

            {/* 10. Conexión a internet (si hay dato) */}
            {(() => {
              const online = estadoInternet(item);
              if (online === null) return null;
              return (
                <p className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200">
                  {online ? (
                    <Wifi className="w-4 h-4 shrink-0 text-amber-500" aria-hidden="true" />
                  ) : (
                    <WifiOff className="w-4 h-4 shrink-0 text-zinc-400" aria-hidden="true" />
                  )}
                  <span>{online ? 'Requiere conexión' : 'No requiere conexión a internet'}</span>
                </p>
              );
            })()}

            {/* Tiempos HLTB (si hay dato) */}
            {(item.hltbMain || item.hltbMainExtra || item.hltbCompletionist || item.hltb) ? (
              <p className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200">
                <Clock className="w-4 h-4 shrink-0 text-amber-500" aria-hidden="true" />
                <span>
                  {[
                    item.hltbMain ? `Historia: ${item.hltbMain}h` : null,
                    item.hltbMainExtra ? `+Extras: ${item.hltbMainExtra}h` : null,
                    item.hltbCompletionist ? `Completista: ${item.hltbCompletionist}h` : null,
                    !item.hltbMain && !item.hltbCompletionist && item.hltb ? String(item.hltb) : null,
                  ].filter(Boolean).join(' | ')}
                </span>
              </p>
            ) : null}
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-zinc-800">
            {[
              ['info', FileText, 'Info'],
              ['registro', Gamepad2, 'Mi Registro'],
              ['comunidad', MessagesSquare, 'Comunidad'],
            ].map(([id, Icono, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors ${
                  tab === id ? 'border-b-2 border-amber-400 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icono className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {tab === 'info' && (
            <>
              {opening ? <p className="text-sm text-zinc-400">Cargando especificaciones...</p> : null}

              {item.ofertaMeta && (item.ofertaMeta.gratis || item.ofertaMeta.precio != null) ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">
                  {item.ofertaMeta.gratis ? (
                    <p className="font-semibold">
                      Gratis ahora{item.ofertaMeta.tienda ? ` en ${item.ofertaMeta.tienda}` : ''}
                      {item.ofertaMeta.precioAntes != null ? (
                        <span className="ml-2 font-normal text-zinc-400 line-through">
                          {fmtOferta(item.ofertaMeta.precioAntes, item.ofertaMeta.moneda || 'USD')}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="font-semibold">
                      Oferta{item.ofertaMeta.ahorroPct ? ` −${item.ofertaMeta.ahorroPct}%` : ''}
                      {item.ofertaMeta.tienda ? ` · ${item.ofertaMeta.tienda}` : ''}
                      {item.ofertaMeta.precio != null ? (
                        <span className="ml-2 text-emerald-300">
                          {fmtOferta(item.ofertaMeta.precio, item.ofertaMeta.moneda || 'USD')}
                        </span>
                      ) : null}
                      {item.ofertaMeta.precioAntes != null ? (
                        <span className="ml-1 font-normal text-zinc-500 line-through">
                          {fmtOferta(item.ofertaMeta.precioAntes, item.ofertaMeta.moneda || 'USD')}
                        </span>
                      ) : null}
                    </p>
                  )}
                </div>
              ) : null}

              {sinopsisParaMostrar(item.descripcion) ? (
                <p className="text-sm leading-6 text-zinc-300">{sinopsisParaMostrar(item.descripcion)}</p>
              ) : item.descripcion ? (
                <p className="text-sm text-zinc-500">Sinopsis no disponible (el texto recuperado no correspondía a un videojuego).</p>
              ) : !opening ? (
                <p className="text-sm text-zinc-500">Sinopsis aún no disponible para este título.</p>
              ) : null}

              {/* Enlaces a tiendas oficiales de compra según plataforma */}
              {(() => {
                let tiendas = item.enlacesTienda;
                if (typeof tiendas === 'string') {
                  try { tiendas = JSON.parse(tiendas); } catch { tiendas = {}; }
                }
                if (!tiendas || typeof tiendas !== 'object') tiendas = {};
                const hay = Object.values(tiendas).some(Boolean);
                if (!hay) return null;
                return (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                    <p className="mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Dónde comprar / reclamar:</p>
                    <div className="flex flex-wrap gap-2">
                      {tiendas.steam && (
                        <a href={tiendas.steam} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700">
                          <IconoPlataforma etiqueta="Steam" size={14} className="w-3.5 h-3.5 text-zinc-200" />
                          Steam
                          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                        </a>
                      )}
                      {tiendas.playstation && (
                        <a href={tiendas.playstation} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-950/40 px-3 py-1.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-900/60">
                          <IconoPlataforma etiqueta="PlayStation" size={14} className="w-3.5 h-3.5 text-blue-200" />
                          PlayStation Store
                          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                        </a>
                      )}
                      {tiendas.xbox && (
                        <a href={tiendas.xbox} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-900/60">
                          <IconoPlataforma etiqueta="Xbox" size={14} className="w-3.5 h-3.5 text-emerald-200" />
                          Xbox Store
                          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                        </a>
                      )}
                      {tiendas.nintendo && (
                        <a href={tiendas.nintendo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-900/60">
                          <IconoPlataforma etiqueta="Nintendo" size={14} className="w-3.5 h-3.5 text-red-200" />
                          Nintendo eShop
                          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                        </a>
                      )}
                      {tiendas.epic && (
                        <a href={tiendas.epic} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700">
                          <IconoPlataforma etiqueta="Epic Games" size={14} className="w-3.5 h-3.5 text-zinc-200" />
                          Epic Games
                          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                        </a>
                      )}
                      {tiendas.gog && (
                        <a href={tiendas.gog} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-950/40 px-3 py-1.5 text-xs font-semibold text-purple-200 transition hover:bg-purple-900/60">
                          <IconoPlataforma etiqueta="GOG" size={14} className="w-3.5 h-3.5 text-purple-200" />
                          GOG
                          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                        </a>
                      )}
                      {tiendas.humble && (
                        <a href={tiendas.humble} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-950/40 px-3 py-1.5 text-xs font-semibold text-orange-200 transition hover:bg-orange-900/60">
                          Humble
                          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                        </a>
                      )}
                      {tiendas.oferta && (
                        <a href={tiendas.oferta} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-900/60">
                          Ver oferta
                          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {tab === 'registro' && (
          <form onSubmit={enviarFormulario} className="mt-2 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                {item.libraryId ? (
                  <>
                    <Settings className="w-3.5 h-3.5" aria-hidden="true" />
                    Tu seguimiento en biblioteca
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    Guardar en tu biblioteca
                  </>
                )}
              </h3>
              {item.libraryId && (
                <Link to={`/library/${item.libraryId}`} onClick={onClose} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-300 hover:underline">
                  Ver estantería
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </Link>
              )}
            </div>

            {/* Selector de Plataforma / Consola */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <Gamepad2 className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                ¿En qué plataforma o consola lo juegas?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {opcionesPlataforma.map((plat) => {
                  const activa = !mostrarOtra && plataformaElegida === plat;
                  return (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => {
                        setPlataformaElegida(plat);
                        setMostrarOtra(false);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition border ${
                        activa
                          ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold shadow-md shadow-amber-400/20'
                          : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60 hover:bg-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      <PlatformIcon platform={plat} className="w-3.5 h-3.5" />
                      <span>{plat}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setMostrarOtra(!mostrarOtra)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition border ${
                    mostrarOtra
                      ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold'
                      : 'bg-zinc-800/40 text-zinc-400 border-dashed border-zinc-700 hover:text-zinc-200 hover:border-zinc-500'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Otra consola
                </button>
              </div>
              {mostrarOtra && (
                <input
                  type="text"
                  value={otraPlataforma}
                  onChange={(e) => setOtraPlataforma(e.target.value)}
                  placeholder="Ej: Steam Deck, RetroArch, PS3, Game Boy Color..."
                  className="mt-2 w-full rounded-lg border border-amber-500/40 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              )}
            </div>

            {/* Selector de Estado */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <Bookmark className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                Estado de tu partida
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'PENDIENTE', label: 'Pendiente', Icono: Hourglass, activeClass: 'border-blue-500 bg-blue-500/20 text-blue-300' },
                  { id: 'JUGANDO', label: 'Jugando', Icono: Gamepad2, activeClass: 'border-emerald-500 bg-emerald-500/20 text-emerald-300' },
                  { id: 'COMPLETADO', label: 'Completado', Icono: Trophy, activeClass: 'border-amber-500 bg-amber-500/20 text-amber-300' },
                  { id: 'ABANDONADO', label: 'Abandonado', Icono: Ban, activeClass: 'border-rose-500 bg-rose-500/20 text-rose-300' },
                ].map((s) => {
                  const activa = estado === s.id;
                  const IconoEstado = s.Icono;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setEstado(s.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition ${
                        activa ? s.activeClass + ' shadow-sm' : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      <IconoEstado className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {!item.libraryId && !mostrarOpciones && (
              <button type="button" onClick={() => setMostrarOpciones(true)}
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition">
                Más opciones
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}

            {(item.libraryId || mostrarOpciones) && (
              <>
            {/* Calificación Interactiva de 1 a 5 estrellas */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                  <Star className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                  Tu puntuación personal {estado === 'COMPLETADO' && <span className="text-amber-400 font-bold">*</span>}
                </label>
                {calificacion && (
                  <button type="button" onClick={() => setCalificacion('')} className="text-[10px] text-zinc-500 hover:text-zinc-300">
                    Borrar nota
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((estrella) => (
                    <button
                      key={estrella}
                      type="button"
                      onClick={() => setCalificacion(estrella)}
                      className={`rounded p-0.5 transition hover:scale-110 ${
                        Number(calificacion) >= estrella
                          ? 'text-amber-400'
                          : 'text-zinc-700 hover:text-amber-300'
                      }`}
                      aria-label={`${estrella} de 5`}
                    >
                      <Star
                        className={`h-6 w-6 ${Number(calificacion) >= estrella ? 'fill-amber-400' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-bold text-amber-300">
                  {calificacion ? `${calificacion}/5` : <span className="text-zinc-500 font-normal">Sin puntuar</span>}
                </span>
              </div>
            </div>

            {/* Notas / Reseña personal */}
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <MessageSquare className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                Comentario o reseña personal (opcional)
              </label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={2}
                placeholder="Horas jugadas, sensaciones, logros desbloqueados..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-400/60 focus:outline-none"
              />
            </div>

            {/* Etiquetas rápidas y removibles */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                  <Tags className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                  Etiquetas personales
                </label>
                <span className="text-[10px] text-zinc-400">Separadas por coma</span>
              </div>
              {/* Chips de etiquetas actuales */}
              {etiquetas && partir(etiquetas).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {partir(etiquetas).map((etq) => (
                    <span
                      key={etq}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-xs font-semibold text-amber-300"
                    >
                      <span>{etq}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const restantes = partir(etiquetas).filter((t) => t.toLowerCase() !== etq.toLowerCase());
                          setEtiquetas(restantes.join(', '));
                        }}
                        className="hover:text-white transition rounded p-0.5"
                        aria-label={`Eliminar etiqueta ${etq}`}
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                value={etiquetas}
                onChange={(e) => setEtiquetas(e.target.value)}
                placeholder="digital, goty, coop, favoritos..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-400/60 focus:outline-none"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {['Físico', 'Digital', 'Favorito', 'Platino', 'En cooperativo'].map((chip) => {
                  const yaTiene = (etiquetas || '').toLowerCase().includes(chip.toLowerCase());
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        if (yaTiene) {
                          const restantes = partir(etiquetas).filter((t) => t.toLowerCase() !== chip.toLowerCase());
                          setEtiquetas(restantes.join(', '));
                        } else {
                          setEtiquetas((prev) => (prev ? `${prev}, ${chip}` : chip));
                        }
                      }}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition ${
                        yaTiene
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {yaTiene ? <Check className="w-3 h-3" aria-hidden="true" /> : <Plus className="w-3 h-3" aria-hidden="true" />}
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>

              </>
            )}

            {aviso && <p className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2 text-xs text-rose-300">{aviso}</p>}

            {/* Botones de acción */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-zinc-950 shadow-md shadow-amber-400/10 transition hover:bg-amber-300 active:scale-95 disabled:opacity-60"
              >
                {item.libraryId ? <Check className="w-4 h-4" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
                <span>{saving ? 'Guardando...' : (item.libraryId ? 'Guardar cambios' : 'Añadir a mi biblioteca')}</span>
              </button>

              {item.libraryId && onDelete && (
                !confirmar && (
                  <button
                    type="button"
                    onClick={() => setConfirmar(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Quitar de biblioteca
                  </button>
                )
              )}
            </div>
            {item.libraryId && onDelete && confirmar && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3 mt-4">
                <p className="text-xs text-rose-200">¿Quitar <strong>{item.titulo}</strong> de tu biblioteca? Esta acción no se puede deshacer.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={onDelete} disabled={saving}
                    className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:bg-rose-400 disabled:opacity-60">Sí, quitar</button>
                  <button type="button" onClick={() => setConfirmar(false)}
                    className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700">Cancelar</button>
                </div>
              </div>
            )}
          </form>
          )}

          {tab === 'comunidad' && (
          <div className="pt-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Opiniones de la Comunidad ({comunidad.resenas.length})
            </h3>
            {comunidad.resenas.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">Aún no hay opiniones de otros jugadores para este título. ¡Sé el primero en calificarlo!</p>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {comunidad.resenas.map((resena) => (
                  <div key={resena.id} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-2.5 text-xs">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Link
                        to={`/perfil/${resena.autor.username}`}
                        onClick={onClose}
                        className="font-bold text-amber-300 hover:underline"
                      >
                        @{resena.autor.username}
                      </Link>
                      {resena.calificacion && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-400/20 px-1.5 py-0.5 font-bold text-amber-300">
                          <Star className="w-3 h-3 fill-amber-300" aria-hidden="true" />
                          {resena.calificacion}/5
                        </span>
                      )}
                    </div>
                    {resena.comentario && <p className="text-zinc-300 leading-relaxed">{resena.comentario}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FichaDialog(props) {
  if (!props?.item) return null;
  return (
    <ErrorBoundary
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={props.onClose}>
          <div onClick={(e) => e.stopPropagation()} className="max-w-md rounded-2xl border border-rose-500/40 bg-zinc-950 p-6 text-center text-zinc-100 shadow-2xl">
            <h3 className="text-lg font-bold text-rose-400">Error al mostrar la ficha</h3>
            <p className="mt-2 text-sm text-zinc-400">Hubo un problema al procesar los datos de este juego.</p>
            <button type="button" onClick={props.onClose} className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">Cerrar</button>
          </div>
        </div>
      }
    >
      <FichaDialogContent {...props} />
    </ErrorBoundary>
  );
}
