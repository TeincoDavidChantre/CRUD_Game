import { prisma } from './prisma.js';
import {
  detectarFamiliasPlataforma,
  fetchCheapShark,
  fetchHowLongToBeat,
  fetchInternetArchiveDocs,
  fetchWikiPreservacion,
  fetchPreservacionSitios,
  fetchForosPreservacion,
  fetchMapasExternos,
  fetchOpenCritic,
  fetchSteamPack,
  fetchSteamGridLogo,
  fetchTiendasConsola,
  fetchYoutubeTrailer,
  metaIgdb,
  steamAppIdDe,
} from './fetchers/index.js';
import { elegirPorTituloEstricto } from './tituloMatch.js';
import { prepararTaxonomiaParaPrisma } from '../utils/taxonomyMapper.js';
import { sanitizarSinopsis } from '../utils/synopsisFetcher.js';

/**
 * Prioridad de convivencia (primera no vacía gana; no se pisa lo bueno):
 * - portada: usuario > catálogo > IGDB cover (nunca RAWG background)
 * - banner: Steam library_hero > catálogo > RAWG background
 * - shots: Steam > RAWG
 * - tráiler YT: IGDB > YouTube key
 * - stream: Steam HLS
 * - manual: Steam PDF > Archive PDF > Archive details
 * - dev/editor: IGDB > Steam > RAWG > existente
 * - metacritic: existente > Steam > RAWG
 * - HLTB / OpenCritic: solo su fuente
 */

function valor(settled) {
  return settled.status === 'fulfilled' ? settled.value : null;
}

