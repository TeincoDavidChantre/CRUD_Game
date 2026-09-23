/**
 * CheapShark: precios PC (actual, histórico, deals por tienda, freebies).
 * API pública, sin key. Feeds paginados para listar todas las ofertas.
 */
import { elegirPorTituloEstricto } from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const cache = crearTtlCache({ max: 200 });
const TTL_MS = 6 * 60 * 60 * 1000;
const TTL_FEED_MS = 2 * 60 * 1000;
const UA = { Accept: 'application/json', 'User-Agent': 'GameTracker/1.0' };

/** Máximo razonable por tienda (CheapShark ~60/página). */
const PAGE_SIZE = 60;
const MAX_PAGES = 15; // hasta ~900 deals/tienda
const MAX_ITEMS = 500;

export const TIENDAS_CLAVE = {
  steam: { storeID: '1', nombre: 'Steam', clave: 'steam' },
  epic: { storeID: '25', nombre: 'Epic Games', clave: 'epic' },
  gog: { storeID: '7', nombre: 'GOG', clave: 'gog' },
  humble: { storeID: '11', nombre: 'Humble', clave: 'humble' },
  fanatical: { storeID: '15', nombre: 'Fanatical', clave: 'fanatical' },
  greenmangaming: { storeID: '3', nombre: 'Green Man Gaming', clave: 'greenmangaming' },
};

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** URLs de carátula en orden de preferencia (vertical → fallbacks). */
export function portadasSteam(appId, thumb = '') {
  const id = String(appId || '').trim();
  const urls = [];
  if (id) {
    urls.push(
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_hero.jpg`,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/capsule_616x353.jpg`,
    );
  }
  if (thumb) urls.push(String(thumb));
  return [...new Set(urls.filter(Boolean))];
}

async function leerJson(url, timeout = 12000) {
  const respuesta = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeout) });
  if (!respuesta.ok) return null;
  return respuesta.json();
}

export async function fetchCheapSharkStores() {
  const cached = cache.get('cs:stores');
  if (cached !== undefined) return cached;
  try {
    const lista = await leerJson('https://www.cheapshark.com/api/1.0/stores');
    const mapa = {};
    if (Array.isArray(lista)) {
      for (const s of lista) {
        const id = String(s.storeID ?? '');
        if (!id) continue;
        mapa[id] = {
          storeID: id,
          nombre: String(s.storeName || `Tienda ${id}`),
          activo: Boolean(s.isActive),
        };
      }
    }
    for (const t of Object.values(TIENDAS_CLAVE)) {
      if (!mapa[t.storeID]) mapa[t.storeID] = { storeID: t.storeID, nombre: t.nombre, activo: true };
    }
    cache.set('cs:stores', mapa, 24 * 60 * 60 * 1000);
    return mapa;
  } catch {
    const mapa = {};
    for (const t of Object.values(TIENDAS_CLAVE)) {
      mapa[t.storeID] = { storeID: t.storeID, nombre: t.nombre, activo: true };
    }
    cache.set('cs:stores', mapa, TTL_FEED_MS);
    return mapa;
  }
}

function nombreTienda(storeID, storesMap) {
  const id = String(storeID ?? '');
  const desdeClave = Object.values(TIENDAS_CLAVE).find((t) => t.storeID === id)?.nombre;
  return storesMap?.[id]?.nombre || desdeClave || `Tienda ${id}`;
}

function esDlcOPack(titulo) {
  const t = String(titulo || '');
  if (/\bdlc\b/i.test(t)) return true;
  if (/[-:]\s*.*(pack|soundtrack|ost|cosmetic|season pass)/i.test(t)) return true;
  if (/\b(soundtrack|ost|weapon pack|cosmetic pack|season pass)\b/i.test(t) && !/\bgame\b/i.test(t)) return true;
  return false;
}

