/**
 * Steam Store (público, sin key).
 * Una sola llamada appdetails cubre modos, manual, shots, tráiler HLS,
 * banner (library_hero), tags, metacritic, precio y fechas.
 */
import { elegirPorTituloEstricto } from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const UA = 'GameTracker/1.0 (catalogo local de videojuegos)';
const cache = crearTtlCache({ max: 200 });
const TTL_MS = 12 * 60 * 60 * 1000;

const CATEGORIAS = [
  [2, 'Un jugador'],
  [37, 'Multijugador local'],
  [39, 'Cooperativo local'],
  [24, 'Pantalla compartida'],
  [36, 'Multijugador en línea'],
  [38, 'Cooperativo en línea'],
  [1, 'Multijugador'],
  [9, 'Cooperativo'],
  [20, 'Multijugador masivo en línea'],
];

const ONLINE = new Set([36, 38, 20]);

const CDN = {
  hero: (id) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_hero.jpg`,
  heroAlt: (id) => `https://steamcdn-a.akamaihd.net/steam/apps/${id}/library_hero.jpg`,
  header: (id) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`,
};

/** App id de Steam a partir del id de ficha o de un enlace de tienda. */
export function steamAppIdDe(ficha) {
  const id = String(ficha?.id || ficha?.steamAppId || '');
  if (id.startsWith('steam:')) return id.slice(6);
  if (/^\d+$/.test(String(ficha?.steamAppId || ''))) return String(ficha.steamAppId);
  let enlaces = ficha?.enlacesTienda;
  if (typeof enlaces === 'string') {
    try {
      enlaces = JSON.parse(enlaces);
    } catch {
      enlaces = null;
    }
  }
  const url = String(enlaces?.steam || '');
  const match = url.match(/\/app\/(\d+)/);
  return match ? match[1] : '';
}

export function manualUrlDeSteam(juego) {
  if (!juego || typeof juego !== 'object') return null;
  const blob = JSON.stringify(juego);
  const match = blob.match(/https?:\\?\/\\?\/[^\s"'<>]+\.pdf/gi);
  if (match?.[0]) {
    return match[0]
      .replace(/\\\//g, '/')
      .replace(/\\u0026/gi, '&')
      .replace(/&amp;/gi, '&');
  }
  const soporte = juego.support_info?.url;
  if (soporte && /\.pdf($|\?)/i.test(soporte)) return String(soporte);
  return null;
}

async function urlViva(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000), redirect: 'follow' });
    if (!r.ok) return false;
    const tipo = String(r.headers.get('content-type') || '');
    return !tipo || /^image\//i.test(tipo);
  } catch {
    return false;
  }
}

async function resolverAppId(titulo, appId) {
  let id = String(appId || '').trim();
  if (/^\d+$/.test(id)) return id;
  const q = String(titulo || '').trim();
  if (!q) return '';
  const search = await fetch(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=US`,
    { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) },
  );
  if (!search.ok) return '';
  const data = await search.json();
  const items = (data.items || []).filter((e) => e.type === 'app' || e.type == null);
  const hit = elegirPorTituloEstricto(items, q, (g) => g.name);
  return hit?.id != null ? String(hit.id) : '';
}