function parseJson(texto, fallback) {
  try {
    const v = JSON.parse(texto || '');
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

/** Forma estable del bloque Santuario (nunca undefined). */
export function santuarioVacio() {
  return {
    logoUrl: null,
    bannerUrl: null,
    hltbMain: null,
    hltbMainExtra: null,
    hltbCompletionist: null,
    hltbCoop: null,
    hltbMultiplayer: null,
    manualUrl: null,
    archiveIdentifier: null,
    preservacionDocs: [],
    openCriticScore: null,
    openCriticRecommend: null,
    openCriticTier: null,
    openCriticNumReviews: null,
    trailerYoutubeId: null,
    trailerStreamUrl: null,
    screenshots: [],
    editor: '',
    desarrollador: '',
    igdbRating: null,
    igdbRatingCount: null,
    jugadores: null,
    requiereInternet: null,
    anoLanzamiento: null,
    enlacesTienda: {},
    precios: null,
    mercado: { ofertasPC: null, tiendasConsola: [] },
    metacritic: null,
    criticScore: null,
    criticFuente: null,
    steamTags: [],
    santuarioEnriquecido: false,
    enriquecidoEn: null,
  };
}

function desdeCatalogo(catalogo) {
  const base = santuarioVacio();
  if (!catalogo) return base;
  const shots = parseJson(catalogo.screenshotsJson, []);
  const specs = parseJson(catalogo.specsJson, {});
  const specsObj = specs && typeof specs === 'object' && !Array.isArray(specs) ? specs : {};
  const trailerStreamUrl = specsObj.trailerHls || null;
  const igdbRatingCount = Number.isInteger(Number(specsObj.igdbRatingCount))
    ? Number(specsObj.igdbRatingCount)
    : null;
  const steamTags = Array.isArray(specsObj.steamTags) ? specsObj.steamTags.filter(Boolean) : [];
  const preservacionDocs = Array.isArray(specsObj.preservacionDocs)
    ? specsObj.preservacionDocs.filter((d) => d && d.url)
    : [];
  return {
    ...base,
    logoUrl: catalogo.logoUrl || null,
    bannerUrl: catalogo.bannerUrl || null,
    hltbMain: catalogo.hltbMain ?? null,
    hltbMainExtra: specsObj.hltbMainExtra ?? null,
    hltbCompletionist: catalogo.hltbCompletionist ?? null,
    hltbCoop: specsObj.hltbCoop ?? null,
    hltbMultiplayer: specsObj.hltbMultiplayer ?? null,
    manualUrl: catalogo.manualUrl || null,
    archiveIdentifier: catalogo.archiveIdentifier || null,
    preservacionDocs,
    openCriticScore: catalogo.openCriticScore ?? null,
    openCriticRecommend: catalogo.openCriticRecommend ?? null,
    openCriticTier: catalogo.openCriticTier || null,
    openCriticNumReviews: specsObj.openCriticNumReviews ?? null,
    trailerYoutubeId: catalogo.trailerYoutubeId || null,
    trailerStreamUrl: trailerStreamUrl || null,
    screenshots: Array.isArray(shots) ? shots.filter(Boolean) : [],
    editor: catalogo.editor || '',
    desarrollador: catalogo.desarrollador || '',
    igdbRating: catalogo.igdbRating ?? null,
    igdbRatingCount,
    jugadores: catalogo.jugadores || null,
    requiereInternet: catalogo.requiereInternet === true ? true : null,
    anoLanzamiento: catalogo.anoLanzamiento ?? null,
    enlacesTienda: parseJson(catalogo.enlacesTienda, {}) || {},
    steamTags,
    santuarioEnriquecido: Boolean(catalogo.santuarioEnriquecido),
    enriquecidoEn: catalogo.enriquecidoEn || null,
  };
}

/** Manual: PDF gana sobre página details. */
function elegirManualUrl(...candidatos) {
  const urls = candidatos.filter((u) => typeof u === 'string' && u.trim());
  const pdf = urls.find((u) => /\.pdf($|\?)/i.test(u));
  return pdf || urls[0] || null;
}

const CAPAS_PRESERVACION = 7;

function normalizarUrlDoc(url) {
  try {
    const u = new URL(String(url || ''));
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) {
      if (/^utm_|fbclid|^ref$/i.test(k)) u.searchParams.delete(k);
    }
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return String(url || '').trim();
  }
}

function urlMapaRota(url) {
  return /hollowknightmap\.com|skyrimmaps\.com/i.test(String(url || ''));
}

function esEnlaceExtra(d) {
  return /gamefaqs|reddit|steam community|wikidata|igdb|wikipedia/i.test(String(d?.fuente || ''))
    || d?.tipo === 'oficial';
}

function puntajeDoc(d) {
  const f = String(d?.fuente || '');
  let p = 10;
  if (/internet archive|archive\.org/i.test(f)) p = 80;
  else if (/^steam$/i.test(f)) p = 70;
  else if (/fandom|strategywiki|fextralife|zeldadungeon|curado|hollowknight|witcher3map|stardew|skyrimmaps|minecraft wiki/i.test(f)) p = 60;
  else if (/igdb|wikidata/i.test(f)) p = 50;
  else if (/mapgenie/i.test(f)) p = 62;
  else if (/wikimedia|commons/i.test(f)) p = 74;
  else if (/vgmaps/i.test(f)) p = 70;
  else if (/wikipedia/i.test(f)) p = 35;
  else if (/ign maps/i.test(f)) p = 30;
  else if (/gamefaqs/i.test(f)) p = 25;
  else if (/steam community/i.test(f)) p = 22;
  else if (/reddit/i.test(f)) p = 20;
  else if (/usuario/i.test(f)) p = 15;
  if (d?.esPdf || /\.pdf($|\?)/i.test(d?.url || '')) p += 30;
  else if (d?.tipo === 'mapa' && d?.esImagen) p += 50;
  else if (d?.esImagen) p += 8;
  return p;
}

/** Un ganador por tipo fijo. Extras (usuario, foros, oficiales extra) sin URL repetida. */
function construirPreservacionDocs({
  steamManualUrl,
  archivePack,
  wikiPack,
  sitiosPack,
  forosPack,
  mapasPack,
  usuarioDocs = [],
  previos = [],
} = {}) {
  const porTipo = new Map();
  const extras = [];
  const clave = (d) => normalizarUrlDoc(d?.url);

  const yaEsta = (url) => {
    const k = normalizarUrlDoc(url);
    if ([...porTipo.values()].some((d) => clave(d) === k)) return true;
    return extras.some((d) => clave(d) === k);
  };

  const meter = (d, { comoExtra = false } = {}) => {
    if (!d?.tipo || !d?.url || urlMapaRota(d.url)) return;
    const doc = { ...d, url: d.url.trim() };
    const extra = comoExtra || doc.fuente === 'Usuario' || doc.soloExtra;
    if (extra) {
      if (!yaEsta(doc.url)) extras.push(doc);
      return;
    }
    const actual = porTipo.get(doc.tipo);
    if (!actual) {
      porTipo.set(doc.tipo, doc);
      return;
    }
    if (clave(actual) === clave(doc)) {
      if (puntajeDoc(doc) > puntajeDoc(actual)) porTipo.set(doc.tipo, doc);
      return;
    }
    if (puntajeDoc(doc) > puntajeDoc(actual)) {
      if (esEnlaceExtra(actual) || actual.esEnlace) {
        if (!extras.some((x) => clave(x) === clave(actual))) extras.push(actual);
      }
      porTipo.set(doc.tipo, doc);
      return;
    }
    if (esEnlaceExtra(doc) || doc.esEnlace) {
      if (!yaEsta(doc.url)) extras.push(doc);
    }
  };

  for (const d of previos) meter(d);
  for (const d of (archivePack?.docs || [])) meter(d);
  if (steamManualUrl) {
    const preferSteamPdf = /\.pdf($|\?)/i.test(steamManualUrl);
    meter({
      id: 'manual:steam',
      tipo: 'manual',
      titulo: 'Manual de Instrucciones',
      tituloOrigen: 'Steam',
      url: steamManualUrl,
      fuente: 'Steam',
      esPdf: preferSteamPdf,
      esImagen: false,
      esEnlace: !preferSteamPdf,
    });
  }
  for (const d of (wikiPack?.docs || [])) meter(d);
  for (const d of (sitiosPack?.docs || [])) meter(d);
  for (const d of (forosPack?.docs || [])) meter(d);
  for (const d of (mapasPack?.docs || [])) meter(d);
  for (const d of usuarioDocs) {
    meter({ ...d, fuente: 'Usuario' }, { comoExtra: true });
  }

  const orden = ['manual', 'mapa', 'guia', 'wiki', 'oficial'];
  const base = orden.map((t) => porTipo.get(t)).filter(Boolean);
  const vistos = new Set(base.map((d) => clave(d)));
  const extrasUnicos = [];
  for (const e of extras) {
    const k = clave(e);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    extrasUnicos.push(e);
  }
  return [...base, ...extrasUnicos];
}

/** ¿La URL parece captura (no usar como portada/banner preferente)? */
function pareceCaptura(url) {
  return /\/screenshots?\//i.test(String(url || ''))
    || /rawg\.io\/media\/screenshots/i.test(String(url || ''));
}

/** Respuesta JSON completa y segura para GET /juegos/:id */
export function normalizarDetalleRespuesta(parcial = {}) {
  const s = { ...santuarioVacio(), ...(parcial.santuario || {}) };
  if (!Array.isArray(s.screenshots)) s.screenshots = [];
  if (!Array.isArray(s.preservacionDocs)) s.preservacionDocs = [];
  if (!s.enlacesTienda || typeof s.enlacesTienda !== 'object') s.enlacesTienda = {};
  if (!s.mercado || typeof s.mercado !== 'object') {
    s.mercado = { ofertasPC: s.precios || null, tiendasConsola: [] };
  } else {
    if (!Array.isArray(s.mercado.tiendasConsola)) s.mercado.tiendasConsola = [];
    if (s.mercado.ofertasPC === undefined) s.mercado.ofertasPC = s.precios || null;
  }
  // Compat: precios === ofertasPC
  if (s.precios == null && s.mercado.ofertasPC) s.precios = s.mercado.ofertasPC;

  return {
    id: parcial.id || null,
    idUsuario: parcial.idUsuario || null,
    idJuego: parcial.idJuego || null,
    tituloJuego: parcial.tituloJuego || '',
    urlPortada: parcial.urlPortada || null,
    descripcion: parcial.descripcion || '',
    plataformas: parcial.plataformas || '',
    sistemas: parcial.sistemas || '',
    generos: parcial.generos || '',
    tematicas: parcial.tematicas || '',
    metacritic: parcial.metacritic ?? s.metacritic ?? null,
    desarrollador: parcial.desarrollador || s.desarrollador || '',
    editor: parcial.editor || s.editor || '',
    etiquetas: parcial.etiquetas || '',
    comentario: parcial.comentario || '',
    preservacionUsuarioJson: parcial.preservacionUsuarioJson || '[]',
    calificacion: parcial.calificacion ?? null,
    estado: parcial.estado || 'PENDIENTE',
    creadoEn: parcial.creadoEn || null,
    actualizadoEn: parcial.actualizadoEn || null,
    anoLanzamiento: parcial.anoLanzamiento ?? s.anoLanzamiento ?? null,
    santuario: s,
  };
}

function coalescer(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    return v;
  }
  return null;
}

