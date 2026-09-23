/**
 * Agrega ofertas y freebies (100% dto) con precios de la tienda en la región
 * del usuario (no MSRP US convertido a ciegas).
 */
import {
  TIENDAS_CLAVE,
  fetchCheapSharkDealsFeed,
  portadasSteam,
} from './fetchers/cheapSharkFetcher.js';
import { crearTtlCache } from './ttlCache.js';

const cache = crearTtlCache({ max: 40 });
const TTL_MS = 2 * 60 * 1000;
const UA = {
  Accept: 'application/json',
  'User-Agent': 'GameTracker/1.0 (catalogo local de videojuegos)',
};

/** moneda Settings → país Epic + cc Steam */
const REGION_POR_MONEDA = {
  USD: { epic: 'US', steam: 'us', locale: 'en-US' },
  EUR: { epic: 'ES', steam: 'es', locale: 'es-ES' },
  COP: { epic: 'CO', steam: 'co', locale: 'es-ES' },
  MXN: { epic: 'MX', steam: 'mx', locale: 'es-MX' },
  ARS: { epic: 'AR', steam: 'ar', locale: 'es-AR' },
  CLP: { epic: 'CL', steam: 'cl', locale: 'es-CL' },
  PEN: { epic: 'PE', steam: 'pe', locale: 'es-PE' },
  BRL: { epic: 'BR', steam: 'br', locale: 'pt-BR' },
  GBP: { epic: 'GB', steam: 'uk', locale: 'en-GB' },
};

function regionDe(moneda) {
  const code = String(moneda || 'USD').toUpperCase();
  return REGION_POR_MONEDA[code] || REGION_POR_MONEDA.USD;
}

