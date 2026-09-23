import { prisma } from './prisma.js';
import { buscarFichas, detalleFicha } from './fuentes.js';
import { resolverMejorPortada, esPortadaVerticalOptima, esCaptura } from './caratulas.js';
import { metaSteam, steamAppIdDe } from './fetchers/steamFetcher.js';
import { metaIgdb } from './fetchers/igdbFetcher.js';
import { mapearGeneroCanonico, prepararTaxonomiaParaPrisma } from '../utils/taxonomyMapper.js';
import {
  descripcionWikipediaEspanol,
  resolverSinopsis,
  sanitizarSinopsis,
} from '../utils/synopsisFetcher.js';
import { memoizarAsync } from './ttlCache.js';

const twitchTokens = new Map();

function tituloRelacionado(titulo, consulta) {
  const limpia = (texto) => String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const t = limpia(titulo);
  const base = limpia(consulta);
  if (!t || !base) return false;
  if (t === base) return true;
  if (!t.startsWith(`${base} `)) return false;
  const resto = t.slice(base.length + 1);
  if (/^(ii|iii|iv|v|\d+|silksong|nightreign|remastered|remake|definitive|goty|part \d+)\b/.test(resto)) return true;
  // Sagas largas ("the legend of zelda …"): permitir otras entregas
  return base.split(' ').length >= 3 && resto.split(' ').length <= 8 && !/hentai|puzzle 18|wallpaper|soundtrack|demo\b/.test(resto);
}

function conPortadaOficial(ficha) {
  const url = ficha.portada || ficha.urlPortada || '';
  return Boolean(url) && (ficha.portadaVertical || esPortadaVerticalOptima(url));
}

async function enriquecerConMejorPortada(juegos = []) {
  const enriquecidos = await Promise.all(
    juegos.map(async (juego) => {
      const actual = juego.urlPortada || juego.portada || '';
      if (esPortadaVerticalOptima(actual)) {
        return { ...juego, urlPortada: actual, portada: actual, portadaVertical: true };
      }
      try {
        const mejor = await resolverMejorPortada({
          titulo: juego.titulo,
          steamAppId: steamAppIdDe(juego) || undefined,
          tiendas: juego.enlacesTienda || {},
          urlActual: actual,
        });
        if (mejor && esPortadaVerticalOptima(mejor)) {
          return {
            ...juego,
            urlPortada: mejor,
            portada: mejor,
            portadaVertical: true,
            banner: esCaptura(actual) ? null : actual,
          };
        }
      } catch {
        // Sin carátula vertical mejor.
      }
      // No borrar la imagen de RAWG/IGDB: mejor mostrar ficha que dejar el inicio vacío
      if (actual && !esCaptura(actual) && esPortadaVerticalOptima(actual)) {
        return { ...juego, urlPortada: actual, portada: actual, portadaVertical: true };
      }
      if (actual && !esCaptura(actual)) {
        return { ...juego, urlPortada: actual, portada: actual, portadaVertical: false };
      }
      return { ...juego, urlPortada: null, portada: null, portadaVertical: false };
    }),
  );
  return enriquecidos.filter((juego) => juego.urlPortada && (esPortadaVerticalOptima(juego.urlPortada) || !esCaptura(juego.urlPortada)));
}

async function obtenerTokenTwitch(clientId, clientSecret) {
  const cacheKey = `${clientId}:${clientSecret}`;
  const enCache = twitchTokens.get(cacheKey);
  if (enCache && enCache.expira > Date.now()) {
    return enCache.token;
  }

  try {
    const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
    const resp = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    twitchTokens.set(cacheKey, {
      token: data.access_token,
      expira: Date.now() + (data.expires_in - 300) * 1000,
    });
    return data.access_token;
  } catch (error) {
    console.error('Error al autenticar con Twitch/IGDB:', error.message);
    return null;
  }
}