/** rawgId: externalId rawg:* o specsJson.rawgId */
function resolverRawgId(catalogo) {
  if (catalogo?.externalId?.startsWith('rawg:')) {
    const id = catalogo.externalId.slice(5);
    return /^\d+$/.test(id) ? id : null;
  }
  const specs = parseJson(catalogo?.specsJson, {});
  if (specs && typeof specs === 'object' && specs.rawgId && /^\d+$/.test(String(specs.rawgId))) {
    return String(specs.rawgId);
  }
  return null;
}

/** igdbId cacheado: externalId igdb:* o specsJson.igdbId (no pisa rawg:*). */
function resolverIgdbId(catalogo) {
  if (catalogo?.externalId?.startsWith('igdb:')) {
    const id = catalogo.externalId.slice(5);
    return /^\d+$/.test(id) ? id : null;
  }
  const specs = parseJson(catalogo?.specsJson, {});
  if (specs && typeof specs === 'object' && specs.igdbId && /^\d+$/.test(String(specs.igdbId))) {
    return String(specs.igdbId);
  }
  return null;
}

function mergeSpecsJson(actual, parcial = {}) {
  const base = parseJson(actual, {});
  const obj = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(parcial)) {
    if (v == null || v === '') continue;
    if (obj[k] == null || obj[k] === '') obj[k] = v;
  }
  return JSON.stringify(obj);
}

function textoVacio(...vals) {
  return vals.every((v) => !(String(v || '').trim()));
}

function credenciales(headers = {}) {
  const trim = (v) => {
    const s = v == null ? '' : String(v).trim();
    return s || null;
  };
  return {
    rawgKey: trim(headers['x-rawg-key'] || process.env.RAWG_API_KEY),
    igdbClientId: trim(
      headers['x-igdb-client-id']
      || process.env.TWITCH_CLIENT_ID
      || process.env.IGDB_CLIENT_ID,
    ),
    igdbClientSecret: trim(
      headers['x-igdb-client-secret']
      || process.env.TWITCH_CLIENT_SECRET
      || process.env.IGDB_CLIENT_SECRET,
    ),
    steamGridKey: trim(headers['x-steamgriddb-key'] || process.env.STEAMGRIDDB_API_KEY),
    openCriticKey: trim(headers['x-opencritic-key'] || process.env.OPENCRITIC_API_KEY),
    youtubeKey: trim(headers['x-youtube-key'] || process.env.YOUTUBE_API_KEY),
  };
}

async function rawgMultimedia(titulo, rawgKey, rawgId = null, opciones = {}) {
  if (!rawgKey) return null;
  if (!titulo && !rawgId) return null;
  const needShots = opciones.needShots !== false;
  try {
    let hit = null;

    // Preferir ID (1 request) — evita search y ahorra cuota
    if (rawgId && /^\d+$/.test(String(rawgId))) {
      const detalleId = await fetch(
        `https://api.rawg.io/api/games/${rawgId}?key=${encodeURIComponent(rawgKey)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (detalleId.ok) hit = await detalleId.json();
    }

    if (!hit && titulo) {
      const search = await fetch(
        `https://api.rawg.io/api/games?key=${encodeURIComponent(rawgKey)}&search=${encodeURIComponent(titulo)}&page_size=8`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!search.ok) {
        console.warn(`RAWG search HTTP ${search.status}`);
        return null;
      }
      const data = await search.json();
      hit = elegirPorTituloEstricto(data.results || [], titulo, (g) => g.name);
      if (!hit?.id) return null;

      const detalle = await fetch(
        `https://api.rawg.io/api/games/${hit.id}?key=${encodeURIComponent(rawgKey)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (detalle.ok) hit = await detalle.json();
    }

    if (!hit?.id) return null;
    if (titulo && hit.name && !elegirPorTituloEstricto([hit], titulo, (g) => g.name)) {
      return null;
    }

    let shots = (hit.short_screenshots || [])
      .map((s) => s.image)
      .filter(Boolean)
      .slice(0, 12);

    // Endpoint dedicado solo si hacen falta capturas (ahorra 1 request)
    if (needShots && shots.length === 0) {
      try {
        const shotsResp = await fetch(
          `https://api.rawg.io/api/games/${hit.id}/screenshots?key=${encodeURIComponent(rawgKey)}&page_size=12`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (shotsResp.ok) {
          const shotsData = await shotsResp.json();
          shots = (shotsData.results || []).map((r) => r.image).filter(Boolean).slice(0, 12);
        }
      } catch {
        // sin capturas
      }
    }

    return {
      rawgId: hit.id != null ? String(hit.id) : (rawgId ? String(rawgId) : null),
      bannerUrl: hit.background_image || null,
      screenshots: needShots ? shots : [],
      metacritic: Number.isInteger(hit.metacritic) ? hit.metacritic : null,
      desarrollador: (hit.developers || []).map((d) => d.name).filter(Boolean).join(', ') || null,
      editor: (hit.publishers || []).map((p) => p.name).filter(Boolean).join(', ') || null,
      released: hit.released || null,
    };
  } catch (err) {
    console.warn('RAWG multimedia:', err.message);
    return null;
  }
}

/**
 * Detecta qué falta en el catálogo cacheado para no reconsultar lo que ya está.
 */
