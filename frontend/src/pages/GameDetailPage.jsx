import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Hls from 'hls.js';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Building2,
  Calendar,
  Clapperboard,
  Clock,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Film,
  ImageOff,
  Link2,
  Monitor,
  Plus,
  Printer,
  ShoppingCart,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Cover from '../components/Cover';
import IconoPlataforma from '../components/IconoPlataforma';
import { useToast } from '../components/Toast';
import API from '../services/api';
import { anioDe, partir } from '../lib/fichas';
import { useMonedaLocal } from '../lib/moneda';
import { sinopsisParaMostrar } from '../lib/sinopsis';

const TABS = [
  { id: 'diario', label: 'Mi Diario', Icono: BookOpen },
  { id: 'preservacion', label: 'Preservación', Icono: Archive },
  { id: 'multimedia', label: 'Multimedia', Icono: Clapperboard },
  { id: 'mercado', label: 'Mercado', Icono: ShoppingCart },
];

const ESTADO_BADGE = {
  JUGANDO: 'bg-amber-400 text-zinc-950',
  COMPLETADO: 'bg-emerald-400 text-zinc-950',
  PENDIENTE: 'bg-sky-400 text-zinc-950',
  ABANDONADO: 'bg-rose-400 text-zinc-950',
};

const ESTADO_LABEL = {
  JUGANDO: 'Jugando',
  COMPLETADO: 'Completado',
  PENDIENTE: 'Pendiente',
  ABANDONADO: 'Abandonado',
};

function errorMessage(error, fallback) {
  return error?.response?.data?.error || fallback;
}

function formatearFecha(valor) {
  if (!valor) return '—';
  try {
    return new Date(valor).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatearHoras(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number.isInteger(n) ? `${n} h` : `${n.toFixed(1)} h`;
}

function plataformaResumen(juego) {
  const piezas = [...partir(juego?.plataformas), ...partir(juego?.sistemas)];
  return piezas.length ? piezas.slice(0, 3).join(' / ') : 'Sin plataforma';
}

function scoreRing(score) {
  if (!Number.isInteger(score) || score <= 0) return null;
  if (score >= 75) return 'border-emerald-400 text-emerald-300';
  if (score >= 50) return 'border-amber-400 text-amber-300';
  return 'border-rose-400 text-rose-300';
}

function TrailerSteam({ url, titulo }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return undefined;
    let hls = null;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return undefined;
    }

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
    }

    return () => {
      hls?.destroy();
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className="h-full w-full bg-black"
      aria-label={`Tráiler de ${titulo}`}
    />
  );
}

function puedeVerseAqui(url) {
  return Boolean(url)
    && !/mapgenie\.io|fandom\.com|fextralife\.com|steamcommunity\.com|steampowered\.com|ign\.com|wikipedia\.org|gamefaqs\.gamespot\.com|zeldadungeon\.net|wikidata\.org|reddit\.com|hollowknightmap\.com/i.test(url);
}

function abrirVisor(url) {
  const ventana = window.open(url, 'preservacion-visor', 'popup,width=1280,height=860,noopener,noreferrer');
  if (!ventana) window.open(url, '_blank', 'noopener,noreferrer');
}

function EmptyBlock({ icon: Icono = ImageOff, titulo, mensaje, className = '' }) {
  return (
    <div
      className={`flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 px-6 py-10 text-center ${className}`}
    >
      <Icono className="h-10 w-10 shrink-0 text-zinc-500" aria-hidden="true" strokeWidth={1.5} />
      {titulo ? <p className="text-sm font-semibold text-zinc-300">{titulo}</p> : null}
      <p className="max-w-md text-sm leading-relaxed text-zinc-400">{mensaje}</p>
    </div>
  );
}