// Normalización de tiendas desde RAWG
function parsearTiendasRawg(stores) {
  const tiendas = {};
  if (!Array.isArray(stores)) return tiendas;
  for (const item of stores) {
    const store = item.store || {};
    const nombre = (store.name || '').toLowerCase();
    const url = item.url || '';
    if (!url) continue;

    if (nombre.includes('steam')) tiendas.steam = url;
    else if (nombre.includes('playstation')) tiendas.playstation = url;
    else if (nombre.includes('xbox')) tiendas.xbox = url;
    else if (nombre.includes('nintendo')) tiendas.nintendo = url;
    else if (nombre.includes('epic')) tiendas.epic = url;
    else if (nombre.includes('gog')) tiendas.gog = url;
  }
  return tiendas;
}

// Helper para extraer credenciales prioritarias (cabeceras del usuario > servidor)
function obtenerCredenciales(headers = {}) {
  const rawgKey = headers['x-rawg-key'] || process.env.RAWG_API_KEY || null;
  const igdbClientId =
    headers['x-igdb-client-id']
    || process.env.TWITCH_CLIENT_ID
    || process.env.IGDB_CLIENT_ID
    || null;
  const igdbClientSecret =
    headers['x-igdb-client-secret']
    || process.env.TWITCH_CLIENT_SECRET
    || process.env.IGDB_CLIENT_SECRET
    || null;
  return {
    rawgKey: rawgKey ? String(rawgKey).trim() : null,
    igdbClientId: igdbClientId ? String(igdbClientId).trim() : null,
    igdbClientSecret: igdbClientSecret ? String(igdbClientSecret).trim() : null,
  };
}

/** @deprecated Usa prepararTaxonomiaParaPrisma / mapearGeneroCanonico */
export function traducirGenero(genero) {
  return mapearGeneroCanonico(genero) || '';
}

function taxonomiaDesdeFicha(ficha) {
  const crudos = [
    ...(Array.isArray(ficha.generos) ? ficha.generos : String(ficha.generos || '').split(',')),
    ...(Array.isArray(ficha.tematicas) ? ficha.tematicas : String(ficha.tematicas || '').split(',')),
    ...(Array.isArray(ficha.tags) ? ficha.tags : []),
  ];
  return prepararTaxonomiaParaPrisma(crudos);
}

function fichaDesdeIgdb(g) {
  const portada = g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : null;
  const anio = g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null;
  const tax = prepararTaxonomiaParaPrisma((g.genres || []).map((gen) => gen.name));
  return {
    id: `igdb:${g.id}`,
    titulo: g.name,
    slug: g.slug,
    urlPortada: portada,
    descripcion: sanitizarSinopsis(g.summary || '', { exigirContextoLudico: false }),
    plataformas: (g.platforms || []).map((p) => p.name).join(', '),
    generos: tax.generos,
    tematicas: tax.tematicas,
    metacritic: g.total_rating ? Math.round(g.total_rating) : null,
    anoLanzamiento: anio,
    enlacesTienda: {},
    fuente: 'igdb',
  };
}

/** @deprecated Preferir fetchWikipediaVideojuego / resolverSinopsis desde synopsisFetcher. */
export { descripcionWikipediaEspanol };

// Mapear resultado de RAWG a formato unificado
function mapearJuegoRawg(game) {
  const anio = game.released ? new Date(game.released).getFullYear() : null;
  const plataformas = (game.platforms || []).map((p) => p.platform?.name).filter(Boolean);
  const tax = prepararTaxonomiaParaPrisma([
    ...(game.genres || []).map((g) => g.name),
    ...(game.tags || []).map((t) => t.name).slice(0, 12),
  ]);
  const desarrollador = (game.developers || []).map((d) => d.name).join(', ') || '';

  return {
    id: `rawg:${game.id}`,
    titulo: game.name,
    slug: game.slug,
    urlPortada: game.background_image || null,
    descripcion: sanitizarSinopsis(game.description_raw || game.description || '', { exigirContextoLudico: false }),
    plataformas: plataformas.join(', '),
    sistemas: plataformas.slice(0, 5).join(', '),
    generos: tax.generos,
    tematicas: tax.tematicas,
    metacritic: game.metacritic || null,
    desarrollador,
    anoLanzamiento: anio,
    enlacesTienda: parsearTiendasRawg(game.stores),
    fuente: 'rawg',
  };
}