function mapearJuegoSteam(juego, id) {
  const ids = new Set((juego.categories || []).map((c) => Number(c.id)).filter((n) => Number.isInteger(n)));
  const vistos = new Set();
  const partes = [];
  for (const [cat, etiqueta] of CATEGORIAS) {
    if (!ids.has(cat) || vistos.has(etiqueta)) continue;
    if (cat === 1 && (ids.has(36) || ids.has(37))) continue;
    if (cat === 9 && (ids.has(38) || ids.has(39))) continue;
    vistos.add(etiqueta);
    partes.push(etiqueta);
  }
  const online = [...ONLINE].some((cat) => ids.has(cat));

  const screenshots = (juego.screenshots || [])
    .map((s) => s.path_full)
    .filter(Boolean)
    .slice(0, 12);
  const movies = Array.isArray(juego.movies) ? juego.movies : [];
  const trailer = movies.find((m) => m.highlight)
    || movies.find((m) => /trailer/i.test(m.name || ''))
    || null;

  const tags = (juego.genres || [])
    .map((g) => g.description)
    .filter(Boolean)
    .slice(0, 8);

  const price = juego.price_overview;
  const metacritic = Number.isInteger(juego.metacritic?.score) ? juego.metacritic.score : null;

  let ano = null;
  const fecha = String(juego.release_date?.date || '');
  const mAno = fecha.match(/\b(19|20)\d{2}\b/);
  if (mAno) ano = Number(mAno[0]);

  return {
    steamAppId: String(id),
    jugadores: partes.length ? partes.join(' · ') : null,
    requiereInternet: online ? true : null,
    manualUrl: manualUrlDeSteam(juego),
    screenshots,
    trailerHls: trailer?.hls_h264 ? String(trailer.hls_h264) : null,
    tags,
    metacritic,
    anoLanzamiento: ano,
    desarrollador: (juego.developers || []).slice(0, 3).join(', ') || null,
    editor: (juego.publishers || []).slice(0, 3).join(', ') || null,
    shortDescription: String(juego.short_description || '').trim() || null,
    website: juego.website ? String(juego.website) : null,
    steamPrice: price && Number.isFinite(Number(price.final))
      ? {
        final: Number(price.final) / 100,
        initial: Number(price.initial) / 100,
        discountPercent: Number(price.discount_percent) || 0,
        currency: String(price.currency || 'USD'),
      }
      : null,
    achievementsTotal: Number.isInteger(juego.achievements?.total) ? juego.achievements.total : null,
  };
}

/**
 * Pack completo Steam (1 request). Preferir esto en Santuario.
 */
export async function fetchSteamPack(nombre, appId) {
  const titulo = String(nombre || '').trim();
  const cacheKey = `steam-pack:${appId || ''}:${titulo.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;

  try {
    const id = await resolverAppId(titulo, appId);
    if (!/^\d+$/.test(id)) {
      cache.set(cacheKey, null, TTL_MS);
      return null;
    }

    const respuesta = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${id}&l=english`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) },
    );
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    const juego = datos?.[id]?.data;
    if (!juego || juego.type === 'dlc') {
      cache.set(cacheKey, null, TTL_MS);
      return null;
    }
    if (titulo && juego.name && !elegirPorTituloEstricto([juego], titulo, (g) => g.name)) {
      cache.set(cacheKey, null, TTL_MS);
      return null;
    }

    const base = mapearJuegoSteam(juego, id);
    let bannerUrl = null;
    for (const build of [CDN.hero, CDN.heroAlt]) {
      const url = build(id);
      if (await urlViva(url)) {
        bannerUrl = url;
        break;
      }
    }
    if (!bannerUrl) {
      const h = CDN.header(id);
      if (await urlViva(h)) bannerUrl = h;
    }

    const out = { ...base, bannerUrl };
    cache.set(cacheKey, out, TTL_MS);
    return out;
  } catch {
    return null;
  }
}

/** Compat: solo modos / internet / manual. */
export async function metaSteam(appId) {
  const pack = await fetchSteamPack('', appId);
  if (!pack) return null;
  return {
    jugadores: pack.jugadores,
    requiereInternet: pack.requiereInternet,
    manualUrl: pack.manualUrl,
  };
}

export const fetchSteamDetails = metaSteam;

/** Compat: capturas + HLS. */
export async function fetchSteamMedia(nombre, appId) {
  const pack = await fetchSteamPack(nombre, appId);
  if (!pack) return null;
  if (!pack.screenshots?.length && !pack.trailerHls) return null;
  return {
    screenshots: pack.screenshots || [],
    trailerHls: pack.trailerHls || null,
    steamAppId: pack.steamAppId,
    bannerUrl: pack.bannerUrl || null,
  };
}