export default function GameDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [juego, setJuego] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('diario');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [docActivo, setDocActivo] = useState('manual');
  const [zoomDoc, setZoomDoc] = useState(100);
  const [docUrlNuevo, setDocUrlNuevo] = useState('');
  const [docTituloNuevo, setDocTituloNuevo] = useState('');
  const [docTipoNuevo, setDocTipoNuevo] = useState('otro');
  const [guardandoDoc, setGuardandoDoc] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const { moneda, fmt: fmtMoneda } = useMonedaLocal();

  useEffect(() => {
    if (!id) {
      navigate('/library', { replace: true });
      return undefined;
    }

    let active = true;
    setLoading(true);
    setErrorCarga('');
    setJuego(null);

    API.get(`/juegos/${encodeURIComponent(id)}`)
      .then(({ data }) => {
        if (!active) return;
        if (!data?.id) {
          setErrorCarga('Respuesta incompleta del servidor');
          return;
        }
        setJuego(data);
        setNotas(data.comentario || '');
      })
      .catch((err) => {
        if (!active) return;
        const msg = errorMessage(err, 'No se pudo cargar el juego');
        setErrorCarga(msg);
        toast.show(msg, 'error');
        navigate('/library', { replace: true });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const s = juego?.santuario && typeof juego.santuario === 'object' ? juego.santuario : {};
  const bannerSrc = s.bannerUrl || juego?.urlPortada || '';
  const anio = useMemo(() => {
    if (juego?.anoLanzamiento) return String(juego.anoLanzamiento);
    return anioDe(juego?.creadoEn) || '';
  }, [juego]);

  const hltbMain = formatearHoras(s.hltbMain);
  const hltbExtra = formatearHoras(s.hltbMainExtra);
  const hltbFull = formatearHoras(s.hltbCompletionist);
  const screenshots = Array.isArray(s.screenshots) ? s.screenshots.filter(Boolean) : [];
  const trailerId = s.trailerYoutubeId ? String(s.trailerYoutubeId) : '';
  const trailerStream = !trailerId && s.trailerStreamUrl ? String(s.trailerStreamUrl) : '';
  const hayMultimedia = Boolean(trailerId) || Boolean(trailerStream) || screenshots.length > 0;

  const notaMeta = Number.isInteger(s.metacritic) && s.metacritic > 0
    ? s.metacritic
    : (Number.isInteger(juego?.metacritic) && juego.metacritic > 0 ? juego.metacritic : null);
  const igdb = Number.isInteger(s.igdbRating) && s.igdbRating > 0 ? s.igdbRating : null;
  const ocScore = Number.isInteger(s.openCriticScore) && s.openCriticScore > 0 ? s.openCriticScore : null;
  const criticFuente = s.criticFuente
    || (notaMeta != null ? 'Metacritic' : (ocScore != null ? 'OpenCritic' : null));
  const criticScore = Number.isInteger(s.criticScore) && s.criticScore > 0
    ? s.criticScore
    : (notaMeta ?? ocScore);

  const mercado = s.mercado && typeof s.mercado === 'object'
    ? s.mercado
    : { ofertasPC: null, tiendasConsola: [] };
  const ofertasPC = (mercado.ofertasPC && typeof mercado.ofertasPC === 'object')
    ? mercado.ofertasPC
    : (s.precios && typeof s.precios === 'object' ? s.precios : null);
  const tiendasConsola = Array.isArray(mercado.tiendasConsola) ? mercado.tiendasConsola.filter((t) => t?.url) : [];
  const precios = ofertasPC;
  const precioHistorico = fmtMoneda(precios?.cheapestPrice);
  const precioActual = fmtMoneda(precios?.salePrice);

  const textoPlataformas = `${juego?.plataformas || ''} ${juego?.sistemas || ''}`.toLowerCase();
  const parecePc = !textoPlataformas.trim()
    || /\bpc\b|windows|steam|epic|gog|microsoft store|mac|linux/.test(textoPlataformas);
  const hayOfertasPc = Boolean(precios);
  const hayTiendasConsola = tiendasConsola.length > 0;
  const sinMercado = !hayOfertasPc && !hayTiendasConsola;

  const fmtPrecioTienda = (item) => {
    if (item?.precio == null || !Number.isFinite(Number(item.precio))) return null;
    const n = Number(item.precio);
    if (n === 0) return 'Gratis';
    try {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: item.moneda || 'USD',
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${n} ${item.moneda || 'USD'}`;
    }
  };

  const precioPorTienda = (clave) => {
    const deals = Array.isArray(precios?.deals) ? precios.deals : [];
    const alias = {
      steam: ['steam', '1'],
      epic: ['epic', 'epic games', '25'],
      gog: ['gog', '7'],
    };
    const keys = alias[clave] || [clave];
    const hit = deals.find((d) => {
      const nom = String(d.tienda || '').toLowerCase();
      const sid = String(d.storeID || '');
      return keys.some((k) => nom.includes(k) || sid === k);
    });
    if (!hit) return null;
    return {
      price: hit.price,
      label: fmtMoneda(hit.price),
      url: hit.url || null,
      savings: hit.savings,
    };
  };

  const docsDesdeApi = Array.isArray(s.preservacionDocs) ? s.preservacionDocs.filter((d) => d?.url) : [];
  const docsBase = [
    { id: 'manual', tipo: 'manual', titulo: 'Manual de Instrucciones', url: null, fuente: null },
    { id: 'mapa', tipo: 'mapa', titulo: 'Mapa', url: null, fuente: null },
    { id: 'guia', tipo: 'guia', titulo: 'Guía', url: null, fuente: null },
    { id: 'wiki', tipo: 'wiki', titulo: 'Wiki del juego', url: null, fuente: null },
    { id: 'oficial', tipo: 'oficial', titulo: 'Sitio oficial', url: null, fuente: null },
  ];
  const docsFijos = docsBase.map((base) => {
    const hit = docsDesdeApi.find((d) => d.tipo === base.tipo && d.fuente !== 'Usuario')
      || (base.tipo === 'manual' && s.manualUrl
        ? {
          tipo: 'manual',
          titulo: 'Manual de Instrucciones',
          url: s.manualUrl,
          fuente: s.archiveIdentifier ? 'Internet Archive' : 'Steam / origen',
          esPdf: /\.pdf($|\?)/i.test(s.manualUrl),
        }
        : null);
    if (!hit) return base;
    const esPdf = Boolean(hit.esPdf) || /\.pdf($|\?)/i.test(hit.url || '');
    const esImagen = Boolean(hit.esImagen) || /\.(jpe?g|png|webp|gif)($|\?)/i.test(hit.url || '');
    const esEnlace = Boolean(hit.esEnlace) || (!esPdf && !esImagen);
    return {
      ...base,
      id: base.tipo,
      titulo: hit.titulo || base.titulo,
      url: hit.url || null,
      fuente: hit.fuente || null,
      esPdf,
      esImagen,
      esEnlace,
      tituloOrigen: hit.tituloOrigen || null,
    };
  });
  const urlsFijos = new Set(docsFijos.map((d) => d.url).filter(Boolean));
  const docsUsuario = docsDesdeApi
    .filter((d) => d.fuente === 'Usuario' || !urlsFijos.has(d.url))
    .filter((d, i, arr) => arr.findIndex((x) => x.url === d.url) === i)
    .map((hit, i) => {
      const esPdf = Boolean(hit.esPdf) || /\.pdf($|\?)/i.test(hit.url || '');
      const esImagen = Boolean(hit.esImagen) || /\.(jpe?g|png|webp|gif)($|\?)/i.test(hit.url || '');
      return {
        id: hit.id || `usuario-${i}`,
        tipo: hit.tipo || 'otro',
        titulo: hit.titulo || 'Documento',
        url: hit.url,
        fuente: hit.fuente || 'Usuario',
        esPdf,
        esImagen,
        esEnlace: Boolean(hit.esEnlace) || (!esPdf && !esImagen),
        tituloOrigen: hit.tituloOrigen || null,
        esUsuario: hit.fuente === 'Usuario',
      };
    });
  const docs = [...docsFijos, ...docsUsuario];
  const docSel = docs.find((d) => d.id === docActivo) || docs[0];
  const docZoom = Math.max(50, Math.min(400, Number(zoomDoc) || 100));
  const desarrollador = juego?.desarrollador || s.desarrollador || '';
  const editor = juego?.editor || s.editor || '';
  const enlaces = s.enlacesTienda && typeof s.enlacesTienda === 'object' ? s.enlacesTienda : {};
  const sinopsis = sinopsisParaMostrar(juego?.descripcion || '');

  function listaDocsUsuarioActual() {
    try {
      const raw = juego?.preservacionUsuarioJson;
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : (Array.isArray(raw) ? raw : []);
      return Array.isArray(parsed) ? parsed.filter((d) => d?.url) : [];
    } catch {
      return docsUsuario.filter((d) => d.esUsuario).map((d) => ({
        id: d.id,
        tipo: d.tipo,
        titulo: d.titulo,
        url: d.url,
        fuente: 'Usuario',
      }));
    }
  }

  async function persistirDocsUsuario(lista) {
    if (!juego?.id) return;
    setGuardandoDoc(true);
    try {
      await API.patch(`/juegos/${juego.id}`, { preservacionUsuario: lista });
      const { data } = await API.get(`/juegos/${encodeURIComponent(juego.id)}`);
      setJuego(data);
      toast.show('Documento de preservación guardado');
      return data;
    } catch (err) {
      toast.show(errorMessage(err, 'No se pudo guardar el documento'), 'error');
      return null;
    } finally {
      setGuardandoDoc(false);
    }
  }

  async function anadirDocUsuario(e) {
    e?.preventDefault?.();
    const url = String(docUrlNuevo || '').trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.show('Introduce una URL http(s) válida', 'error');
      return;
    }
    const lista = listaDocsUsuarioActual();
    if (lista.some((d) => d.url === url)) {
      toast.show('Esa URL ya está en tus documentos', 'error');
      return;
    }
    const nuevo = {
      id: `usuario:${Date.now()}`,
      tipo: docTipoNuevo || 'otro',
      titulo: String(docTituloNuevo || '').trim() || 'Documento',
      url,
      fuente: 'Usuario',
    };
    const data = await persistirDocsUsuario([...lista, nuevo]);
    if (data) {
      setDocUrlNuevo('');
      setDocTituloNuevo('');
      setDocTipoNuevo('otro');
      setDocActivo(nuevo.id);
    }
  }

  async function quitarDocUsuario(docId) {
    const lista = listaDocsUsuarioActual().filter((d) => d.id !== docId);
    const data = await persistirDocsUsuario(lista);
    if (data) setDocActivo('manual');
  }

  async function guardarNotas() {
    if (!juego?.id) return;
    setGuardando(true);
    try {
      const { data } = await API.patch(`/juegos/${juego.id}`, { comentario: notas });
      setJuego((prev) => ({
        ...prev,
        ...data,
        santuario: prev?.santuario || s,
        descripcion: data.descripcion ?? prev?.descripcion,
      }));
      toast.show('Notas guardadas');
    } catch (err) {
      toast.show(errorMessage(err, 'No se pudieron guardar las notas'), 'error');
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-zinc-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
        Cargando ficha del Santuario…
      </div>
    );
  }

  if (!juego) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <EmptyBlock
          titulo="No se pudo abrir el juego"
          mensaje={errorCarga || 'Vuelve a la biblioteca e inténtalo de nuevo.'}
        />
        <Link to="/library" className="mt-6 inline-block text-sm font-semibold text-amber-300 hover:underline">
          ← Volver a Biblioteca
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-0 text-zinc-100">
      {/* Hero */}
      <section className="relative min-h-[220px] overflow-hidden border-b border-white/10 sm:min-h-[280px] md:min-h-[340px]">
        <div className="absolute inset-0 bg-zinc-900">
          {bannerSrc ? (
            <img
              src={bannerSrc}
              alt=""
              className="h-full w-full scale-105 object-cover opacity-40 blur-[2px]"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/30" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-6 pt-4 sm:pb-8 sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <Link
              to="/library"
              className="inline-flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-medium text-zinc-200 backdrop-blur hover:bg-black/60 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Biblioteca
            </Link>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow ${ESTADO_BADGE[juego.estado] || ESTADO_BADGE.PENDIENTE}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
              {ESTADO_LABEL[juego.estado] || juego.estado}
            </span>
          </div>

          <div className="mt-6 flex flex-col items-center gap-4 sm:mt-10 sm:flex-row sm:items-end sm:gap-6">
            <div className="h-40 w-28 shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/15 sm:h-48 sm:w-32">
              <Cover src={juego.urlPortada} alt={juego.tituloJuego} frameClassName="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
              {s.logoUrl ? (
                <img
                  src={s.logoUrl}
                  alt={juego.tituloJuego}
                  className="mx-auto mb-3 max-h-16 w-auto max-w-[280px] object-contain drop-shadow-lg sm:mx-0 sm:max-h-20"
                />
              ) : (
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
                  {juego.tituloJuego}
                </h1>
              )}
              {s.logoUrl ? <p className="sr-only">{juego.tituloJuego}</p> : null}
              <p className="mt-2 text-sm text-zinc-300">
                {[desarrollador, anio].filter(Boolean).join(' · ') || 'Tu biblioteca'}
              </p>
              {sinopsis ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300 line-clamp-4 sm:line-clamp-5">
                  {sinopsis}
                </p>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">Sin sinopsis disponible para este título.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <nav className="sticky top-16 z-10 border-b border-white/10 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {TABS.map(({ id: tabId, label, Icono }) => {
            const activo = tab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => setTab(tabId)}
                className={`relative flex shrink-0 items-center gap-2 px-4 py-3.5 text-sm font-semibold transition ${
                  activo ? 'text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icono className="h-4 w-4 shrink-0 opacity-90" aria-hidden="true" />
                {label}
                {activo ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-amber-400" />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Contenido de pestañas */}
      <div className="mx-auto min-h-[420px] max-w-7xl px-4 py-6 sm:py-8">
        {tab === 'diario' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
            <aside className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
              <div className="grid grid-cols-2 divide-x divide-y divide-zinc-800">
                <div className="flex flex-col gap-1.5 p-4">
                  <Calendar className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Añadido</p>
                  <p className="text-sm font-semibold text-zinc-100">{formatearFecha(juego.creadoEn)}</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4">
                  <Clock className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Historia (HLTB)</p>
                  <p className="text-sm font-semibold text-zinc-100">{hltbMain || '—'}</p>
                  {!hltbMain ? <p className="text-[10px] text-zinc-500">Sin dato</p> : null}
                  {hltbExtra ? <p className="text-[10px] text-zinc-500">+Extras ~{hltbExtra}</p> : null}
                </div>
                <div className="flex flex-col gap-1.5 p-4">
                  <Monitor className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Plataforma</p>
                  <p className="text-sm font-semibold leading-snug text-zinc-100">{plataformaResumen(juego)}</p>
                </div>
                <div className="flex flex-col gap-1.5 p-4">
                  <Clock className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Completista</p>
                  <p className="text-sm font-semibold text-zinc-100">{hltbFull || '—'}</p>
                  {!hltbFull ? <p className="text-[10px] text-zinc-500">Sin dato</p> : null}
                </div>
              </div>
              {juego.calificacion ? (
                <div className="border-t border-zinc-800 px-4 py-3 text-xs text-amber-300">
                  Tu nota: <span className="font-bold">{juego.calificacion}/5</span>
                </div>
              ) : null}
              {s.jugadores ? (
                <div className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">
                  Modos: <span className="text-zinc-200">{s.jugadores}</span>
                  {s.requiereInternet === true ? (
                    <span className="ml-2 text-sky-300">· Requiere internet</span>
                  ) : null}
                </div>
              ) : null}
            </aside>

            <div className="flex min-h-[280px] flex-col gap-5">
              <section className="flex flex-1 flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-white">Notas</h2>
                  <button
                    type="button"
                    onClick={guardarNotas}
                    disabled={guardando || notas === (juego.comentario || '')}
                    className="rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-40"
                  >
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={12}
                  placeholder={'## Boss: ...\n- Tips\n*Notas personales*'}
                  className="min-h-[240px] flex-1 resize-y rounded-2xl border border-amber-500/35 bg-zinc-950/80 px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                />
                <p className="text-[11px] text-zinc-500">Puedes usar markdown simple; el formato enriquecido llegará más adelante.</p>
              </section>
            </div>
          </div>
        )}

        {tab === 'preservacion' && (
          <div className="space-y-4">
            <form
              onSubmit={anadirDocUsuario}
              className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <div className="min-w-[140px] flex-1 space-y-1.5">
                <label htmlFor="doc-titulo" className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Título
                </label>
                <input
                  id="doc-titulo"
                  value={docTituloNuevo}
                  onChange={(e) => setDocTituloNuevo(e.target.value)}
                  placeholder="Guía, mapa, PDF…"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="w-full space-y-1.5 sm:min-w-[220px] sm:flex-[2]">
                <label htmlFor="doc-url" className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  URL
                </label>
                <input
                  id="doc-url"
                  value={docUrlNuevo}
                  onChange={(e) => setDocUrlNuevo(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="w-full space-y-1.5 sm:w-36">
                <label htmlFor="doc-tipo" className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Tipo
                </label>
                <select
                  id="doc-tipo"
                  value={docTipoNuevo}
                  onChange={(e) => setDocTipoNuevo(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                >
                  <option value="otro">Otro</option>
                  <option value="manual">Manual</option>
                  <option value="mapa">Mapa</option>
                  <option value="guia">Guía</option>
                  <option value="wiki">Wiki</option>
                  <option value="oficial">Oficial</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={guardandoDoc || !docUrlNuevo.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {guardandoDoc ? 'Guardando…' : 'Añadir URL'}
              </button>
            </form>

          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <aside className="flex flex-col gap-2">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Documentos</p>
              {docs.filter((d) => !d.esUsuario && docsFijos.some((f) => f.id === d.id)).map((doc) => {
                const activo = docActivo === doc.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      setDocActivo(doc.id);
                      setZoomDoc(100);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition ${
                      activo
                        ? 'border-amber-400/40 bg-zinc-800 text-amber-300'
                        : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    {doc.esUsuario ? (
                      <Link2 className={`h-4 w-4 shrink-0 ${activo ? 'text-amber-400' : 'text-zinc-500'}`} aria-hidden="true" />
                    ) : (
                      <FileText className={`h-4 w-4 shrink-0 ${activo ? 'text-amber-400' : 'text-zinc-500'}`} aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      {doc.titulo}
                      {!doc.url ? (
                        <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">Sin archivo</span>
                      ) : doc.fuente ? (
                        <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">Obtenido de {doc.fuente}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
              {docsUsuario.length > 0 ? (
                <p className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Enlaces extra</p>
              ) : null}
              {docsUsuario.map((doc) => {
                const activo = docActivo === doc.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      setDocActivo(doc.id);
                      setZoomDoc(100);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition ${
                      activo
                        ? 'border-amber-400/40 bg-zinc-800 text-amber-300'
                        : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <Link2 className={`h-4 w-4 shrink-0 ${activo ? 'text-amber-400' : 'text-zinc-500'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      {doc.titulo}
                      <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">
                        Obtenido de {doc.fuente || 'enlace'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </aside>

            <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2 text-xs text-zinc-400">
                <div className="flex min-w-0 items-center gap-2 font-medium text-zinc-200">
                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{docSel?.titulo}</span>
                </div>
                <div className="flex items-center gap-1">
                  {docSel?.esUsuario ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-rose-300 hover:bg-zinc-800 disabled:opacity-40"
                      disabled={guardandoDoc}
                      onClick={() => quitarDocUsuario(docSel.id)}
                      aria-label="Quitar documento"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Quitar
                    </button>
                  ) : null}
                  {docSel?.url ? (
                    <a
                      href={docSel.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-amber-300 hover:bg-zinc-800"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="rounded p-1.5 hover:bg-zinc-800 disabled:opacity-40"
                    aria-label="Alejar"
                    disabled={!docSel?.url}
                    onClick={() => setZoomDoc((z) => Math.max(50, z - 25))}
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-1 tabular-nums">{docZoom}%</span>
                  <button
                    type="button"
                    className="rounded p-1.5 hover:bg-zinc-800 disabled:opacity-40"
                    aria-label="Acercar"
                    disabled={!docSel?.url}
                    onClick={() => setZoomDoc((z) => Math.min(400, z + 25))}
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={docSel?.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded p-1.5 ${docSel?.url ? 'hover:bg-zinc-800' : 'pointer-events-none opacity-40'}`}
                    aria-label="Descargar"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    className="rounded p-1.5 hover:bg-zinc-800 disabled:opacity-40"
                    aria-label="Imprimir"
                    disabled={!docSel?.url}
                    onClick={() => {
                      if (!docSel?.url) return;
                      window.open(docSel.url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-zinc-950/40 p-3">
                {docSel?.url ? (
                  <div className="min-h-[480px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950">
                    {docSel.esEnlace && !puedeVerseAqui(docSel.url) ? (
                      <div className="flex min-h-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
                        <FileText className="h-12 w-12 text-amber-400" aria-hidden="true" />
                        <div className="max-w-md space-y-2">
                          <p className="text-lg font-semibold text-zinc-100">{docSel.titulo}</p>
                          <p className="text-sm text-zinc-400">
                            Obtenido de {docSel.fuente || 'esa web'}. Ese sitio no deja incrustar el mapa aquí
                            (si se fuerza, sale una página en blanco).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => abrirVisor(docSel.url)}
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Ver mapa
                        </button>
                      </div>
                    ) : docSel.esImagen && !docSel.esPdf ? (
                      <div
                        className="max-h-[70vh] min-h-[480px] cursor-grab overflow-auto p-4 active:cursor-grabbing"
                        onPointerDown={(event) => {
                          const caja = event.currentTarget;
                          const inicioX = event.clientX;
                          const inicioY = event.clientY;
                          const scrollX = caja.scrollLeft;
                          const scrollY = caja.scrollTop;
                          caja.setPointerCapture(event.pointerId);
                          const mover = (ev) => {
                            caja.scrollLeft = scrollX - (ev.clientX - inicioX);
                            caja.scrollTop = scrollY - (ev.clientY - inicioY);
                          };
                          const soltar = () => {
                            caja.removeEventListener('pointermove', mover);
                            caja.removeEventListener('pointerup', soltar);
                          };
                          caja.addEventListener('pointermove', mover);
                          caja.addEventListener('pointerup', soltar);
                        }}
                      >
                        <img
                          src={docSel.url}
                          alt={docSel.titulo}
                          draggable={false}
                          style={{ width: `${Math.max(docZoom, 100)}%`, maxWidth: 'none' }}
                          className="mx-auto h-auto object-contain"
                        />
                      </div>
                    ) : (
                      <iframe
                        title={docSel.titulo}
                        src={docSel.esPdf || /\.pdf($|\?)/i.test(docSel.url)
                          ? `${docSel.url}#toolbar=1&navpanes=0&view=FitH`
                          : docSel.url}
                        className="min-h-[70vh] w-full border-0 bg-zinc-900"
                        style={{ height: `${Math.round(640 * (docZoom / 100))}px` }}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {(docSel.fuente || docSel.tituloOrigen) ? (
                      <p className="border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-500">
                        {docSel.fuente ? `Obtenido de ${docSel.fuente}` : null}
                        {docSel.tituloOrigen ? ` · ${docSel.tituloOrigen}` : null}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <EmptyBlock
                    icon={Archive}
                    titulo={docSel?.titulo || 'Documento'}
                    mensaje="No encontramos este documento. Buscamos Archive, Steam, Wikidata, IGDB y mapas curados; también puedes añadir una URL arriba."
                    className="min-h-[320px] border-0 bg-transparent"
                  />
                )}
              </div>
            </section>
          </div>
          </div>
        )}

        {tab === 'multimedia' && (
          <div className="space-y-5">
            {!hayMultimedia ? (
              <EmptyBlock
                icon={ImageOff}
                titulo="Multimedia"
                mensaje="No hay contenido multimedia disponible para este título"
                className="min-h-[280px]"
              />
            ) : null}

            {trailerId ? (
              <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
                <div className="aspect-video w-full bg-zinc-950">
                  <iframe
                    title={`Tráiler de ${juego.tituloJuego}`}
                    src={`https://www.youtube.com/embed/${encodeURIComponent(trailerId)}`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </section>
            ) : trailerStream ? (
              <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
                <div className="aspect-video w-full bg-zinc-950">
                  <TrailerSteam url={trailerStream} titulo={juego.tituloJuego} />
                </div>
              </section>
            ) : hayMultimedia ? (
              <EmptyBlock
                icon={Film}
                titulo="Tráiler"
                mensaje="No hay tráiler de YouTube vinculado para este título."
                className="aspect-video min-h-0"
              />
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">Capturas</h2>
                {screenshots.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {screenshots.slice(0, 9).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="aspect-video overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock
                    icon={ImageOff}
                    mensaje="No hay capturas disponibles para este título."
                    className="min-h-[160px] border-0 bg-zinc-950/40"
                  />
                )}
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-400">Datos técnicos</h2>
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-2 text-sm">
                    <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Desarrollador</p>
                      <p className="font-semibold text-zinc-100">{desarrollador || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Editor</p>
                      <p className="font-semibold text-zinc-100">{editor || '—'}</p>
                    </div>
                  </div>
                </div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Especificaciones de PC</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {['Mínimos', 'Recomendados'].map((nivel) => (
                    <div key={nivel} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-500">
                      <p className="mb-2 font-semibold text-zinc-300">{nivel}</p>
                      <p>OS —</p>
                      <p>Procesador —</p>
                      <p>RAM —</p>
                      <p>Gráficos —</p>
                      <p>Almacenamiento —</p>
                    </div>
                  ))}
                </div>
                {partir(juego.generos).length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {partir(juego.generos).map((g) => (
                      <span key={g} className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-300">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {tab === 'mercado' && (
          <div className="space-y-5">
            <div className={`grid gap-4 ${hayOfertasPc ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Puntuación de la crítica</p>
                {criticScore != null ? (
                  <>
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-full border-4 text-2xl font-black ${scoreRing(criticScore)}`}
                    >
                      {criticScore}
                    </div>
                    {criticFuente ? (
                      <p className="mt-2 text-[11px] text-zinc-500">vía {criticFuente}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">Sin nota</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">OpenCritic</p>
                  {ocScore != null ? (
                    <>
                      <p className="mt-2 text-3xl font-black text-zinc-100">{ocScore}</p>
                      {Number.isInteger(s.openCriticRecommend) ? (
                        <p className="mt-1 text-xs text-zinc-400">{s.openCriticRecommend}% recomiendan</p>
                      ) : null}
                      {s.openCriticTier ? (
                        <p className="mt-0.5 text-xs text-amber-300/90">{s.openCriticTier}</p>
                      ) : null}
                      {Number.isInteger(s.openCriticNumReviews) ? (
                        <p className="mt-0.5 text-[10px] text-zinc-500">{s.openCriticNumReviews} críticas top</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">Sin nota</p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">IGDB</p>
                  {igdb != null ? (
                    <p className="mt-2 text-3xl font-black text-zinc-100">{igdb}</p>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">Sin nota</p>
                  )}
                </div>
                {juego.calificacion ? (
                  <div className="col-span-2 border-t border-zinc-800 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Tu nota</p>
                    <p className="mt-1 text-2xl font-black text-amber-300">{juego.calificacion}/5</p>
                  </div>
                ) : null}
              </div>

              {hayOfertasPc ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-400/5 p-6 shadow-[0_0_24px_rgba(251,191,36,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Lowest Historical Price</p>
                  <p className="mt-3 text-3xl font-black text-white">{precioHistorico || '—'}</p>
                  {precioActual ? (
                    <p className="mt-2 text-center text-xs text-zinc-400">
                      Ahora desde <span className="font-semibold text-amber-300">{precioActual}</span>
                      <span className="text-zinc-500"> ({moneda})</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-center text-xs text-zinc-500">Sin histórico</p>
                  )}
                  {Array.isArray(precios?.deals) && precios.deals.length > 0 ? (
                    <ul className="mt-3 w-full space-y-1.5 border-t border-zinc-800 pt-3 text-left text-[11px] text-zinc-400">
                      {precios.deals.slice(0, 6).map((d) => (
                        <li key={`${d.storeID}-${d.dealID || d.price}`} className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-zinc-300">{d.tienda || `Tienda ${d.storeID}`}</span>
                          <span className="shrink-0">
                            <span className="font-semibold text-zinc-100">
                              {fmtMoneda(d.price)}
                            </span>
                            {d.savings > 0 ? (
                              <span className="ml-1 text-emerald-400">−{d.savings}%</span>
                            ) : null}
                            {d.url ? (
                              <a
                                href={d.url}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-2 text-amber-400 hover:underline"
                              >
                                ver
                              </a>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>

            {hayOfertasPc ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-200">Ofertas en PC</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { key: 'steam', label: 'Steam', etiqueta: 'Steam' },
                    { key: 'epic', label: 'Epic', etiqueta: 'Epic Games' },
                    { key: 'gog', label: 'GOG.com', etiqueta: 'GOG' },
                  ].map((tienda) => {
                    const urlEnlace = enlaces[tienda.key] || null;
                    const deal = precioPorTienda(tienda.key);
                    const url = deal?.url || urlEnlace;
                    const precioTxt = deal?.label || null;
                    const row = (
                      <>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
                          <IconoPlataforma etiqueta={tienda.etiqueta} size={18} className="w-[18px] h-[18px]" />
                          {tienda.label}
                        </span>
                        <span className={`text-sm font-bold ${precioTxt || url ? 'text-amber-300' : 'text-zinc-500'}`}>
                          {precioTxt || (url ? 'Ir →' : '—')}
                        </span>
                      </>
                    );
                    const clase = 'flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3.5';
                    return url ? (
                      <a key={tienda.key} href={url} target="_blank" rel="noreferrer" className={`${clase} hover:border-zinc-600`}>
                        {row}
                      </a>
                    ) : (
                      <div key={tienda.key} className={clase}>
                        {row}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {hayTiendasConsola ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-200">Otras tiendas oficiales</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tiendasConsola.map((t) => {
                    const precioTxt = fmtPrecioTienda(t);
                    return (
                      <a
                        key={`${t.tienda}-${t.url}`}
                        href={t.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3.5 hover:border-zinc-600"
                      >
                        <span className="min-w-0">
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
                            <IconoPlataforma etiqueta={t.tienda} size={18} className="w-[18px] h-[18px]" />
                            {t.tienda}
                          </span>
                          {t.plataforma ? (
                            <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{t.plataforma}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-amber-300">
                          {precioTxt || 'Ver precio oficial'}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {sinMercado ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-5 text-center text-sm text-zinc-400">
                {parecePc
                  ? 'Aún no listado en tiendas rastreadas o no hay ofertas actuales.'
                  : 'Sin información de precios automáticos para consolas. Revisa la tienda oficial de tu plataforma.'}
              </div>
            ) : null}

            <p className="text-xs text-zinc-500">
              Precios PC vía CheapShark (USD → {moneda}). Tiendas oficiales (PS / Epic / Android) cuando hay match.
              Xbox y Nintendo eShop aún sin API pública. Críticas cacheadas; precios en vivo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