// Guardar o actualizar juego en caché local PostgreSQL (tabla Juego)
export async function cachearJuegoEnBD(ficha) {
  if (!ficha || !ficha.id || !ficha.titulo) return ficha;
  try {
    const tax = taxonomiaDesdeFicha(ficha);
    const data = {
      externalId: ficha.id,
      slug: ficha.slug || null,
      titulo: ficha.titulo,
      descripcion: sanitizarSinopsis(ficha.descripcion || '', { exigirContextoLudico: false }),
      urlPortada: ficha.urlPortada || null,
      plataformas: Array.isArray(ficha.plataformas) ? ficha.plataformas.join(', ') : String(ficha.plataformas || ''),
      sistemas: Array.isArray(ficha.sistemas) ? ficha.sistemas.join(', ') : String(ficha.sistemas || ''),
      generos: tax.generos,
      tematicas: tax.tematicas,
      metacritic: ficha.metacritic ? Number(ficha.metacritic) : null,
      desarrollador: ficha.desarrollador || '',
      anoLanzamiento: ficha.anoLanzamiento ? Number(ficha.anoLanzamiento) : null,
      enlacesTienda: JSON.stringify(ficha.enlacesTienda || {}),
      igdbRating: Number.isInteger(Number(ficha.igdbRating)) ? Number(ficha.igdbRating) : null,
      jugadores: ficha.jugadores || null,
      requiereInternet: ficha.requiereInternet === true ? true : null,
      metaEnriquecida: Boolean(ficha.metaEnriquecida),
      editor: ficha.editor || undefined,
      logoUrl: ficha.logoUrl || undefined,
      bannerUrl: ficha.bannerUrl || undefined,
      hltbMain: ficha.hltbMain != null ? Number(ficha.hltbMain) : undefined,
      hltbCompletionist: ficha.hltbCompletionist != null ? Number(ficha.hltbCompletionist) : undefined,
      manualUrl: ficha.manualUrl || undefined,
      archiveIdentifier: ficha.archiveIdentifier || undefined,
      openCriticScore: Number.isInteger(Number(ficha.openCriticScore)) ? Number(ficha.openCriticScore) : undefined,
      openCriticRecommend: Number.isInteger(Number(ficha.openCriticRecommend)) ? Number(ficha.openCriticRecommend) : undefined,
      openCriticTier: ficha.openCriticTier || undefined,
      trailerYoutubeId: ficha.trailerYoutubeId || undefined,
      screenshotsJson: Array.isArray(ficha.screenshots)
        ? JSON.stringify(ficha.screenshots)
        : (ficha.screenshotsJson || undefined),
    };
    // Quitar undefined para no pisar caché Santuario con vacíos
    Object.keys(data).forEach((k) => {
      if (data[k] === undefined) delete data[k];
    });

    const guardado = await prisma.juego.upsert({
      where: { externalId: ficha.id },
      update: data,
      create: data,
    });

    return {
      ...ficha,
      generos: tax.generos,
      tematicas: tax.tematicas,
      dbId: guardado.id,
    };
  } catch (err) {
    console.error('Error al guardar en caché local:', err.message);
    return ficha;
  }
}

const TTL_TENDENCIAS_MS = 2 * 60 * 60 * 1000; // 2 h — compartido entre usuarios