function urlRedirectCheapShark(dealID) {
  if (!dealID) return null;
  let raw = String(dealID);
  try {
    // Evitar doble-encode si la API ya mandó el id escapado
    if (/%[0-9A-Fa-f]{2}/.test(raw)) raw = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  return `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(raw)}`;
}

/** URL directa a la tienda; CheapShark solo como último recurso. */
function urlTiendaDeDeal(deal, storeID) {
  const steamAppId = deal.steamAppID ? String(deal.steamAppID) : '';
  const sid = String(storeID ?? deal.storeID ?? '');
  const titulo = String(deal.title || '').trim();
  if (steamAppId && (sid === '1' || !sid)) {
    return `https://store.steampowered.com/app/${steamAppId}`;
  }
  if (sid === '1' && steamAppId) {
    return `https://store.steampowered.com/app/${steamAppId}`;
  }
  // Epic
  if (sid === '25' && titulo) {
    return `https://store.epicgames.com/es-ES/browse?q=${encodeURIComponent(titulo)}`;
  }
  // GOG
  if (sid === '7' && titulo) {
    return `https://www.gog.com/en/games?query=${encodeURIComponent(titulo)}`;
  }
  // Humble
  if (sid === '11' && titulo) {
    return `https://www.humblebundle.com/store/search?search=${encodeURIComponent(titulo)}`;
  }
  // Fanatical / GMG / etc. → redirect CS bien formado
  return urlRedirectCheapShark(deal.dealID);
}

function dealAItem(deal, storesMap, { gratis = false } = {}) {
  const titulo = String(deal.title || '').trim();
  if (!titulo || esDlcOPack(titulo)) return null;

  const price = Number(deal.salePrice ?? deal.price);
  const retail = Number(deal.normalPrice ?? deal.retailPrice);
  const savings = Number(deal.savings);
  const pct = Number.isFinite(savings)
    ? Math.round(savings)
    : (Number.isFinite(retail) && retail > 0 && Number.isFinite(price)
      ? Math.round(((retail - price) / retail) * 100)
      : gratis ? 100 : null);
  const storeID = String(deal.storeID ?? '');
  const dealID = deal.dealID || null;
  const steamAppId = deal.steamAppID ? String(deal.steamAppID) : '';
  const thumb = deal.thumb || null;
  const portadas = portadasSteam(steamAppId, thumb);

  return {
    id: dealID ? `cs:${dealID}` : `cs:${storeID}:${normalizar(deal.title)}`,
    titulo,
    portada: portadas[0] || thumb || '',
    portadas,
    portadaVertical: Boolean(steamAppId),
    precio: Number.isFinite(price) ? price : null,
    precioAntes: Number.isFinite(retail) && retail > 0 ? retail : null,
    ahorroPct: pct,
    moneda: 'USD',
    storeID,
    tienda: nombreTienda(storeID, storesMap),
    dealID,
    url: urlTiendaDeDeal(deal, storeID),
    steamAppId: steamAppId || null,
    gratis: gratis || price === 0,
  };
}

/**
 * Feed paginado: todas las ofertas on-sale (o gratis) de una tienda.
 * @param {string} storeID
 * @param {{ limite?: number, soloGratis?: boolean, todas?: boolean }} opts
 */
export async function fetchCheapSharkDealsFeed(storeID, opts = {}) {
  const sid = String(storeID || '').trim();
  if (!sid) return [];
  const soloGratis = Boolean(opts.soloGratis);
  const todas = opts.todas !== false; // por defecto paginar todo
  const limite = todas
    ? MAX_ITEMS
    : Math.min(Math.max(Number(opts.limite) || 60, 1), MAX_ITEMS);
  const cacheKey = `cs:feed:v2:${sid}:${soloGratis ? 'free' : 'sale'}:${limite}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const storesMap = await fetchCheapSharkStores();
    const items = [];
    const vistos = new Set();
    const maxPages = todas ? MAX_PAGES : 1;

    for (let page = 0; page < maxPages && items.length < limite; page += 1) {
      const params = new URLSearchParams({
        storeID: sid,
        pageSize: String(PAGE_SIZE),
        pageNumber: String(page),
        sortBy: 'Savings',
        onSale: soloGratis ? '0' : '1',
      });
      if (soloGratis) params.set('upperPrice', '0');

      const lista = await leerJson(`https://www.cheapshark.com/api/1.0/deals?${params}`, 15000);
      if (!Array.isArray(lista) || lista.length === 0) break;

      for (const d of lista) {
        if (!d?.title) continue;
        const p = Number(d.salePrice);
        if (soloGratis) {
          if (!(Number.isFinite(p) && p === 0)) continue;
        } else {
          const sav = Number(d.savings);
          const ok = Number.isFinite(sav) ? sav > 0 : (Number.isFinite(p) && Number(d.normalPrice) > p);
          if (!ok) continue;
        }
        const item = dealAItem(d, storesMap, { gratis: soloGratis });
        if (!item) continue;
        const clave = item.steamAppId || normalizar(item.titulo);
        if (!clave || vistos.has(clave)) continue;
        vistos.add(clave);
        items.push(item);
        if (items.length >= limite) break;
      }

      if (lista.length < PAGE_SIZE) break;
    }

    cache.set(cacheKey, items, TTL_FEED_MS);
    return items;
  } catch {
    cache.set(cacheKey, [], TTL_FEED_MS);
    return [];
  }
}

