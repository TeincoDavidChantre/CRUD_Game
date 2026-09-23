/**
 * Precios / enlaces de tiendas oficiales (consolas + Epic + Android).
 * Regla: null silencioso si falla o no hay match estricto. Nunca inventar precios.
 */
import { elegirPorTituloEstricto } from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const cache = crearTtlCache({ max: 200 });
const TTL_MS = 6 * 60 * 60 * 1000;
const UA = {
  Accept: 'application/json',
  'User-Agent': 'GameTracker/1.0 (catalogo local de videojuegos)',
};

/** Endpoint GraphQL público de Epic Store (no PlayStation). */
const EPIC_GRAPHQL = 'https://store.epicgames.com/graphql';

function itemTienda({ tienda, plataforma, titulo, url, precio = null, moneda = null, currencyCode = null }) {
  const precioNum = precio == null || !Number.isFinite(Number(precio)) ? null : Number(precio);
  return {
    tienda,
    plataforma,
    titulo: titulo || null,
    url: url || null,
    precio: precioNum,
    moneda: moneda || currencyCode || null,
    // Alias pedidos por el contrato de tiendas (store / price / platform)
    store: tienda,
    price: precioNum,
    platform: plataforma,
  };
}

function busquedaTienda(tienda, plataforma, titulo, url) {
  return itemTienda({
    tienda,
    plataforma,
    titulo,
    url,
    precio: null,
    moneda: null,
  });
}

async function leerJson(url, opts = {}) {
  const respuesta = await fetch(url, {
    headers: { ...UA, ...(opts.headers || {}) },
    signal: AbortSignal.timeout(opts.timeoutMs || 10000),
    method: opts.method || 'GET',
    body: opts.body,
  });
  if (!respuesta.ok) return null;
  return respuesta.json();
}

/** Detecta familias a partir del texto de plataformas/sistemas del juego. */
export function detectarFamiliasPlataforma(plataformasTexto = '') {
  const t = String(plataformasTexto || '').toLowerCase();
  return {
    pc: !t.trim()
      || /\bpc\b|windows|steam|epic|gog|microsoft store|mac|linux/.test(t),
    playstation: /playstation|\bps\s?[345]\b|\bpsvita\b|\bpsp\b/.test(t),
    xbox: /\bxbox\b/.test(t),
    nintendo: /nintendo|\bswitch\b|\bwii\b|\b3ds\b|\bn64\b|\bsnes\b|\bnes\b|\bgame\s?boy\b|\bgamecube\b/.test(t),
    android: /\bandroid\b|google play/.test(t),
  };
}

/**
 * PlayStation Store (Chihiro). Por defecto Colombia (CO/es).
 * Si la región falla o no hay match, URL de búsqueda — sin inventar precio.
 * @param {string} titulo
 * @param {{ country?: string, lang?: string, locale?: string }} [region]
 */
export async function fetchPlayStationStore(titulo, region = {}) {
  const q = String(titulo || '').trim();
  if (!q) return null;
  const country = String(region.country || 'CO').trim() || 'CO';
  const lang = String(region.lang || 'es').trim() || 'es';
  const locale = String(region.locale || 'es-co').trim() || 'es-co';
  const cacheKey = `ps-store:${country}:${lang}:${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const urlBusqueda = `https://store.playstation.com/${locale}/search/${encodeURIComponent(q)}`;

  try {
    const datos = await leerJson(
      `https://store.playstation.com/store/api/chihiro/00_09_000/tumbler/${encodeURIComponent(country)}/${encodeURIComponent(lang)}/999/${encodeURIComponent(q)}?size=12`,
    );
    const links = Array.isArray(datos?.links) ? datos.links : [];
    const hit = elegirPorTituloEstricto(links, q, (l) => l?.name || '');
    if (!hit?.id) {
      const busqueda = busquedaTienda('PlayStation Store', 'PlayStation', q, urlBusqueda);
      cache.set(cacheKey, busqueda, TTL_MS);
      return busqueda;
    }

    const sku = hit.default_sku || hit.skus?.[0] || null;
    let precio = null;
    let moneda = null;
    if (sku) {
      const display = String(sku.display_price || '').trim();
      moneda = sku.price_currency_code || sku.currency_code || (country === 'US' ? 'USD' : 'COP');
      if (/free|gratis/i.test(display) || Number(sku.price) === 0) {
        precio = 0;
      } else if (display) {
        const m = display.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
        if (m) precio = Number(m[1]);
      } else if (Number.isFinite(Number(sku.price)) && Number(sku.price) > 0) {
        // Chihiro: precio en centavos
        precio = Number(sku.price) / 100;
      }
    }

    const productoId = String(hit.id);
    const url = `https://store.playstation.com/${locale}/product/${encodeURIComponent(productoId)}`;
    const plataformas = Array.isArray(hit.playable_platform)
      ? hit.playable_platform.join(', ')
      : 'PlayStation';

    const out = itemTienda({
      tienda: 'PlayStation Store',
      plataforma: plataformas,
      titulo: hit.name,
      url,
      precio,
      moneda,
    });
    cache.set(cacheKey, out, TTL_MS);
    return out;
  } catch {
    const busqueda = busquedaTienda('PlayStation Store', 'PlayStation', q, urlBusqueda);
    cache.set(cacheKey, busqueda, TTL_MS);
    return busqueda;
  }
}

/**
 * Epic Games Store — GraphQL público (categoría games/edition/base).
 * Endpoint real: store.epicgames.com/graphql. Si Cloudflare bloquea, URL de búsqueda (precio null).
 */
