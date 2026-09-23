import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import CoverTile, { CoverSkeleton } from '../components/CoverTile';
import BannerTile from '../components/BannerTile';
import Cover from '../components/Cover';
import GameSearch from '../components/GameSearch';
import PlatformIcon from '../components/PlatformIcon';
import { useToast } from '../components/Toast';
import API from '../services/api';

const SUCCESS_MS = 4000;

function errorMessage(error, fallback) {
  return error?.response?.data?.error || fallback;
}

const ESTANTERIAS = [
  { id: 'playstation', nombre: 'PlayStation', icono: '🎮', etiqueta: 'PS5, PS4, PS3, PS2, Vita', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { id: 'nintendo', nombre: 'Nintendo', icono: '🍄', etiqueta: 'Switch, Wii, N64, GameCube, Retro', badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
  { id: 'xbox', nombre: 'Xbox', icono: '🟩', etiqueta: 'Series X|S, One, 360, Original', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { id: 'pc', nombre: 'PC / Windows', icono: '💻', etiqueta: 'Steam, Epic Games, GOG, PC', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  { id: 'movil', nombre: 'Móvil (Android / iOS)', icono: '📱', etiqueta: 'Google Play, App Store', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', esHorizontal: true },
  { id: 'otros', nombre: 'Retro y Arcade', icono: '🕹️', etiqueta: 'Arcade, Dreamcast, Colecciones', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
];

function clasificarPlataforma(juego) {
  const texto = `${juego.plataformas || ''} ${juego.sistemas || ''}`.toLowerCase();
  if (texto.includes('android') || texto.includes('ios') || texto.includes('iphone') || texto.includes('ipad') || texto.includes('móvil') || texto.includes('movil')) {
    return 'movil';
  }
  if (texto.includes('playstation') || texto.includes('ps5') || texto.includes('ps4') || texto.includes('ps3') || texto.includes('ps2') || texto.includes('ps1') || texto.includes('psp') || texto.includes('vita')) {
    return 'playstation';
  }
  if (texto.includes('nintendo') || texto.includes('switch') || texto.includes('wii') || texto.includes('gamecube') || texto.includes('n64') || texto.includes('snes') || texto.includes('nes') || texto.includes('game boy') || texto.includes('3ds') || texto.includes('ds')) {
    return 'nintendo';
  }
  if (texto.includes('xbox')) {
    return 'xbox';
  }
  if (texto.includes('pc') || texto.includes('windows') || texto.includes('steam') || texto.includes('epic') || texto.includes('gog') || texto.includes('linux') || texto.includes('mac')) {
    return 'pc';
  }
  return 'otros';
}

export default function LibraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const juegoActivo = params.get('juego') || '';
  const [juegos, setJuegos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(location.state?.success || '');

  // Filtros interactivos y modo de vista
  const [modoVista, setModoVista] = useState('grid'); // 'grid' | 'lista'
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [busquedaLocal, setBusquedaLocal] = useState('');
  const [orden, setOrden] = useState('reciente'); // 'reciente' | 'nota' | 'az'

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(''), SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (juegoActivo) {
      navigate(`/library/${juegoActivo}`, { replace: true });
    }
  }, [juegoActivo, navigate]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    API.get('/juegos')
      .then(({ data }) => {
        if (!active) return;
        setJuegos(data);
      })
      .catch((err) => {
        if (active) toast.show(errorMessage(err, 'No se pudo cargar la biblioteca'), 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function abrirJuego(juego) {
    navigate(`/library/${juego.id}`);
  }

  // Filtrado y ordenamiento de juegos
  const juegosFiltrados = juegos
    .filter((j) => {
      if (filtroEstado !== 'TODOS' && j.estado !== filtroEstado) return false;

      if (busquedaLocal.trim()) {
        const q = busquedaLocal.trim().toLowerCase();
        if (!j.tituloJuego.toLowerCase().includes(q)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (orden === 'nota') return (Number(b.calificacion) || 0) - (Number(a.calificacion) || 0);
      if (orden === 'az') return a.tituloJuego.localeCompare(b.tituloJuego, 'es');
      return new Date(b.creadoEn || 0) - new Date(a.creadoEn || 0);
    });

  // Agrupación en Estanterías por Plataforma
  const gruposEstanterias = ESTANTERIAS.map((est) => ({
    ...est,
    items: juegosFiltrados.filter((j) => clasificarPlataforma(j) === est.id),
  })).filter((est) => est.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Mi Biblioteca</h1>
          <p className="mt-1 text-xs text-zinc-400">Total: {juegos.length} {juegos.length === 1 ? 'juego' : 'juegos'} organizados en estanterías</p>
        </div>
        <GameSearch sobrio />
      </div>

      {/* Barra de Filtros Avanzados */}
      <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Búsqueda rápida */}
          <input
            type="text"
            value={busquedaLocal}
            onChange={(e) => setBusquedaLocal(e.target.value)}
            placeholder="Filtrar por título en tu estantería..."
            className="w-full sm:w-72 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
          />

          {/* Selector de Orden y Modo de Vista */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-400">Ordenar:</span>
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
              >
                <option value="reciente">Añadidos recientemente</option>
                <option value="nota">Nota más alta</option>
                <option value="az">Título A–Z</option>
              </select>
            </div>

            {/* Switcher Grid vs Lista */}
            <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 p-0.5">
              <button
                type="button"
                onClick={() => setModoVista('grid')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  modoVista === 'grid' ? 'bg-amber-400 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Vista de pósteres"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span className="hidden sm:inline">Pósteres</span>
              </button>
              <button
                type="button"
                onClick={() => setModoVista('lista')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  modoVista === 'lista' ? 'bg-amber-400 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Vista detallada en lista"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>
        </div>

        {/* Píldoras de Estado */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800/80">
          <span className="text-xs font-semibold text-zinc-500 mr-1">Estado:</span>
          {['TODOS', 'JUGANDO', 'COMPLETADO', 'PENDIENTE', 'ABANDONADO'].map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setFiltroEstado(opcion)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                filtroEstado === opcion ? 'bg-amber-400 text-zinc-950 shadow' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opcion}
            </button>
          ))}
        </div>

        {/* Barra de salto rápido por Estanterías */}
        {gruposEstanterias.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80">
            <span className="text-xs font-semibold text-zinc-500 mr-1">Saltar a:</span>
            {gruposEstanterias.map((est) => (
              <a
                key={est.id}
                href={`#estanteria-${est.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:border-amber-400/50 hover:text-amber-300 transition"
              >
                <PlatformIcon platform={est.id} className="w-3.5 h-3.5" />
                <span>{est.nombre}</span>
                <span className="rounded-full bg-zinc-800 px-1.5 py-0.2 text-[10px] text-zinc-400">{est.items.length}</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => <CoverSkeleton key={index} />)}
        </div>
      )}

      {!loading && juegos.length === 0 && (
        <div className="rounded-3xl border border-dashed border-zinc-700 px-6 py-16 text-center">
          <p className="text-sm text-zinc-400">Todavía no has agregado juegos a tu biblioteca.</p>
          <p className="mt-1 text-xs text-zinc-500">Usa el buscador para añadir tus títulos favoritos.</p>
        </div>
      )}

      {!loading && juegos.length > 0 && juegosFiltrados.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center text-xs text-zinc-500">
          No hay juegos que coincidan con los filtros seleccionados.
        </div>
      )}

      {/* Renderizado de Estanterías Agrupadas */}
      {gruposEstanterias.map((est) => (
        <section key={est.id} id={`estanteria-${est.id}`} className="space-y-4 pt-2 scroll-mt-6">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <div className="flex items-center gap-2.5">
              <PlatformIcon platform={est.id} className="w-5 h-5 shrink-0" />
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{est.nombre}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${est.badge}`}>
                    {est.items.length} {est.items.length === 1 ? 'título' : 'títulos'}
                  </span>
                </h2>
                <p className="text-xs text-zinc-500">{est.etiqueta}</p>
              </div>
            </div>
          </div>

          {modoVista === 'grid' ? (
            est.esHorizontal ? (
              // Fila / Grid horizontal de 16:9 para móviles
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {est.items.map((juego) => (
                  <BannerTile
                    key={juego.id}
                    minimo
                    titulo={juego.tituloJuego}
                    portada={juego.urlPortada}
                    estado={juego.estado}
                    donde={juego.plataformas || juego.sistemas}
                    nota={juego.estado === 'COMPLETADO' ? juego.calificacion : ''}
                    ancho="w-full"
                    onClick={() => abrirJuego(juego)}
                  />
                ))}
              </div>
            ) : (
              // Grid vertical 2:3 para consolas y PC
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {est.items.map((juego) => (
                  <CoverTile
                    key={juego.id}
                    minimo
                    titulo={juego.tituloJuego}
                    portada={juego.urlPortada}
                    estado={juego.estado}
                    nota={juego.estado === 'COMPLETADO' ? juego.calificacion : ''}
                    ancho="w-full"
                    onClick={() => abrirJuego(juego)}
                  />
                ))}
              </div>
            )
          ) : (
            // Modo Lista detallada
            <div className="space-y-2">
              {est.items.map((juego) => (
                <div
                  key={juego.id}
                  onClick={() => abrirJuego(juego)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3 hover:border-amber-400/40 hover:bg-zinc-900/90 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-white/10 shadow">
                      <Cover src={juego.urlPortada} alt={juego.tituloJuego} frameClassName="h-full w-full" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-zinc-100 group-hover:text-amber-300 transition-colors">
                        {juego.tituloJuego}
                      </h3>
                      <p className="truncate text-xs text-zinc-400 mt-0.5">
                        {juego.genero || 'Videojuego'} {juego.desarrollador ? `• ${juego.desarrollador}` : ''}
                      </p>
                      {(juego.plataformas || juego.sistemas) && (
                        <span className="mt-1 inline-block text-[11px] text-zinc-500 font-mono">
                          {juego.plataformas || juego.sistemas}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800/60">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      juego.estado === 'JUGANDO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      juego.estado === 'COMPLETADO' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' :
                      juego.estado === 'ABANDONADO' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        juego.estado === 'JUGANDO' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' :
                        juego.estado === 'COMPLETADO' ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]' :
                        juego.estado === 'ABANDONADO' ? 'bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]' :
                        'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]'
                      }`} />
                      {juego.estado}
                    </span>

                    {juego.calificacion ? (
                      <span className="flex items-center gap-1 rounded-lg bg-zinc-950 px-2 py-0.5 text-xs font-bold text-amber-300 border border-zinc-800">
                        ★ {juego.calificacion}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600 font-mono">—</span>
                    )}

                    <svg className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