async function leerJson(url, timeout = 15000) {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function itemBase(parcial) {
  const steamAppId = parcial.steamAppId || null;
  const portadas = Array.isArray(parcial.portadas) && parcial.portadas.length
    ? parcial.portadas
    : portadasSteam(steamAppId, parcial.portada || '');
  return {
    id: '',
    titulo: '',
    portada: portadas[0] || '',
    portadas,
    portadaVertical: Boolean(steamAppId),
    precio: null,
    precioAntes: null,
    ahorroPct: null,
    moneda: 'USD',
    tienda: '',
    claveTienda: '',
    url: null,
    steamAppId,
    gratis: false,
    ...parcial,
    portada: (parcial.portada || portadas[0] || ''),
    portadas: parcial.portadas?.length ? parcial.portadas : portadas,
  };
}

function claveDedup(item) {
  if (item?.steamAppId) return `steam:${item.steamAppId}`;
  const t = String(item?.titulo || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return t ? `t:${t}` : '';
}

/** Precio Steam regional (centavos → unidad). */
async function steamPrecioRegional(appId, cc) {
  const id = String(appId || '').trim();
  if (!id) return null;
  const data = await leerJson(
    `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(id)}&cc=${encodeURIComponent(cc)}&filters=price_overview`,
    8000,
  );
  const po = data?.[id]?.data?.price_overview;
  if (!po) {
    // free-to-play / free sin price_overview
    const full = data?.[id]?.data;
    if (full && (full.is_free || full.package_groups?.length === 0)) {
      return { precio: 0, precioAntes: null, ahorroPct: 100, moneda: null, gratis: true };
    }
    return null;
  }
  const moneda = String(po.currency || 'USD').toUpperCase();
  const final = po.final != null ? Number(po.final) / 100 : null;
  const initial = po.initial != null ? Number(po.initial) / 100 : null;
  const gratis = final === 0 || /free|gratis/i.test(String(po.final_formatted || ''));
  return {
    precio: Number.isFinite(final) ? final : null,
    precioAntes: Number.isFinite(initial) && initial > 0 ? initial : null,
    ahorroPct: Number(po.discount_percent) || (gratis ? 100 : null),
    moneda,
    gratis,
  };
}

async function enriquecerSteamRegional(items, cc, { tope = 120, concurrencia = 8 } = {}) {
  const lista = Array.isArray(items) ? items : [];
  const out = lista.map((i) => ({ ...i }));
  let idx = 0;

  async function worker() {
    while (idx < out.length && idx < tope) {
      const i = idx;
      idx += 1;
      const appId = out[i].steamAppId;
      if (!appId) continue;
      try {
        const p = await steamPrecioRegional(appId, cc);
        if (!p) continue;
        out[i] = {
          ...out[i],
          precio: p.gratis ? 0 : (p.precio ?? out[i].precio),
          precioAntes: p.precioAntes ?? out[i].precioAntes,
          ahorroPct: p.ahorroPct ?? out[i].ahorroPct,
          moneda: p.moneda || out[i].moneda || 'USD',
          gratis: p.gratis || out[i].gratis,
        };
      } catch {
        /* keep previous */
      }
    }
  }

  await Promise.all(Array.from({ length: concurrencia }, () => worker()));
  return out;
}

/** Epic Games Store — free promotions en la región del usuario. */
async function epicGratis(region) {
  const { epic: country, locale } = region;
  const data = await leerJson(
    `https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=${encodeURIComponent(locale)}&country=${encodeURIComponent(country)}&allowCountries=${encodeURIComponent(country)}`,
  );
  const elements = data?.data?.Catalog?.searchStore?.elements;
  if (!Array.isArray(elements)) return [];

  const ahora = Date.now();
  const items = [];
  for (const el of elements) {
    const current = el?.promotions?.promotionalOffers?.[0]?.promotionalOffers || [];
    const activa = current.find((o) => {
      const start = Date.parse(o.startDate || '');
      const end = Date.parse(o.endDate || '');
      return Number.isFinite(start) && Number.isFinite(end) && start <= ahora && ahora <= end;
    });
    if (!activa) continue;

    const price = el?.price?.totalPrice;
    const discountPrice = Number(price?.discountPrice);
    if (Number.isFinite(discountPrice) && discountPrice > 0) continue;

    const slug = el.catalogNs?.mappings?.[0]?.pageSlug
      || el.productSlug
      || el.urlSlug
      || '';
    const titulo = String(el.title || '').trim();
    if (!titulo) continue;

    const imgs = Array.isArray(el.keyImages) ? el.keyImages : [];
    const tall = imgs.find((i) => /OfferImageTall|Thumbnail|DieselStoreFrontTall/i.test(i.type));
    const wide = imgs.find((i) => /OfferImageWide|DieselStoreFrontWide/i.test(i.type));
    const covers = [tall?.url, wide?.url, imgs[0]?.url].filter(Boolean);
    const original = Number(price?.originalPrice);
    const moneda = String(price?.currencyCode || 'USD').toUpperCase();

    items.push(itemBase({
      id: `epic:${el.id || slug || titulo}`,
      titulo,
      portada: covers[0] || '',
      portadas: covers,
      portadaVertical: Boolean(tall),
      precio: 0,
      // Epic: minor units (centavos) de la moneda regional
      precioAntes: Number.isFinite(original) && original > 0 ? original / 100 : null,
      ahorroPct: 100,
      moneda,
      tienda: 'Epic Games',
      claveTienda: 'epic',
      url: slug
        ? `https://store.epicgames.com/p/${encodeURIComponent(String(slug).replace(/\/home$/, ''))}`
        : 'https://store.epicgames.com/free-games',
      gratis: true,
    }));
  }
  return items;
}

/** Steam specials featured con cc regional. */
async function steamOfertasFeatured(region) {
  const cc = region.steam;
  const out = [];
  const featured = await leerJson(
    `https://store.steampowered.com/api/featuredcategories/?cc=${encodeURIComponent(cc)}&l=english`,
  );
  for (const it of featured?.specials?.items || []) {
    const id = String(it.id || '');
    if (!id) continue;
    const descuento = Number(it.discount_percent) || 0;
    const finalRaw = it.final_price ?? it.final;
    const initialRaw = it.original_price ?? it.original;
    const final = finalRaw != null ? Number(finalRaw) / 100 : null;
    const initial = initialRaw != null ? Number(initialRaw) / 100 : null;
    const thumbs = [it.header_image, it.large_capsule_image, it.small_capsule_image].filter(Boolean);
    // featuredcategories no siempre declara currency; asumimos la del cc
    const monedaMap = {
      us: 'USD', uk: 'GBP', es: 'EUR', co: 'COP', mx: 'MXN', ar: 'ARS', cl: 'CLP', pe: 'PEN', br: 'BRL',
    };
    out.push(itemBase({
      id: `steam:${id}`,
      titulo: String(it.name || '').trim(),
      portadas: portadasSteam(id, thumbs[0]),
      precio: Number.isFinite(final) ? final : null,
      precioAntes: Number.isFinite(initial) ? initial : null,
      ahorroPct: descuento || (final === 0 ? 100 : null),
      moneda: monedaMap[cc] || 'USD',
      tienda: 'Steam',
      claveTienda: 'steam',
      url: `https://store.steampowered.com/app/${id}`,
      steamAppId: id,
      gratis: final === 0,
    }));
  }
  return out.filter((x) => x.titulo && (x.ahorroPct > 0 || x.gratis || x.precio != null));
}

/** Steam free / 100%, luego precios regionales reales. */
async function steamGratisTodas(region) {
  const out = [];
  const vistos = new Set();
  const cc = region.steam;

  for (let start = 0; start < 200; start += 50) {
    const data = await leerJson(
      `https://store.steampowered.com/search/results/?query=&start=${start}&count=50&maxprice=free&specials=1&category1=998&cc=${encodeURIComponent(cc)}&infinite=1`,
    );
    const html = String(data?.results_html || '');
    if (!html.trim()) break;

    const ids = [...html.matchAll(/data-ds-appid="(\d+)"/g)].map((m) => m[1]);
    const titulos = [...html.matchAll(/class="title"[^>]*>([^<]+)</g)].map((m) => m[1].trim());
    if (!ids.length) break;

    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      if (!id || vistos.has(id)) continue;
      vistos.add(id);
      out.push(itemBase({
        id: `steam-free:${id}`,
        titulo: titulos[i] || `Steam ${id}`,
        portadas: portadasSteam(id),
        precio: 0,
        precioAntes: null,
        ahorroPct: 100,
        moneda: 'USD',
        tienda: 'Steam',
        claveTienda: 'steam',
        url: `https://store.steampowered.com/app/${id}`,
        steamAppId: id,
        gratis: true,
      }));
    }

    const total = Number(data?.total_count);
    if (Number.isFinite(total) && start + 50 >= total) break;
    if (ids.length < 40) break;
  }

  return enriquecerSteamRegional(out, cc, { tope: out.length, concurrencia: 8 });
}

function fila(plataforma, clave, items) {
  return {
    plataforma,
    clave,
    items: (items || []).filter((i) => i?.titulo),
  };
}

function fusionarSinRepetir(...listas) {
  const mapa = new Map();
  for (const lista of listas) {
    for (const it of lista || []) {
      const k = claveDedup(it);
      if (!k) continue;
      const prev = mapa.get(k);
      if (!prev) {
        mapa.set(k, it);
        continue;
      }
      const portadas = [...new Set([
        ...(prev.portadas || []),
        ...(it.portadas || []),
        prev.portada,
        it.portada,
      ].filter(Boolean))];
      // Preferir precios regionales (no USD) cuando haya conflicto
      const prevRegional = prev.moneda && prev.moneda !== 'USD';
      const itRegional = it.moneda && it.moneda !== 'USD';
      const usarItPrecio = (!prevRegional && itRegional)
        || (prev.precioAntes == null && it.precioAntes != null)
        || (prev.precio == null && it.precio != null);
      mapa.set(k, {
        ...prev,
        precio: usarItPrecio ? (it.precio ?? prev.precio) : (prev.precio ?? it.precio),
        precioAntes: usarItPrecio ? (it.precioAntes ?? prev.precioAntes) : (prev.precioAntes ?? it.precioAntes),
        ahorroPct: prev.ahorroPct ?? it.ahorroPct,
        moneda: usarItPrecio ? (it.moneda || prev.moneda) : (prev.moneda || it.moneda),
        portada: prev.portada || it.portada || portadas[0] || '',
        portadas,
        url: prev.url || it.url,
        tienda: prev.tienda || it.tienda,
        claveTienda: prev.claveTienda || it.claveTienda,
        gratis: prev.gratis || it.gratis,
      });
    }
  }
  return [...mapa.values()];
}

function excluirClaves(lista, clavesFree) {
  return (lista || []).filter((it) => {
    const k = claveDedup(it);
    if (!k) return true;
    if (clavesFree.has(k)) return false;
    if (it.gratis || it.precio === 0 || it.ahorroPct >= 100) return false;
    if (it.precio == null && !it.ahorroPct) return false;
    return true;
  });
}

function marcarUsd(lista) {
  return (lista || []).map((i) => ({
    ...i,
    moneda: i.moneda || 'USD',
  }));
}

/**
 * @param {{ limite?: number, moneda?: string }} opts
 */
export async function armarOfertasInicio({ limite, moneda = 'USD' } = {}) {
  const region = regionDe(moneda);
  const cacheKey = `ofertas:v6:${region.epic}:${region.steam}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return { ...hit, cached: true };

  const [epicFree, steamFree, steamFeat] = await Promise.all([
    epicGratis(region).catch(() => []),
    steamGratisTodas(region).catch(() => []),
    steamOfertasFeatured(region).catch(() => []),
  ]);

  const steamCsFree = await fetchCheapSharkDealsFeed(TIENDAS_CLAVE.steam.storeID, { soloGratis: true, todas: true }).catch(() => []);
  const gogFree = await fetchCheapSharkDealsFeed(TIENDAS_CLAVE.gog.storeID, { soloGratis: true, todas: true }).catch(() => []);
  const steamCsSale = await fetchCheapSharkDealsFeed(TIENDAS_CLAVE.steam.storeID, { todas: true }).catch(() => []);
  const epicSale = await fetchCheapSharkDealsFeed(TIENDAS_CLAVE.epic.storeID, { todas: true }).catch(() => []);
  const gogSale = await fetchCheapSharkDealsFeed(TIENDAS_CLAVE.gog.storeID, { todas: true }).catch(() => []);
  const humbleSale = await fetchCheapSharkDealsFeed(TIENDAS_CLAVE.humble.storeID, { todas: true }).catch(() => []);

  // Steam CS → enriquecer con precio regional de la tienda Steam
  const steamCsSaleReg = await enriquecerSteamRegional(
    marcarUsd(steamCsSale),
    region.steam,
    { tope: 180, concurrencia: 10 },
  ).catch(() => marcarUsd(steamCsSale));

  const steamCsFreeReg = await enriquecerSteamRegional(
    marcarUsd(steamCsFree),
    region.steam,
    { tope: 40, concurrencia: 6 },
  ).catch(() => marcarUsd(steamCsFree));

  const gratisPlano = fusionarSinRepetir(
    epicFree.map((i) => ({ ...i, claveTienda: i.claveTienda || 'epic' })),
    steamFree,
    steamCsFreeReg.map((i) => ({ ...i, claveTienda: 'steam', tienda: i.tienda || 'Steam' })),
    marcarUsd(gogFree).map((i) => ({ ...i, claveTienda: 'gog', tienda: i.tienda || 'GOG' })),
  );

  const clavesFree = new Set(gratisPlano.map(claveDedup).filter(Boolean));

  // Preferir precios Steam regionales; featured aporta cobertura
  const steamDescuentos = excluirClaves(
    fusionarSinRepetir(steamCsSaleReg, steamFeat),
    clavesFree,
  );

  const descuentos = [
    fila('Steam', 'steam', steamDescuentos),
    fila('Epic Games', 'epic', excluirClaves(marcarUsd(epicSale), clavesFree)),
    fila('GOG', 'gog', excluirClaves(marcarUsd(gogSale), clavesFree)),
    fila('Humble', 'humble', excluirClaves(marcarUsd(humbleSale), clavesFree)),
  ].filter((f) => f.items.length > 0);

  const payload = {
    actualizadoEn: new Date().toISOString(),
    monedaUsuario: String(moneda || 'USD').toUpperCase(),
    region: { epic: region.epic, steam: region.steam },
    ttlSegundos: Math.round(TTL_MS / 1000),
    gratis: gratisPlano,
    descuentos,
    nota: 'Precios de tienda en tu región (Epic/Steam). CheapShark GOG/Humble en USD si no hay feed regional.',
  };

  cache.set(cacheKey, payload, TTL_MS);
  return { ...payload, cached: false };
}