function detectarHuecos(catalogo, juegoUsuario) {
  const shots = parseJson(catalogo?.screenshotsJson, []);
  const specs = parseJson(catalogo?.specsJson, {});
  const specsObj = specs && typeof specs === 'object' && !Array.isArray(specs) ? specs : {};
  const docsPrev = Array.isArray(specsObj.preservacionDocs) ? specsObj.preservacionDocs : [];
  // v2 = Archive + Wiki (StrategyWiki/Fandom). Fuerza relleno si solo hubo v1 (Archive).
  const preservacionBuscado = Number(specsObj.preservacionCapas) >= CAPAS_PRESERVACION;
  const tieneStream = Boolean(specsObj.trailerHls);
  const faltaShots = !Array.isArray(shots) || shots.length === 0;
  const faltaYoutube = !catalogo?.trailerYoutubeId;
  return {
    logo: !catalogo?.logoUrl,
    hltb: catalogo?.hltbMain == null && catalogo?.hltbCompletionist == null,
    openCritic: catalogo?.openCriticScore == null,
    manual: !catalogo?.manualUrl,
    archiveId: !catalogo?.archiveIdentifier,
    preservacion: !preservacionBuscado,
    // IGDB/YouTube: pedir aunque ya exista stream de Steam
    trailer: faltaYoutube,
    // Steam HLS solo si tampoco hay YouTube ni stream
    trailerSteam: faltaYoutube && !tieneStream,
    shots: faltaShots,
    banner: !catalogo?.bannerUrl,
    metacritic: catalogo?.metacritic == null && juegoUsuario?.metacritic == null,
    igdbRating: catalogo?.igdbRating == null,
    desarrollador: textoVacio(catalogo?.desarrollador, juegoUsuario?.desarrollador),
    editor: textoVacio(catalogo?.editor),
    jugadores: !catalogo?.jugadores,
    internet: catalogo?.requiereInternet == null,
    sinopsis: textoVacio(catalogo?.descripcion, juegoUsuario?.descripcion),
    ano: catalogo?.anoLanzamiento == null,
    taxonomia: textoVacio(catalogo?.generos, juegoUsuario?.generos)
      || textoVacio(catalogo?.tematicas, juegoUsuario?.tematicas),
    plataformas: textoVacio(juegoUsuario?.plataformas, catalogo?.plataformas)
      && textoVacio(juegoUsuario?.sistemas, catalogo?.sistemas),
    portada: !juegoUsuario?.urlPortada && !catalogo?.urlPortada,
  };
}

/**
 * Steam público: rellena shots / HLS / banner si faltan.
 * No pisa un tráiler de YouTube ya guardado.
 */
async function completarMediaSteam(destino, titulo, steamId) {
  const shots = parseJson(destino?.screenshotsJson, []);
  const specsRaw = parseJson(destino?.specsJson, {});
  const specs = specsRaw && typeof specsRaw === 'object' && !Array.isArray(specsRaw) ? specsRaw : {};
  const faltaShots = !Array.isArray(shots) || shots.length === 0;
  const faltaTrailer = !destino?.trailerYoutubeId && !specs.trailerHls;
  const faltaBanner = !destino?.bannerUrl;
  if (!faltaShots && !faltaTrailer && !faltaBanner) return destino;

  const pack = await fetchSteamPack(titulo, steamId).catch(() => null);
  if (!pack) return destino;

  if (faltaShots && pack.screenshots?.length) {
    destino.screenshotsJson = JSON.stringify(pack.screenshots);
  }
  if (faltaTrailer && pack.trailerHls) {
    destino.specsJson = mergeSpecsJson(destino.specsJson || JSON.stringify(specs), {
      trailerHls: pack.trailerHls,
      steamAppId: pack.steamAppId,
    });
  }
  if (faltaBanner && pack.bannerUrl && !pareceCaptura(pack.bannerUrl)) {
    destino.bannerUrl = pack.bannerUrl;
  }
  return destino;
}

/**
 * Con caché Santuario: solo pide a APIs externas lo que aún falta.
 */