async function obtenerTendenciasCatalogoSinCache(headers = {}) {
  const { rawgKey, igdbClientId, igdbClientSecret } = obtenerCredenciales(headers);

  // A) IGDB primero: covers verticales t_cover_big (mejor para el carrusel del inicio)
  if (igdbClientId && igdbClientSecret) {
    const token = await obtenerTokenTwitch(igdbClientId, igdbClientSecret);
    if (token) {
      try {
        const body = `
          fields name, slug, cover.url, summary, platforms.name, genres.name, total_rating, first_release_date, websites.url, websites.category;
          where total_rating_count > 50 & first_release_date > 1640995200 & cover != null;
          sort total_rating_count desc;
          limit 30;
        `;
        const resp = await fetch('https://api.igdb.com/v4/games', {
          method: 'POST',
          headers: {
            'Client-ID': igdbClientId,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const games = await resp.json();
          const lista = games.map(fichaDesdeIgdb).map((f) => ({
            ...f,
            portada: f.urlPortada,
            portadaVertical: Boolean(f.urlPortada),
          }));
          Promise.all(lista.map(cachearJuegoEnBD)).catch(() => {});
          if (lista.length) return lista;
        }
      } catch (e) {
        console.warn('Fallo al obtener tendencias de IGDB:', e.message);
      }
    }
  }

  // B) RAWG: populares recientes (fallback; 1 request, sin enriquecer covers una a una)
  if (rawgKey) {
    try {
      const hoy = new Date();
      const anioActual = hoy.getFullYear();
      const anioAnterior = anioActual - 1;
      const url = `https://api.rawg.io/api/games?key=${rawgKey}&dates=${anioAnterior}-01-01,${anioActual}-12-31&ordering=-added&page_size=30`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        const lista = (data.results || []).map(mapearJuegoRawg).map((f) => ({
          ...f,
          portada: f.urlPortada || f.portada,
          portadaVertical: Boolean(f.urlPortada || f.portada),
        }));
        Promise.all(lista.map(cachearJuegoEnBD)).catch(() => {});
        if (lista.length) return lista;
      }
    } catch (e) {
      console.warn('Fallo al obtener tendencias de RAWG:', e.message);
    }
  }

  // C) Sin claves: pocas búsquedas Steam en paralelo (rápido), no 18 en serie
  const banco = [
    'Elden Ring', 'Hades', 'Celeste', "Baldur's Gate 3", 'Stardew Valley', 'Hollow Knight',
    'Disco Elysium', 'Outer Wilds', 'Dead Cells', 'Balatro', 'Silksong', 'Persona 5',
  ];
  const offset = Math.floor(Date.now() / (1000 * 60 * 30)) % banco.length;
  const semillasTendencia = [...banco.slice(offset), ...banco.slice(0, offset)].slice(0, 6);
  const lotes = await Promise.all(
    semillasTendencia.map(async (q) => {
      try {
        return (await buscarFichas(q, 8, 'steam', { rapido: true }))
          .filter((f) => conPortadaOficial(f) && tituloRelacionado(f.titulo, q))
          .slice(0, 3);
      } catch {
        return [];
      }
    }),
  );
  const salida = [];
  const vistos = new Set();
  for (const ficha of lotes.flat()) {
    const clave = String(ficha.titulo || '').toLowerCase().trim();
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push({ ...ficha, urlPortada: ficha.portada, portadaVertical: true, fuente: 'catalogo' });
    if (salida.length >= 28) break;
  }
  if (salida.length < 20) {
    try {
      const extra = await buscarFichas('indie', 16, 'steam', { porEtiqueta: true, rapido: true });
      for (const ficha of extra) {
        if (!conPortadaOficial(ficha)) continue;
        const clave = String(ficha.titulo || '').toLowerCase().trim();
        if (!clave || vistos.has(clave)) continue;
        vistos.add(clave);
        salida.push({ ...ficha, urlPortada: ficha.portada, portadaVertical: true, fuente: 'catalogo' });
        if (salida.length >= 28) break;
      }
    } catch {
      // ok
    }
  }
  return salida;
}

// 1. OBTENER TENDENCIAS / JUEGOS MÁS POPULARES (caché global 2 h)
export const obtenerTendenciasCatalogo = memoizarAsync(obtenerTendenciasCatalogoSinCache, {
  ttlMs: TTL_TENDENCIAS_MS,
  keyFn: (headers = {}) => {
    const { rawgKey, igdbClientId } = obtenerCredenciales(headers);
    // Misma caché si hay IGDB; distinta si solo RAWG o sin keys
    if (igdbClientId) return 'tendencias:igdb';
    if (rawgKey) return 'tendencias:rawg';
    return 'tendencias:steam';
  },
});

// 2. BUSCAR JUEGOS
export async function buscarJuegosCatalogo(query, headers = {}, limite = 12) {
  const { rawgKey, igdbClientId, igdbClientSecret } = obtenerCredenciales(headers);
  const q = String(query || '').trim();

  // A) Búsqueda en RAWG
  if (rawgKey) {
    try {
      const url = `https://api.rawg.io/api/games?key=${rawgKey}&search=${encodeURIComponent(q)}&page_size=${limite}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        const listaCruda = (data.results || []).map(mapearJuegoRawg);
        const lista = await enriquecerConMejorPortada(listaCruda);
        Promise.all(lista.map(cachearJuegoEnBD)).catch(() => {});
        return lista;
      }
    } catch (e) {
      console.warn('Error en búsqueda RAWG, probando alternativa:', e.message);
    }
  }

  // B) Búsqueda en IGDB
  if (igdbClientId && igdbClientSecret) {
    const token = await obtenerTokenTwitch(igdbClientId, igdbClientSecret);
    if (token) {
      try {
        const body = `
          search "${q.replace(/"/g, '')}";
          fields name, slug, cover.url, summary, platforms.name, genres.name, total_rating, first_release_date;
          limit ${limite};
        `;
        const resp = await fetch('https://api.igdb.com/v4/games', {
          method: 'POST',
          headers: {
            'Client-ID': igdbClientId,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const games = await resp.json();
          const lista = games.map(fichaDesdeIgdb);
          Promise.all(lista.map(cachearJuegoEnBD)).catch(() => {});
          return lista;
        }
      } catch (e) {
        console.warn('Error en búsqueda IGDB, recurriendo a local:', e.message);
      }
    }
  }

  // C) Respaldo local en PostgreSQL
  const coincidentes = await prisma.juego.findMany({
    where: {
      titulo: { contains: q, mode: 'insensitive' },
    },
    take: limite,
  });

  if (coincidentes.length > 0) {
    return coincidentes.map((j) => ({
      id: j.externalId || j.id,
      titulo: j.titulo,
      slug: j.slug,
      urlPortada: j.urlPortada,
      descripcion: j.descripcion,
      plataformas: j.plataformas,
      sistemas: j.sistemas,
      generos: j.generos,
      tematicas: j.tematicas || '',
      metacritic: j.metacritic,
      desarrollador: j.desarrollador,
      anoLanzamiento: j.anoLanzamiento,
      enlacesTienda: JSON.parse(j.enlacesTienda || '{}'),
      fuente: 'db',
    }));
  }

  // D) Fallback a tiendas públicas tradicionales
  return buscarFichas(q, limite);
}

function unirMeta(steam, igdb) {
  const jugadores = steam?.jugadores || igdb?.jugadores || null;
  const requiereInternet = steam?.requiereInternet === true || igdb?.requiereInternet === true ? true : null;
  const igdbRating = Number.isInteger(igdb?.igdbRating) ? igdb.igdbRating : null;
  return { jugadores, requiereInternet, igdbRating, metaEnriquecida: true };
}

/** Steam (modos / internet) e IGDB (nota y modos de respaldo). Fallos silenciosos. */
async function enriquecerMeta(ficha, headers = {}) {
  if (!ficha) return ficha;
  if (ficha.metaEnriquecida) return ficha;
  const { igdbClientId, igdbClientSecret } = obtenerCredenciales(headers);
  const appId = steamAppIdDe(ficha);
  const hayIgdb = Boolean(igdbClientId && igdbClientSecret);
  const [steam, igdb] = await Promise.all([
    appId ? metaSteam(appId).catch(() => null) : Promise.resolve(null),
    hayIgdb ? metaIgdb(ficha.titulo, igdbClientId, igdbClientSecret).catch(() => null) : Promise.resolve(null),
  ]);
  if (!appId && !hayIgdb) return { ...ficha, metaEnriquecida: true };
  const fallo = (appId && !steam) || (hayIgdb && !igdb);
  const meta = unirMeta(steam, igdb);
  return { ...ficha, ...meta, metaEnriquecida: !fallo };
}

function fichaDesdeCache(enBD, urlPortada) {
  return {
    id: enBD.externalId,
    titulo: enBD.titulo,
    slug: enBD.slug,
    urlPortada,
    portada: urlPortada,
    descripcion: sanitizarSinopsis(enBD.descripcion || '', { exigirContextoLudico: false }),
    plataformas: enBD.plataformas ? enBD.plataformas.split(', ') : [],
    sistemas: enBD.sistemas ? enBD.sistemas.split(', ') : [],
    generos: enBD.generos ? enBD.generos.split(', ').filter(Boolean) : [],
    tematicas: enBD.tematicas ? enBD.tematicas.split(', ').filter(Boolean) : [],
    metacritic: enBD.metacritic,
    igdbRating: enBD.igdbRating ?? null,
    jugadores: enBD.jugadores || null,
    requiereInternet: enBD.requiereInternet === true ? true : null,
    metaEnriquecida: Boolean(enBD.metaEnriquecida),
    desarrollador: enBD.desarrollador,
    anoLanzamiento: enBD.anoLanzamiento,
    lanzamiento: enBD.anoLanzamiento ? `${enBD.anoLanzamiento}-01-01` : null,
    enlacesTienda: JSON.parse(enBD.enlacesTienda || '{}'),
    fuente: 'db',
  };
}

// 3. DETALLE DE JUEGO
export async function detalleJuegoCatalogo(idFuente, headers = {}) {
  const { rawgKey } = obtenerCredenciales(headers);

  // Si ya está cacheado en BD local, devolverlo
  const enBD = await prisma.juego.findFirst({
    where: { externalId: idFuente },
  });

  if (enBD && enBD.descripcion && enBD.enlacesTienda && enBD.enlacesTienda !== '{}') {
    let urlPortada = enBD.urlPortada;
    if (!esPortadaVerticalOptima(urlPortada)) {
      try {
        const tiendas = JSON.parse(enBD.enlacesTienda || '{}');
        const mejor = await resolverMejorPortada({
          titulo: enBD.titulo,
          tiendas,
          urlActual: urlPortada || '',
        });
        if (mejor && esPortadaVerticalOptima(mejor) && mejor !== urlPortada) {
          urlPortada = mejor;
          prisma.juego.update({ where: { id: enBD.id }, data: { urlPortada: mejor } }).catch(() => {});
        } else if (!esPortadaVerticalOptima(urlPortada)) {
          urlPortada = null;
          if (enBD.urlPortada) {
            prisma.juego.update({ where: { id: enBD.id }, data: { urlPortada: null } }).catch(() => {});
          }
        }
      } catch {
        // Fallback
      }
    }

    // Si la descripción cacheada es de otro medio (banda, película…), invalidarla
    const descActual = sanitizarSinopsis(enBD.descripcion || '', { exigirContextoLudico: false });
    if (enBD.descripcion && !descActual) {
      enBD.descripcion = '';
      prisma.juego.update({ where: { id: enBD.id }, data: { descripcion: '' } }).catch(() => {});
    } else if (descActual && descActual !== enBD.descripcion) {
      enBD.descripcion = descActual;
    }

    // Traducción ES solo si no hay texto de tienda válido y Wikipedia confirma videojuego
    if (!sanitizarSinopsis(enBD.descripcion || '', { exigirContextoLudico: false })) {
      try {
        const sinopsis = await resolverSinopsis({
          titulo: enBD.titulo,
          steamAppId: (() => {
            try {
              const t = JSON.parse(enBD.enlacesTienda || '{}');
              return t.steam?.match(/\/app\/(\d+)/)?.[1] || null;
            } catch {
              return null;
            }
          })(),
        });
        if (sinopsis.texto) {
          enBD.descripcion = sinopsis.texto;
          prisma.juego.update({ where: { id: enBD.id }, data: { descripcion: sinopsis.texto } }).catch(() => {});
        }
      } catch {
        // sin descripción
      }
    }

    const cacheada = fichaDesdeCache(enBD, urlPortada);
    const enriquecida = await enriquecerMeta(cacheada, headers);
    if (enriquecida.metaEnriquecida && !enBD.metaEnriquecida) {
      prisma.juego.update({
        where: { id: enBD.id },
        data: {
          igdbRating: enriquecida.igdbRating,
          jugadores: enriquecida.jugadores,
          requiereInternet: enriquecida.requiereInternet,
          metaEnriquecida: true,
        },
      }).catch(() => {});
    }
    return enriquecida;
  }

  // Si es ID de RAWG (ej: rawg:1234)
  if (idFuente.startsWith('rawg:') && rawgKey) {
    try {
      const rawgId = idFuente.replace('rawg:', '');
      const [resDetalle, resTiendas] = await Promise.all([
        fetch(`https://api.rawg.io/api/games/${rawgId}?key=${rawgKey}`, { signal: AbortSignal.timeout(8000) }),
        fetch(`https://api.rawg.io/api/games/${rawgId}/stores?key=${rawgKey}`, { signal: AbortSignal.timeout(8000) }),
      ]);

      if (resDetalle.ok) {
        const game = await resDetalle.json();
        const tiendasData = resTiendas.ok ? await resTiendas.json() : { results: [] };
        
        // Mapear URLs directas de tiendas
        const enlacesTienda = {};
        for (const t of tiendasData.results || []) {
          const storeId = t.store_id;
          const url = t.url;
          if (!url) continue;
          if (storeId === 1) enlacesTienda.steam = url;
          else if (storeId === 3) enlacesTienda.playstation = url;
          else if (storeId === 2) enlacesTienda.xbox = url;
          else if (storeId === 6) enlacesTienda.nintendo = url;
          else if (storeId === 11) enlacesTienda.epic = url;
          else if (storeId === 5) enlacesTienda.gog = url;
        }

        const steamAppId = enlacesTienda.steam?.match(/\/app\/(\d+)/)?.[1] || null;
        const rawgDesc = game.description_raw || game.description || '';

        const [mejorPortada, sinopsis] = await Promise.all([
          resolverMejorPortada({
            titulo: game.name,
            steamAppId,
            tiendas: enlacesTienda,
            urlActual: game.background_image || null,
          }),
          resolverSinopsis({
            titulo: game.name,
            steamAppId,
            rawg: rawgDesc,
          }),
        ]);

        const tax = prepararTaxonomiaParaPrisma([
          ...(game.genres || []).map((g) => g.name),
          ...(game.tags || []).map((t) => t.name).slice(0, 12),
        ]);

        const ficha = {
          id: idFuente,
          titulo: game.name,
          slug: game.slug,
          urlPortada: mejorPortada && esPortadaVerticalOptima(mejorPortada) ? mejorPortada : null,
          portada: mejorPortada && esPortadaVerticalOptima(mejorPortada) ? mejorPortada : null,
          banner: game.background_image || null,
          descripcion: sinopsis.texto || '',
          plataformas: (game.platforms || []).map((p) => p.platform?.name).filter(Boolean),
          sistemas: (game.parent_platforms || []).map((p) => p.platform?.name).filter(Boolean),
          generos: tax.generos,
          tematicas: tax.tematicas,
          metacritic: game.metacritic || null,
          desarrollador: (game.developers || []).map((d) => d.name).join(', ') || '',
          anoLanzamiento: game.released ? new Date(game.released).getFullYear() : null,
          lanzamiento: game.released || null,
          enlacesTienda,
          fuente: 'rawg',
          origenDescripcion: sinopsis.origen || '',
        };

        const conMeta = await enriquecerMeta(ficha, headers);
        await cachearJuegoEnBD(conMeta);
        return conMeta;
      }
    } catch (e) {
      console.warn('Error al obtener detalle de RAWG:', e.message);
    }
  }

  // Fallback a detalle tradicional
  const tradicional = await detalleFicha(idFuente);
  if (!tradicional) return null;
  const conMeta = await enriquecerMeta({
    ...tradicional,
    urlPortada: tradicional.urlPortada || tradicional.portada || null,
    enlacesTienda: tradicional.enlacesTienda || (tradicional.steamAppId
      ? { steam: `https://store.steampowered.com/app/${tradicional.steamAppId}` }
      : {}),
  }, headers);
  cachearJuegoEnBD(conMeta).catch(() => {});
  return conMeta;
}