export async function fetchCheapShark(nombre, plataforma = 'pc') {
  const titulo = String(nombre || '').trim();
  if (!titulo) return null;

  const plat = normalizar(plataforma);
  const esPc = !plat
    || /pc|windows|steam|epic|gog|microsoft store|mac|linux/.test(plat)
    || plat === 'all';
  if (!esPc) return null;

  const cacheKey = `cs:${titulo.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const storesMap = await fetchCheapSharkStores();
    const search = await leerJson(
      `https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(titulo)}&limit=8`,
    );
    if (!Array.isArray(search) || search.length === 0) {
      cache.set(cacheKey, null, TTL_MS);
      return null;
    }

    const hit = elegirPorTituloEstricto(search, titulo, (g) => g.external || g.internalName || '');
    const gameId = hit?.gameID;
    if (!gameId) {
      cache.set(cacheKey, null, TTL_MS);
      return null;
    }

    const data = await leerJson(
      `https://www.cheapshark.com/api/1.0/games?id=${encodeURIComponent(gameId)}`,
    );
    if (!data) return null;

    const info = data?.info || {};
    const deals = Array.isArray(data?.deals) ? data.deals : [];

    const ordenados = deals
      .map((d) => ({
        storeID: String(d.storeID || ''),
        tienda: nombreTienda(d.storeID, storesMap),
        price: Number(d.price),
        retailPrice: Number(d.retailPrice),
        dealID: d.dealID || null,
        savings: Number(d.savings),
        url: urlTiendaDeDeal(
          {
            dealID: d.dealID,
            steamAppID: info.steamAppID || hit?.steamAppID,
            title: info.title || hit?.external || titulo,
            storeID: d.storeID,
          },
          d.storeID,
        ),
      }))
      .filter((d) => Number.isFinite(d.price) && d.price >= 0)
      .sort((a, b) => a.price - b.price);

    const masBarato = ordenados[0]?.price;
    const historico = Number(info.cheapestPriceEver ?? hit?.cheapest);
    const topDeals = ordenados.slice(0, 8).map((d) => ({
      storeID: d.storeID,
      tienda: d.tienda,
      price: d.price,
      retailPrice: Number.isFinite(d.retailPrice) ? d.retailPrice : null,
      savings: Number.isFinite(d.savings) ? Math.round(d.savings) : null,
      dealID: d.dealID,
      url: d.url,
    }));

    const out = {
      salePrice: Number.isFinite(masBarato) ? masBarato : null,
      cheapestPrice: Number.isFinite(historico) && historico >= 0 ? historico : null,
      dealStoreId: ordenados[0]?.storeID || null,
      dealStoreName: ordenados[0]?.tienda || null,
      cheapSharkGameId: String(gameId),
      currency: 'USD',
      deals: topDeals,
      thumb: info.thumb || hit?.thumb || null,
    };
    cache.set(cacheKey, out, TTL_MS);
    return out;
  } catch {
    return null;
  }
}