export async function fetchEpicStore(titulo) {
  const q = String(titulo || '').trim();
  if (!q) return null;
  const cacheKey = `epic-store:${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const query = `
    query searchStoreQuery($keywords: String!, $category: String, $count: Int, $country: String!, $locale: String!) {
      Catalog {
        searchStore(
          keywords: $keywords
          category: $category
          count: $count
          country: $country
          locale: $locale
        ) {
          elements {
            title
            offerId
            urlSlug
            productSlug
            catalogNs { mappings { pageSlug } }
            price {
              totalPrice {
                discountPrice
                originalPrice
                currencyCode
                currencyInfo { decimals }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const body = JSON.stringify({
      query,
      variables: {
        keywords: q,
        category: 'games/edition/base',
        count: 8,
        country: 'US',
        locale: 'en-US',
      },
    });

    const datos = await leerJson(EPIC_GRAPHQL, {
      method: 'POST',
      headers: {
        ...UA,
        'Content-Type': 'application/json',
      },
      body,
      timeoutMs: 12000,
    });

    const elements = datos?.data?.Catalog?.searchStore?.elements;
    if (Array.isArray(elements) && elements.length > 0) {
      const hit = elegirPorTituloEstricto(elements, q, (e) => e?.title || '');
      if (hit) {
        const total = hit.price?.totalPrice;
        const decimals = Number(total?.currencyInfo?.decimals);
        const raw = total?.discountPrice ?? total?.originalPrice;
        let precio = null;
        if (raw != null && Number.isFinite(Number(raw))) {
          const div = Number.isInteger(decimals) && decimals > 0 ? 10 ** decimals : 100;
          precio = Number(raw) / div;
        }

        const pageSlug = hit.catalogNs?.mappings?.[0]?.pageSlug
          || hit.productSlug
          || hit.urlSlug
          || '';
        const slug = String(pageSlug).replace(/\/home$/, '').trim();
        const url = slug
          ? `https://store.epicgames.com/p/${encodeURIComponent(slug)}`
          : `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(q)}`;

        const out = itemTienda({
          tienda: 'Epic Games',
          plataforma: 'PC',
          titulo: hit.title,
          url,
          precio,
          moneda: total?.currencyCode || 'USD',
        });
        cache.set(cacheKey, out, TTL_MS);
        return out;
      }
    }
  } catch {
    // GraphQL suele bloquearse (Cloudflare). Seguir al enlace de búsqueda.
  }

  const busqueda = busquedaTienda(
    'Epic Games',
    'PC',
    q,
    `https://store.epicgames.com/es-MX/browse?q=${encodeURIComponent(q)}`,
  );
  cache.set(cacheKey, busqueda, TTL_MS);
  return busqueda;
}

/**
 * Google Play (Android) vía google-play-scraper.
 */
export async function fetchAndroidStore(titulo) {
  const q = String(titulo || '').trim();
  if (!q) return null;
  const cacheKey = `android-store:${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const gplay = (await import('google-play-scraper')).default;
    const results = await gplay.search({
      term: q,
      num: 8,
      lang: 'en',
      country: 'us',
    });
    const lista = Array.isArray(results) ? results : [];
    const hit = elegirPorTituloEstricto(lista, q, (app) => app?.title || '');
    if (!hit?.appId) {
      cache.set(cacheKey, null, TTL_MS);
      return null;
    }

    let precio = null;
    let moneda = null;
    const free = hit.free === true || hit.priceText === 'Free';
    if (free) {
      precio = 0;
      moneda = 'USD';
    } else if (hit.price != null && Number.isFinite(Number(hit.price))) {
      precio = Number(hit.price);
      moneda = hit.currency || 'USD';
    }

    const out = itemTienda({
      tienda: 'Google Play',
      plataforma: 'Android',
      titulo: hit.title,
      url: hit.url || `https://play.google.com/store/apps/details?id=${encodeURIComponent(hit.appId)}`,
      precio,
      moneda,
    });
    cache.set(cacheKey, out, TTL_MS);
    return out;
  } catch {
    cache.set(cacheKey, null, TTL_MS);
    return null;
  }
}

/** Sin API de precios: solo búsqueda oficial. price null → "Ver precio oficial". */
export async function fetchXboxStore(titulo) {
  const q = String(titulo || '').trim();
  if (!q) return null;
  return busquedaTienda(
    'Xbox Store',
    'Xbox',
    q,
    `https://www.xbox.com/es-CO/Search?q=${encodeURIComponent(q)}`,
  );
}

/** Sin API de precios: solo búsqueda oficial. price null → "Ver precio oficial". */
export async function fetchNintendoEshop(titulo) {
  const q = String(titulo || '').trim();
  if (!q) return null;
  return busquedaTienda(
    'Nintendo eShop',
    'Nintendo',
    q,
    `https://www.nintendo.com/search/?q=${encodeURIComponent(q)}`,
  );
}

/**
 * Orquesta tiendas según familias detectadas. Devuelve solo hits válidos.
 */
export async function fetchTiendasConsola(titulo, plataformasTexto = '') {
  const familias = detectarFamiliasPlataforma(plataformasTexto);
  const tareas = [];

  if (familias.playstation) {
    tareas.push(fetchPlayStationStore(titulo, { country: 'CO', lang: 'es', locale: 'es-co' }));
  }
  if (familias.pc) tareas.push(fetchEpicStore(titulo));
  if (familias.android) tareas.push(fetchAndroidStore(titulo));
  if (familias.xbox) tareas.push(fetchXboxStore(titulo));
  if (familias.nintendo) tareas.push(fetchNintendoEshop(titulo));

  if (!tareas.length) return [];

  const settled = await Promise.allSettled(tareas);
  return settled
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((x) => x && x.url);
}