// 4. OBTENER RECOMENDACIONES BASADAS EN GUSTOS
export async function obtenerRecomendacionesCatalogo(generosTop = [], titulosExcluidos = new Set(), headers = {}, limite = 12, semillas = []) {
  const { rawgKey } = obtenerCredenciales(headers);
  const generoSlug = (generosTop[0] || '').toLowerCase().replace(/\s+/g, '-');
  const genericos = new Set(['action', 'adventure', 'indie', 'casual', 'rpg', 'strategy', 'simulation', 'sports', 'racing', 'shooter', 'arcade', 'accion', 'aventura']);

  // A) RAWG solo con género concreto (no genéricos) y carátula oficial
  if (rawgKey && generoSlug && !genericos.has(generoSlug)) {
    try {
      const url = `https://api.rawg.io/api/games?key=${rawgKey}&genres=${encodeURIComponent(generoSlug)}&ordering=-added&page_size=${limite + 15}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        const listaCruda = (data.results || [])
          .filter((g) => (g.added > 30 || g.ratings_count > 10 || (g.metacritic && g.metacritic > 60)) && g.background_image)
          .map(mapearJuegoRawg)
          .filter((j) => !titulosExcluidos.has(j.titulo.toLowerCase().trim()))
          .slice(0, limite + 8);
        const lista = await enriquecerConMejorPortada(listaCruda);
        Promise.all(lista.map(cachearJuegoEnBD)).catch(() => {});
        if (lista.length > 0) return lista.slice(0, limite);
      }
    } catch (e) {
      console.warn('Error en recomendaciones RAWG:', e.message);
    }
  }

  // B) Semillas por título (misma lógica que el inicio: saga, no género)
  const consultas = (semillas.length ? semillas : []).slice(0, 3);
  if (consultas.length > 0) {
    const listas = await Promise.all(consultas.map(async (q) => {
      try {
        return (await buscarFichas(q, null, 'steam')).filter((f) => conPortadaOficial(f) && tituloRelacionado(f.titulo, q));
      } catch {
        return [];
      }
    }));
    const vistos = new Set();
    const salida = [];
    for (const ficha of listas.flat()) {
      const clave = String(ficha.titulo || '').toLowerCase().trim();
      if (!clave || vistos.has(clave) || titulosExcluidos.has(clave)) continue;
      vistos.add(clave);
      salida.push({
        ...ficha,
        urlPortada: ficha.portada,
        portadaVertical: true,
        fuente: 'catalogo',
      });
      if (salida.length >= limite) break;
    }
    if (salida.length > 0) return salida;
  }

  // C) Tendencias ya filtradas
  const fallback = await obtenerTendenciasCatalogo(headers);
  return fallback.filter((j) => !titulosExcluidos.has(String(j.titulo || '').toLowerCase().trim())).slice(0, limite);
}

