/**
 * OpenCritic: top critic score, % recomendación y tier.
 *
 * Vías (en orden):
 * 1) RapidAPI oficial si hay OPENCRITIC_API_KEY / opciones.apiKey
 * 2) Wikidata P2864 → página pública opencritic.com (sin key)
 * 3) Wikipedia externallinks → misma página
 *
 * Match estricto de título; sin inventar scores.
 */
import { elegirPorTituloEstricto, esMatchTituloEstricto } from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const UA = 'GameTracker/1.0 (catalogo local de videojuegos; personal)';
const RAPID_HOST = 'opencritic-api.p.rapidapi.com';
const cache = crearTtlCache({ max: 250 });
const TTL_MS = 24 * 60 * 60 * 1000; // 24 h — cuota RapidAPI / Wikimedia

function decodeOcHtml(html) {
  return String(html || '')
    .replace(/&q;/g, '"')
    .replace(/&a;/g, '&')
    .replace(/&s;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function pareceVideojuego(descripcion) {
  const d = String(descripcion || '').toLowerCase();
  if (!/\bgame\b/.test(d)) return false;
  if (/\b(character|mythology|rapper|album|genus|settlement|film|tv series|given name|family name|mountain|website|company|publisher|developer(?!.*game))\b/.test(d)) {
    return false;
  }
  return true;
}

function scoresDe(game, nombreFallback = '') {
  const score = Number(game?.topCriticScore ?? game?.medianScore ?? game?.averageScore);
  const recommend = Number(game?.percentRecommended);
  const tier = game?.tier ? String(game.tier) : (game?.tierName ? String(game.tierName) : null);
  const numReviews = Number(game?.numTopCriticReviews ?? game?.numReviews ?? game?.numCriticReviews);
  return {
    openCriticScore: Number.isFinite(score) && score > 0 ? Math.round(score) : null,
    openCriticRecommend: Number.isFinite(recommend) && recommend >= 0 ? Math.round(recommend) : null,
    openCriticTier: tier || null,
    openCriticNumReviews: Number.isFinite(numReviews) && numReviews > 0 ? Math.round(numReviews) : null,
    openCriticNombre: game?.name || nombreFallback || undefined,
    openCriticId: game?.id != null ? Number(game.id) : undefined,
  };
}

function scoresValidos(out) {
  return out && (out.openCriticScore != null || out.openCriticRecommend != null || out.openCriticTier);
}

async function leerJson(url, headers = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) return null;
  return r.json();
}

async function scrapePaginaJuego(ocId) {
  const id = String(ocId || '').trim();
  if (!/^\d+$/.test(id)) return null;
  const r = await fetch(`https://opencritic.com/game/${id}/-`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) return null;
  const html = decodeOcHtml(await r.text());
  const nameFromTitle = (html.match(/<title>([^<]+)\s+Reviews\s+-\s+OpenCritic/i) || [])[1];
  const nameFromJson = (html.match(/"tier":"[^"]*","name":"([^"]+)"/) || [])[1];
  const name = nameFromJson || nameFromTitle || null;
  const top = Number((html.match(/"topCriticScore":([0-9.]+)/) || [])[1]);
  const rec = Number((html.match(/"percentRecommended":([0-9.]+)/) || [])[1]);
  const tier = (html.match(/"tier":"([^"]*)"/) || [])[1] || null;
  const numReviews = Number(
    (html.match(/"numTopCriticReviews":(\d+)/) || html.match(/"numReviews":(\d+)/) || [])[1],
  );
  return scoresDe(
    {
      id: Number(id),
      name,
      topCriticScore: top,
      percentRecommended: rec,
      tier,
      numTopCriticReviews: numReviews,
    },
    name,
  );
}

/** RapidAPI: search + detail */
async function viaRapidApi(titulo, apiKey) {
  const headers = {
    'User-Agent': UA,
    Accept: 'application/json',
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': RAPID_HOST,
  };

  let lista = await leerJson(
    `https://${RAPID_HOST}/game/search?criteria=${encodeURIComponent(titulo)}`,
    headers,
  );
  if (!Array.isArray(lista) || lista.length === 0) {
    lista = await leerJson(
      `https://${RAPID_HOST}/meta/search?criteria=${encodeURIComponent(titulo)}`,
      headers,
    );
  }
  if (!Array.isArray(lista) || lista.length === 0) return null;

  const hit = elegirPorTituloEstricto(lista, titulo, (g) => g.name || g.title || '');
  if (!hit?.id) return null;

  const game = await leerJson(`https://${RAPID_HOST}/game/${hit.id}`, headers);
  if (!game) return null;
  if (!esMatchTituloEstricto(titulo, game.name || hit.name || '')) return null;
  return scoresDe(game);
}

/** Wikidata P2864 → scrape */
async function viaWikidata(titulo) {
  const data = await leerJson(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(titulo)}&language=en&type=item&limit=10&format=json&origin=*`,
  );
  if (!data || data.error || typeof data === 'string') return null;
  const candidatos = (data.search || [])
    .filter((x) => pareceVideojuego(x.description) || esMatchTituloEstricto(titulo, x.label || ''))
    .filter((x) => pareceVideojuego(x.description) || /video game|role-playing|developed by/i.test(x.description || ''));

  // Preferir descripciones de juego; luego match estricto de label
  const juegos = (data.search || []).filter((x) => pareceVideojuego(x.description));
  const pool = juegos.length ? juegos : candidatos;
  const hit = elegirPorTituloEstricto(pool, titulo, (x) => x.label || '');
  if (!hit?.id) return null;

  const ent = await leerJson(`https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`);
  const ocId = ent?.entities?.[hit.id]?.claims?.P2864?.[0]?.mainsnak?.datavalue?.value;
  if (!ocId) return null;

  const scraped = await scrapePaginaJuego(ocId);
  if (!scraped) return null;
  if (scraped.openCriticNombre && !esMatchTituloEstricto(titulo, scraped.openCriticNombre)) {
    return null;
  }
  return scraped;
}

/** Wikipedia: enlace externo a opencritic.com/game/ID */
async function viaWikipedia(titulo) {
  const variantes = [
    titulo,
    `${titulo} (video game)`,
    titulo.replace(/'/g, ''),
  ];
  for (const page of [...new Set(variantes)]) {
    try {
      const data = await leerJson(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=externallinks&format=json&redirects=1&origin=*`,
      );
      const links = data?.parse?.externallinks || [];
      const oc = links.find((u) => /opencritic\.com\/game\/(\d+)\//i.test(u));
      if (!oc) continue;
      const id = oc.match(/opencritic\.com\/game\/(\d+)\//i)[1];
      const scraped = await scrapePaginaJuego(id);
      if (!scraped) continue;
      if (scraped.openCriticNombre && !esMatchTituloEstricto(titulo, scraped.openCriticNombre)) {
        continue;
      }
      return scraped;
    } catch {
      // siguiente variante
    }
  }
  return null;
}

export async function fetchOpenCritic(nombre, opciones = {}) {
  const titulo = String(nombre || '').trim();
  if (!titulo) return null;

  const cacheKey = `oc:${titulo.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const apiKey = String(opciones.apiKey || process.env.OPENCRITIC_API_KEY || '').trim();

  try {
    let out = null;
    if (apiKey) {
      out = await viaRapidApi(titulo, apiKey);
    }
    if (!scoresValidos(out)) {
      out = await viaWikidata(titulo);
    }
    if (!scoresValidos(out)) {
      out = await viaWikipedia(titulo);
    }
    if (!scoresValidos(out)) {
      cache.set(cacheKey, null, TTL_MS);
      return null;
    }
    cache.set(cacheKey, out, TTL_MS);
    return out;
  } catch {
    return null;
  }
}