async function rellenarSoloHuecos(catalogo, juegoUsuario, creds) {
  if (!catalogo?.id) return catalogo;

  const titulo = juegoUsuario.tituloJuego;
  const huecos = detectarHuecos(catalogo, juegoUsuario);
  const specsPrev = parseJson(catalogo.specsJson, {});
  const faltaHltbExtra = specsPrev?.hltbMainExtra == null && catalogo.hltbMain != null;

  const steamId = steamAppIdDe({
    steamAppId: specsPrev?.steamAppId || '',
    id: catalogo.externalId || '',
    enlacesTienda: catalogo.enlacesTienda || {},
  });
  const rawgId = resolverRawgId(catalogo);
  const igdbId = resolverIgdbId(catalogo);

  const needLogo = huecos.logo;
  const needHltb = huecos.hltb || faltaHltbExtra;
  const needArchive = huecos.manual || huecos.archiveId || huecos.preservacion;
  const needOc = huecos.openCritic;
  const needSteamPack = huecos.manual || huecos.jugadores || huecos.internet
    || huecos.shots || huecos.trailerSteam || huecos.banner || huecos.metacritic
    || huecos.desarrollador || huecos.editor || huecos.ano;
  const needIgdb =
    Boolean(creds.igdbClientId && creds.igdbClientSecret)
    && (huecos.trailer || huecos.igdbRating || huecos.desarrollador || huecos.editor
      || huecos.jugadores || huecos.internet || huecos.sinopsis || huecos.ano
      || huecos.taxonomia || huecos.plataformas || huecos.portada);

  if (!needLogo && !needHltb && !needArchive && !needOc && !needSteamPack && !needIgdb
    && !(huecos.banner && creds.rawgKey)
    && !(huecos.metacritic && creds.rawgKey)
    && !(huecos.shots && creds.rawgKey)
    && !(huecos.trailer && creds.youtubeKey)) {
    return catalogo;
  }

  const settled = await Promise.allSettled([
    needLogo
      ? fetchSteamGridLogo(titulo, { apiKey: creds.steamGridKey, steamAppId: steamId || undefined })
      : Promise.resolve(null),
    needHltb ? fetchHowLongToBeat(titulo) : Promise.resolve(null),
    needArchive ? fetchInternetArchiveDocs(titulo) : Promise.resolve(null),
    needArchive ? fetchWikiPreservacion(titulo) : Promise.resolve(null),
    needOc ? fetchOpenCritic(titulo, { apiKey: creds.openCriticKey }) : Promise.resolve(null),
    needSteamPack ? fetchSteamPack(titulo, steamId || undefined) : Promise.resolve(null),
    needIgdb
      ? metaIgdb(titulo, creds.igdbClientId, creds.igdbClientSecret, { igdbId })
      : Promise.resolve(null),
  ]);

  const [vLogo, vHltb, vArchive, vWiki, vOc, vSteam, vIgdb] = settled.map(valor);
  const patch = {};
  let specsPatch = {};

  if (huecos.logo && vLogo) patch.logoUrl = vLogo;

  if (needHltb && vHltb) {
    if (huecos.hltb && vHltb.hltbMain != null) patch.hltbMain = vHltb.hltbMain;
    if (huecos.hltb && vHltb.hltbCompletionist != null) patch.hltbCompletionist = vHltb.hltbCompletionist;
    if (vHltb.hltbMainExtra != null) specsPatch.hltbMainExtra = vHltb.hltbMainExtra;
    if (vHltb.hltbCoop != null) specsPatch.hltbCoop = vHltb.hltbCoop;
    if (vHltb.hltbMultiplayer != null) specsPatch.hltbMultiplayer = vHltb.hltbMultiplayer;
    if (vHltb.hltbId != null) specsPatch.hltbId = vHltb.hltbId;
  }

  if (huecos.openCritic && vOc) {
    if (vOc.openCriticScore != null) patch.openCriticScore = vOc.openCriticScore;
    if (vOc.openCriticRecommend != null) patch.openCriticRecommend = vOc.openCriticRecommend;
    if (vOc.openCriticTier) patch.openCriticTier = vOc.openCriticTier;
    if (vOc.openCriticNumReviews != null) specsPatch.openCriticNumReviews = vOc.openCriticNumReviews;
  }

  if (huecos.manual || huecos.preservacion || huecos.archiveId) {
    const docsPrevios = Array.isArray(specsPrev?.preservacionDocs) ? specsPrev.preservacionDocs : [];
    const appIdMapas = vSteam?.steamAppId || steamId || null;
    const [sitiosMerged, forosPack, mapasPack] = (huecos.manual || huecos.preservacion || huecos.archiveId)
      ? await Promise.all([
        fetchPreservacionSitios(titulo, {
          igdbWebsites: vIgdb?.websites || [],
          steamWebsite: vSteam?.website || null,
        }).catch(() => ({ docs: [] })),
        fetchForosPreservacion(titulo).catch(() => ({ docs: [] })),
        fetchMapasExternos(titulo, { steamAppId: appIdMapas }).catch(() => ({ docs: [] })),
      ])
      : [{ docs: [] }, { docs: [] }, { docs: [] }];
    const docs = construirPreservacionDocs({
      steamManualUrl: vSteam?.manualUrl || null,
      archivePack: vArchive,
      wikiPack: vWiki,
      sitiosPack: sitiosMerged,
      forosPack,
      mapasPack,
      previos: docsPrevios,
    });
    if (docs.length) specsPatch.preservacionDocs = docs;
    specsPatch.preservacionBuscado = true;
    specsPatch.preservacionCapas = CAPAS_PRESERVACION;
    const manual = elegirManualUrl(
      docs.find((d) => d.tipo === 'manual')?.url,
      vSteam?.manualUrl,
      vArchive?.manualUrl,
    );
    if (manual) patch.manualUrl = manual;
    const archId = vArchive?.archiveIdentifier
      || docs.find((d) => d.archiveIdentifier)?.archiveIdentifier;
    if (archId) patch.archiveIdentifier = archId;
  }

  if (huecos.jugadores) {
    const jug = coalescer(vSteam?.jugadores, vIgdb?.jugadores);
    if (jug) patch.jugadores = jug;
  }
  if (huecos.internet) {
    if (vSteam?.requiereInternet === true || vIgdb?.requiereInternet === true) {
      patch.requiereInternet = true;
    }
  }

  if (huecos.igdbRating && vIgdb?.igdbRating != null) patch.igdbRating = vIgdb.igdbRating;
  if (huecos.desarrollador) {
    const dev = coalescer(vIgdb?.desarrollador, vSteam?.desarrollador);
    if (dev) patch.desarrollador = dev;
  }
  if (huecos.editor) {
    const ed = coalescer(vIgdb?.editor, vSteam?.editor);
    if (ed) patch.editor = ed;
  }

  if (huecos.sinopsis) {
    const limpia = vIgdb?.summary
      ? sanitizarSinopsis(vIgdb.summary, { exigirContextoLudico: false })
      : null;
    const alt = vSteam?.shortDescription
      ? sanitizarSinopsis(vSteam.shortDescription, { exigirContextoLudico: false })
      : null;
    const texto = coalescer(limpia, alt);
    if (texto) patch.descripcion = texto;
  }
  if (huecos.ano) {
    const ano = coalescer(vIgdb?.anoLanzamiento, vSteam?.anoLanzamiento);
    if (ano != null) patch.anoLanzamiento = ano;
  }
  if (huecos.portada && vIgdb?.coverUrl) patch.urlPortada = vIgdb.coverUrl;
  if (huecos.plataformas && vIgdb?.plataformas?.length) {
    patch.plataformas = vIgdb.plataformas.join(', ');
  }
  if (huecos.taxonomia && (vIgdb?.generos?.length || vIgdb?.tematicas?.length)) {
    const merged = prepararTaxonomiaParaPrisma(
      [catalogo.generos, juegoUsuario.generos, ...(vIgdb.generos || [])],
      [catalogo.tematicas, juegoUsuario.tematicas, ...(vIgdb.tematicas || [])],
    );
    if (merged.generos) patch.generos = merged.generos;
    if (merged.tematicas) patch.tematicas = merged.tematicas;
  }

  if (vIgdb?.igdbId || vIgdb?.igdbRatingCount != null || vIgdb?.slug) {
    specsPatch = {
      ...specsPatch,
      igdbId: vIgdb.igdbId,
      igdbSlug: vIgdb.slug,
      igdbRatingCount: vIgdb.igdbRatingCount,
    };
  }
  if (vIgdb?.slug && !catalogo.slug) patch.slug = vIgdb.slug;

  if (huecos.trailer) {
    let trailer = vIgdb?.trailerYoutubeId || null;
    if (!trailer && creds.youtubeKey) {
      const yt = await fetchYoutubeTrailer(titulo, { apiKey: creds.youtubeKey }).catch(() => null);
      trailer = yt?.trailerYoutubeId || null;
    }
    if (trailer) patch.trailerYoutubeId = trailer;
  }

  // Steam pack: shots / HLS / banner / metacritic / tags (gratis)
  if (vSteam) {
    if (huecos.shots && vSteam.screenshots?.length) {
      patch.screenshotsJson = JSON.stringify(vSteam.screenshots);
    }
    if (huecos.trailerSteam && !patch.trailerYoutubeId && !catalogo.trailerYoutubeId && vSteam.trailerHls) {
      specsPatch.trailerHls = vSteam.trailerHls;
    }
    if (huecos.banner && vSteam.bannerUrl && !pareceCaptura(vSteam.bannerUrl)) {
      patch.bannerUrl = vSteam.bannerUrl;
    }
    if (huecos.metacritic && vSteam.metacritic != null) patch.metacritic = vSteam.metacritic;
    if (vSteam.steamAppId) specsPatch.steamAppId = vSteam.steamAppId;
    if (vSteam.tags?.length) specsPatch.steamTags = vSteam.tags;
    if (vSteam.steamPrice) specsPatch.steamPrice = vSteam.steamPrice;
    if (vSteam.achievementsTotal != null) specsPatch.steamAchievements = vSteam.achievementsTotal;
    if (vSteam.website) {
      const enlaces = parseJson(catalogo.enlacesTienda, {}) || {};
      if (!enlaces.official && !enlaces.steam) {
        patch.enlacesTienda = JSON.stringify({
          ...enlaces,
          steam: `https://store.steampowered.com/app/${vSteam.steamAppId}`,
          official: vSteam.website,
        });
      }
    }
  }

  const shotsTrasSteam = parseJson(patch.screenshotsJson || catalogo.screenshotsJson, []);
  const aunFaltaShots = huecos.shots && (!Array.isArray(shotsTrasSteam) || shotsTrasSteam.length === 0);
  const aunFaltaBanner = huecos.banner && !(patch.bannerUrl || catalogo.bannerUrl);
  const aunFaltaMetacritic = huecos.metacritic && patch.metacritic == null && catalogo.metacritic == null;
  if (creds.rawgKey && (aunFaltaShots || aunFaltaBanner || aunFaltaMetacritic)) {
    const vRawgExtra = await rawgMultimedia(titulo, creds.rawgKey, rawgId, {
      needShots: aunFaltaShots,
    }).catch(() => null);
    if (aunFaltaShots && vRawgExtra?.screenshots?.length) {
      patch.screenshotsJson = JSON.stringify(vRawgExtra.screenshots);
    }
    if (aunFaltaBanner && vRawgExtra?.bannerUrl && !pareceCaptura(vRawgExtra.bannerUrl)) {
      patch.bannerUrl = vRawgExtra.bannerUrl;
    } else if (aunFaltaBanner && vRawgExtra?.bannerUrl && !patch.bannerUrl) {
      // Último recurso: background RAWG aunque parezca amplia
      patch.bannerUrl = vRawgExtra.bannerUrl;
    }
    if (aunFaltaMetacritic && vRawgExtra?.metacritic != null) patch.metacritic = vRawgExtra.metacritic;
    if (huecos.desarrollador && !patch.desarrollador && vRawgExtra?.desarrollador) {
      patch.desarrollador = vRawgExtra.desarrollador;
    }
    if (huecos.editor && !patch.editor && vRawgExtra?.editor) {
      patch.editor = vRawgExtra.editor;
    }
    if (vRawgExtra?.rawgId) specsPatch.rawgId = vRawgExtra.rawgId;
  }

  if (Object.keys(specsPatch).length) {
    patch.specsJson = mergeSpecsJson(patch.specsJson || catalogo.specsJson, specsPatch);
  }

  if (!Object.keys(patch).length) return catalogo;

  try {
    return await prisma.juego.update({
      where: { id: catalogo.id },
      data: patch,
    });
  } catch (err) {
    console.warn('Santuario: no se pudo rellenar huecos:', err.message);
    return { ...catalogo, ...patch };
  }
}

