/**
 * Logo transparente (PNG) para la ficha.
 *
 * 1) SteamGridDB (si hay STEAMGRIDDB_API_KEY / opciones.apiKey)
 * 2) Fallback sin key: logo oficial de Steam CDN (`…/apps/{appId}/logo.png`)
 *    tras resolver steamAppId (opción o storesearch + match estricto).
 */
import { elegirPorTituloEstricto } from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const UA = 'GameTracker/1.0 (catalogo local de videojuegos)';
const cache = crearTtlCache({ max: 250 });
const TTL_MS = 24 * 60 * 60 * 1000;

const CDN_LOGOS = [
  (id) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/logo.png`,
  (id) => `https://cdn.akamai.steamstatic.com/steam/apps/${id}/logo.png`,
  (id) => `https://steamcdn-a.akamaihd.net/steam/apps/${id}/logo.png`,
];

async function urlImagenViva(url) {
  try {
    const r = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    });
    if (!r.ok) return false;
    const tipo = String(r.headers.get('content-type') || '');
    if (tipo && !/^image\//i.test(tipo)) return false;
    const len = Number(r.headers.get('content-length') || 0);
    // Evitar 1×1 / placeholders vacíos
    if (len > 0 && len < 800) return false;
    return true;
  } catch {
    return false;
  }
}

async function resolverSteamAppId(titulo, steamAppId) {
  if (steamAppId && /^\d+$/.test(String(steamAppId))) return String(steamAppId);
  const q = String(titulo || '').trim();
  if (!q) return null;
  try {
    const search = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=US`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) },
    );
    if (!search.ok) return null;
    const data = await search.json();
    const items = (data.items || []).filter((e) => e.type === 'app' || e.type == null);
    const hit = elegirPorTituloEstricto(items, q, (g) => g.name);
    return hit?.id != null ? String(hit.id) : null;
  } catch {
    return null;
  }
}

async function logoSteamCdn(steamAppId) {
  const id = String(steamAppId || '').trim();
  if (!/^\d+$/.test(id)) return null;
  for (const build of CDN_LOGOS) {
    const url = build(id);
    if (await urlImagenViva(url)) return url;
  }
  return null;
}

async function viaSteamGridDb(titulo, apiKey, { gameIdDirecto, steamAppId }) {
  let gameId = gameIdDirecto && /^\d+$/.test(String(gameIdDirecto)) ? String(gameIdDirecto) : null;
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };

  if (!gameId && steamAppId && /^\d+$/.test(String(steamAppId))) {
    const porSteam = await fetch(
      `https://www.steamgriddb.com/api/v2/games/steam/${steamAppId}`,
      { headers, signal: AbortSignal.timeout(8000) },
    );
    if (porSteam.ok) {
      const data = await porSteam.json();
      const id = data?.data?.id;
      if (id != null) gameId = String(id);
    }
  }

  if (!gameId) {
    if (!titulo) return null;
    const busqueda = await fetch(
      `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(titulo)}`,
      { headers, signal: AbortSignal.timeout(8000) },
    );
    if (!busqueda.ok) return null;
    const data = await busqueda.json();
    const lista = Array.isArray(data?.data) ? data.data : [];
    const juego = elegirPorTituloEstricto(lista, titulo, (g) => g.name);
    gameId = juego?.id ? String(juego.id) : null;
  }
  if (!gameId) return null;

  const logos = await fetch(
    `https://www.steamgriddb.com/api/v2/logos/game/${gameId}?types=static&mimes=image/png`,
    { headers, signal: AbortSignal.timeout(8000) },
  );
  if (!logos.ok) return null;
  const logosData = await logos.json();
  const lista = Array.isArray(logosData?.data) ? logosData.data : [];
  const mejor = lista.find((l) => l?.url && !l?.nsfw) || null;
  return mejor?.url ? String(mejor.url) : null;
}

/**
 * @returns {Promise<string|null>} URL del logo PNG o null
 */
export async function fetchSteamGridLogo(nombre, opciones = {}) {
  const titulo = String(nombre || '').trim();
  const apiKey = String(opciones.apiKey || process.env.STEAMGRIDDB_API_KEY || '').trim();
  const gameIdDirecto = opciones.steamGridId || opciones.gameId || null;
  const steamAppIdOpt = opciones.steamAppId ? String(opciones.steamAppId) : null;
  if (!titulo && !gameIdDirecto && !steamAppIdOpt) return null;

  const cacheKey = `logo:${steamAppIdOpt || ''}:${titulo.toLowerCase()}:${apiKey ? 'k' : 'n'}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;

  try {
    let url = null;

    if (apiKey) {
      url = await viaSteamGridDb(titulo, apiKey, {
        gameIdDirecto,
        steamAppId: steamAppIdOpt,
      });
    }

    // Fallback / sin key: logo oficial Steam (transparente)
    if (!url) {
      const appId = await resolverSteamAppId(titulo, steamAppIdOpt);
      if (appId) url = await logoSteamCdn(appId);
    }

    cache.set(cacheKey, url || null, TTL_MS);
    return url || null;
  } catch {
    return null;
  }
}