/**
 * Orquesta el Santuario para un juego de biblioteca.
 * Promise.allSettled: un fallo no tumba el resto. Nulls honestos.
 */
export async function enriquecerSantuarioParaBiblioteca(juegoUsuario, headers = {}, { forzar = false } = {}) {
  const titulo = juegoUsuario.tituloJuego;
  const creds = credenciales(headers);

  let catalogo = null;
  if (juegoUsuario.idJuego) {
    catalogo = await prisma.juego.findUnique({ where: { id: juegoUsuario.idJuego } }).catch(() => null);
  }
  if (!catalogo) {
    catalogo = await prisma.juego
      .findFirst({ where: { titulo: { equals: titulo, mode: 'insensitive' } } })
      .catch(() => null);
  }

  const cacheOk = Boolean(catalogo?.santuarioEnriquecido) && !forzar;
  let ofertasPC = null;
  let tiendasConsola = [];

  const plataformasTexto = [
    juegoUsuario.plataformas,
    juegoUsuario.sistemas,
    catalogo?.plataformas,
    catalogo?.sistemas,
  ].filter(Boolean).join(' ');
  const familias = detectarFamiliasPlataforma(plataformasTexto);

  if (!cacheOk) {
    const steamId = steamAppIdDe({
      steamAppId: parseJson(catalogo?.specsJson, {})?.steamAppId || '',
      id: catalogo?.externalId || '',
      enlacesTienda: catalogo?.enlacesTienda || {},
    });

    const rawgId = resolverRawgId(catalogo);
    const igdbId = resolverIgdbId(catalogo);

    const shotsPrevios = parseJson(catalogo?.screenshotsJson, []);
    const faltaShotsInicial = !Array.isArray(shotsPrevios) || shotsPrevios.length === 0;
    const faltaBannerInicial = !catalogo?.bannerUrl;
    const faltaMetacriticInicial = catalogo?.metacritic == null && juegoUsuario?.metacritic == null;

    // Fase 1: gratis en paralelo + 1 IGDB. Sin RAWG/YouTube todavía.
    // CheapShark solo si hay PC en plataformas detectadas.
    const settled = await Promise.allSettled([
      fetchSteamGridLogo(titulo, { apiKey: creds.steamGridKey, steamAppId: steamId || undefined }),
      fetchHowLongToBeat(titulo),
      fetchInternetArchiveDocs(titulo),
      fetchWikiPreservacion(titulo),
      fetchOpenCritic(titulo, { apiKey: creds.openCriticKey }),
      familias.pc
        ? fetchCheapShark(titulo, plataformasTexto || 'pc')
        : Promise.resolve(null),
      fetchSteamPack(titulo, steamId || undefined),
      metaIgdb(titulo, creds.igdbClientId, creds.igdbClientSecret, { igdbId }),
      fetchTiendasConsola(titulo, plataformasTexto),
    ]);

    const [
      vLogo,
      vHltb,
      vArchive,
      vWiki,
      vOc,
      vCs,
      vSteam,
      vIgdb,
      vTiendas,
    ] = settled.map(valor);

    ofertasPC = vCs;
    tiendasConsola = Array.isArray(vTiendas) ? vTiendas.filter(Boolean) : [];

    const docsPrevios = Array.isArray(parseJson(catalogo?.specsJson, {})?.preservacionDocs)
      ? parseJson(catalogo?.specsJson, {}).preservacionDocs
      : [];

    const [vSitios, vForos, vMapas] = await Promise.all([
      fetchPreservacionSitios(titulo, {
        igdbWebsites: vIgdb?.websites || [],
        steamWebsite: vSteam?.website || null,
      }).catch(() => ({ docs: [] })),
      fetchForosPreservacion(titulo).catch(() => ({ docs: [] })),
      fetchMapasExternos(titulo, { steamAppId: vSteam?.steamAppId || steamId || null }).catch(() => ({ docs: [] })),
    ]);

    const screenshotsSteam = Array.isArray(vSteam?.screenshots) ? vSteam.screenshots : [];
    let screenshots = screenshotsSteam.length
      ? screenshotsSteam
      : (Array.isArray(shotsPrevios) ? shotsPrevios : []);

    let bannerUrl = coalescer(
      (!pareceCaptura(vSteam?.bannerUrl) && vSteam?.bannerUrl) || null,
      catalogo?.bannerUrl,
    ) || null;

    let metacritic = coalescer(
      catalogo?.metacritic,
      juegoUsuario.metacritic,
      vSteam?.metacritic,
    ) ?? null;

    const tax = prepararTaxonomiaParaPrisma(
      [juegoUsuario.generos, catalogo?.generos, vIgdb?.generos, vSteam?.tags],
      [juegoUsuario.tematicas, catalogo?.tematicas, vIgdb?.tematicas],
    );

    const sinopsisIgdb = vIgdb?.summary
      ? sanitizarSinopsis(vIgdb.summary, { exigirContextoLudico: false })
      : null;
    const sinopsisSteam = vSteam?.shortDescription
      ? sanitizarSinopsis(vSteam.shortDescription, { exigirContextoLudico: false })
      : null;

    const plataformasIgdb = Array.isArray(vIgdb?.plataformas) && vIgdb.plataformas.length
      ? vIgdb.plataformas.join(', ')
      : null;

    const enlacesBase = parseJson(catalogo?.enlacesTienda, {}) || {};
    if (vSteam?.steamAppId && !enlacesBase.steam) {
      enlacesBase.steam = `https://store.steampowered.com/app/${vSteam.steamAppId}`;
    }
    if (vSteam?.website && !enlacesBase.official) {
      enlacesBase.official = vSteam.website;
    }
    for (const t of tiendasConsola) {
      if (!t?.url) continue;
      const key = String(t.tienda || '').toLowerCase();
      if (key.includes('playstation') && !enlacesBase.playstation) enlacesBase.playstation = t.url;
      if (key.includes('epic') && !enlacesBase.epic) enlacesBase.epic = t.url;
      if (key.includes('google') && !enlacesBase.android) enlacesBase.android = t.url;
      if (key.includes('xbox') && !enlacesBase.xbox) enlacesBase.xbox = t.url;
      if (key.includes('nintendo') && !enlacesBase.nintendo) enlacesBase.nintendo = t.url;
    }

    const data = {
      titulo,
      slug: coalescer(catalogo?.slug, vIgdb?.slug) || null,
      descripcion:
        coalescer(catalogo?.descripcion, juegoUsuario.descripcion, sinopsisIgdb, sinopsisSteam, '') || '',
      urlPortada:
        coalescer(juegoUsuario.urlPortada, catalogo?.urlPortada, vIgdb?.coverUrl) || null,
      plataformas:
        coalescer(juegoUsuario.plataformas, catalogo?.plataformas, plataformasIgdb, '') || '',
      sistemas: coalescer(juegoUsuario.sistemas, catalogo?.sistemas, '') || '',
      generos: tax.generos,
      tematicas: tax.tematicas,
      metacritic,
      desarrollador:
        coalescer(
          vIgdb?.desarrollador,
          vSteam?.desarrollador,
          juegoUsuario.desarrollador,
          catalogo?.desarrollador,
          '',
        ) || '',
      editor: coalescer(vIgdb?.editor, vSteam?.editor, catalogo?.editor, '') || '',
      anoLanzamiento: coalescer(
        catalogo?.anoLanzamiento,
        vIgdb?.anoLanzamiento,
        vSteam?.anoLanzamiento,
      ) ?? null,
      enlacesTienda: JSON.stringify(enlacesBase),
      igdbRating: coalescer(vIgdb?.igdbRating, catalogo?.igdbRating) ?? null,
      jugadores: coalescer(vSteam?.jugadores, vIgdb?.jugadores, catalogo?.jugadores) || null,
      requiereInternet:
        vSteam?.requiereInternet === true || vIgdb?.requiereInternet === true
          ? true
          : catalogo?.requiereInternet === true
            ? true
            : null,
      logoUrl: coalescer(vLogo, catalogo?.logoUrl) || null,
      bannerUrl,
      hltbMain: coalescer(vHltb?.hltbMain, catalogo?.hltbMain) ?? null,
      hltbCompletionist: coalescer(vHltb?.hltbCompletionist, catalogo?.hltbCompletionist) ?? null,
      manualUrl: elegirManualUrl(vSteam?.manualUrl, vArchive?.manualUrl, catalogo?.manualUrl),
      archiveIdentifier: coalescer(vArchive?.archiveIdentifier, catalogo?.archiveIdentifier) || null,
      openCriticScore: coalescer(vOc?.openCriticScore, catalogo?.openCriticScore) ?? null,
      openCriticRecommend: coalescer(vOc?.openCriticRecommend, catalogo?.openCriticRecommend) ?? null,
      openCriticTier: coalescer(vOc?.openCriticTier, catalogo?.openCriticTier) || null,
      trailerYoutubeId:
        coalescer(vIgdb?.trailerYoutubeId, catalogo?.trailerYoutubeId) || null,
      screenshotsJson: JSON.stringify(screenshots),
      specsJson: mergeSpecsJson(catalogo?.specsJson, {
        igdbId: vIgdb?.igdbId,
        igdbSlug: vIgdb?.slug,
        igdbRatingCount: vIgdb?.igdbRatingCount,
        steamAppId: vSteam?.steamAppId,
        steamTags: vSteam?.tags,
        steamPrice: vSteam?.steamPrice,
        steamAchievements: vSteam?.achievementsTotal,
        trailerHls: vSteam?.trailerHls,
        hltbMainExtra: vHltb?.hltbMainExtra,
        hltbCoop: vHltb?.hltbCoop,
        hltbMultiplayer: vHltb?.hltbMultiplayer,
        hltbId: vHltb?.hltbId,
        openCriticNumReviews: vOc?.openCriticNumReviews,
        preservacionDocs: construirPreservacionDocs({
          steamManualUrl: vSteam?.manualUrl || null,
          archivePack: vArchive,
          wikiPack: vWiki,
          sitiosPack: vSitios,
          forosPack: vForos,
          mapasPack: vMapas,
          previos: docsPrevios,
        }),
        preservacionBuscado: true,
        preservacionCapas: CAPAS_PRESERVACION,
      }),
      metaEnriquecida: true,
      santuarioEnriquecido: true,
      enriquecidoEn: new Date(),
    };

    // Fase 2: RAWG solo huecos que Steam/IGDB no cubrieron
    screenshots = parseJson(data.screenshotsJson, []);
    const aunShots = faltaShotsInicial && (!Array.isArray(screenshots) || screenshots.length === 0);
    const aunBanner = faltaBannerInicial && !data.bannerUrl;
    const aunMeta = faltaMetacriticInicial && data.metacritic == null;
    if (creds.rawgKey && (aunShots || aunBanner || aunMeta)) {
      const vRawg = await rawgMultimedia(titulo, creds.rawgKey, rawgId, {
        needShots: aunShots,
      }).catch(() => null);
      if (aunShots && vRawg?.screenshots?.length) {
        data.screenshotsJson = JSON.stringify(vRawg.screenshots);
      }
      if (aunBanner && vRawg?.bannerUrl) data.bannerUrl = vRawg.bannerUrl;
      if (aunMeta && vRawg?.metacritic != null) data.metacritic = vRawg.metacritic;
      if (vRawg?.desarrollador && !data.desarrollador) data.desarrollador = vRawg.desarrollador;
      if (vRawg?.editor && !data.editor) data.editor = vRawg.editor;
      if (vRawg?.rawgId) {
        data.specsJson = mergeSpecsJson(data.specsJson, { rawgId: String(vRawg.rawgId) });
      }
    }

    // YouTube: última opción (omitido de ampliación; solo si hay key e IGDB no trajo)
    if (!data.trailerYoutubeId && creds.youtubeKey) {
      const yt = await fetchYoutubeTrailer(titulo, { apiKey: creds.youtubeKey }).catch(() => null);
      if (yt?.trailerYoutubeId) data.trailerYoutubeId = yt.trailerYoutubeId;
    }

    const externalId = catalogo?.externalId || `biblio:${juegoUsuario.id}`;

    try {
      catalogo = await prisma.juego.upsert({
        where: { externalId },
        update: data,
        create: { ...data, externalId },
      });

      if (juegoUsuario.idJuego !== catalogo.id) {
        await prisma.juegoUsuario.update({
          where: { id: juegoUsuario.id },
          data: { idJuego: catalogo.id },
        });
        juegoUsuario = { ...juegoUsuario, idJuego: catalogo.id };
      }
    } catch (err) {
      console.warn('Santuario: no se pudo cachear Juego:', err.message);
    }
  } else {
    // Caché ya marcada: solo rellenar lo que falte (precios / tiendas en vivo)
    const [preciosLive, tiendasLive, catActualizado] = await Promise.all([
      familias.pc
        ? fetchCheapShark(titulo, plataformasTexto || 'pc').catch(() => null)
        : Promise.resolve(null),
      fetchTiendasConsola(titulo, plataformasTexto).catch(() => []),
      rellenarSoloHuecos(catalogo, juegoUsuario, creds),
    ]);
    ofertasPC = preciosLive;
    tiendasConsola = Array.isArray(tiendasLive) ? tiendasLive.filter(Boolean) : [];
    catalogo = catActualizado || catalogo;
  }

  const mercado = {
    ofertasPC: ofertasPC || null,
    tiendasConsola: Array.isArray(tiendasConsola) ? tiendasConsola : [],
  };

  const notaMetacritic = coalescer(juegoUsuario.metacritic, catalogo?.metacritic) ?? null;
  const notaOpenCritic = Number.isInteger(Number(catalogo?.openCriticScore))
    && Number(catalogo.openCriticScore) > 0
    ? Number(catalogo.openCriticScore)
    : null;
  const criticScore = notaMetacritic ?? notaOpenCritic ?? null;
  const criticFuente = notaMetacritic != null
    ? 'Metacritic'
    : (notaOpenCritic != null ? 'OpenCritic' : null);

  const base = desdeCatalogo(catalogo);
  let usuarioDocs = [];
  try {
    const raw = juegoUsuario.preservacionUsuarioJson;
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
    usuarioDocs = Array.isArray(parsed) ? parsed.filter((d) => d?.url) : [];
  } catch {
    usuarioDocs = [];
  }
  const docsConUsuario = construirPreservacionDocs({
    previos: base.preservacionDocs || [],
    usuarioDocs,
  });
  const santuario = {
    ...base,
    preservacionDocs: docsConUsuario,
    precios: mercado.ofertasPC,
    mercado,
    metacritic: notaMetacritic,
    criticScore,
    criticFuente,
  };

  return normalizarDetalleRespuesta({
    ...juegoUsuario,
    descripcion: coalescer(juegoUsuario.descripcion, catalogo?.descripcion, '') || '',
    desarrollador: coalescer(juegoUsuario.desarrollador, catalogo?.desarrollador, '') || '',
    editor: coalescer(catalogo?.editor, '') || '',
    anoLanzamiento: catalogo?.anoLanzamiento ?? null,
    generos: coalescer(juegoUsuario.generos, catalogo?.generos, '') || '',
    tematicas: coalescer(juegoUsuario.tematicas, catalogo?.tematicas, '') || '',
    santuario,
  });
}
