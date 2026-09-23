/**
 * Enlaces de preservación vía Fandom (MediaWiki API).
 * Capas sanas: 1) descubrir wiki por slug + siteinfo 2) Wikipedia extlinks.
 * Sin scrapear foros. StrategyWiki suele estar detrás de Cloudflare → se omite si falla.
 */
import { esMatchTituloEstricto, normalizarNumerales, similitudTitulo } from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const cache = crearTtlCache({ max: 200 });
const TTL_MS = 12 * 60 * 60 * 1000;
const UA = {
  Accept: 'application/json',
  'User-Agent': 'GameTracker/1.0 (catalogo local; preservacion wiki)',
};

function itemDoc({ tipo, titulo, tituloOrigen, url, fuente }) {
  return {
    id: `${tipo}:${fuente}:${encodeURIComponent(String(url).slice(0, 80))}`,
    tipo,
    titulo,
    tituloOrigen: tituloOrigen || titulo,
    url,
    fuente,
    esPdf: false,
    esImagen: false,
    esEnlace: true,
  };
}

async function leerJson(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return null;
  return r.json();
}

function apiUrl(base, params) {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
}

function pageUrlDesdeWiki(wikiHost, title) {
  const parts = String(title || '').split('/');
  return `https://${wikiHost}/wiki/${parts.map((p) => encodeURIComponent(p.replace(/ /g, '_'))).join('/')}`;
}

function slugsCandidatos(titulo) {
  const n = String(titulo || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!n) return [];
  const words = n.split(' ').filter(Boolean);
  const compact = words.join('');
  const hyphen = words.join('-');
  const sinThe = words[0] === 'the' ? words.slice(1) : words;
  const out = [
    compact,
    hyphen,
    sinThe.join(''),
    sinThe.join('-'),
    words[words.length - 1], // zelda, metroid…
    words.slice(0, 2).join(''),
    words.slice(0, 2).join('-'),
  ];
  // Franchises frecuentes: última palabra significativa si el título es largo
  if (words.length >= 3) {
    out.push(words[words.length - 1]);
    out.push(sinThe[sinThe.length - 1]);
  }
  return [...new Set(out.filter((s) => s && s.length >= 3 && s.length <= 48))];
}

async function mwSearch(apiBase, query, limit = 8) {
  const data = await leerJson(apiUrl(apiBase, {
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: limit,
    srnamespace: 0,
    format: 'json',
  }));
  return Array.isArray(data?.query?.search) ? data.query.search : [];
}

async function siteInfo(subdomain) {
  const data = await leerJson(
    `https://${subdomain}.fandom.com/api.php?action=query&meta=siteinfo&siprop=general&format=json`,
  );
  const g = data?.query?.general;
  if (!g?.sitename && !g?.base) return null;
  // Canonical subdomain from base URL if redirected
  let canon = subdomain;
  const base = String(g.base || '');
  const m = base.match(/https?:\/\/([\w-]+)\.fandom\.com/i);
  if (m) canon = m[1];
  return {
    subdomain: canon,
    sitename: String(g.sitename || ''),
    mainpage: String(g.mainpage || ''),
    base,
  };
}

function wikiCoincideConTitulo(titulo, info) {
  const nombreWiki = info.sitename.replace(/\s*wiki\s*$/i, '').trim();
  if (esMatchTituloEstricto(titulo, nombreWiki, { umbral: 0.82 })) return true;
  if (esMatchTituloEstricto(titulo, info.mainpage.replace(/\s*wiki\s*$/i, '').trim(), { umbral: 0.82 })) {
    return true;
  }
  const subWords = info.subdomain.replace(/-/g, ' ');
  const compactTitulo = normalizarNumerales(titulo).replace(/\s+/g, '');
  const compactSub = normalizarNumerales(subWords).replace(/\s+/g, '');
  if (similitudTitulo(compactTitulo, compactSub) >= 0.85) return true;
  if (compactTitulo.includes(compactSub) && compactSub.length >= 4) return true;

  const palabras = normalizarNumerales(titulo).split(' ').filter((w) => w.length > 2
    && !/^(the|and|of|for|les|los|las|del)$/.test(w));
  const hay = normalizarNumerales(`${info.sitename} ${info.mainpage} ${info.subdomain}`);
  if (palabras.length && palabras.every((p) => hay.includes(p))) return true;
  // Franquicia: "The Legend of Zelda" → wiki "Zelda"
  if (nombreWiki && palabras.some((p) => p === normalizarNumerales(nombreWiki) || normalizarNumerales(nombreWiki).includes(p))) {
    if (palabras[palabras.length - 1] === normalizarNumerales(nombreWiki)) return true;
  }
  return false;
}

async function descubrirFandomPorSlug(titulo) {
  for (const sub of slugsCandidatos(titulo)) {
    const info = await siteInfo(sub).catch(() => null);
    if (!info) continue;
    if (!wikiCoincideConTitulo(titulo, info)) continue;
    return info;
  }
  return null;
}

async function descubrirFandomDesdeWikipedia(titulo) {
  const api = 'https://en.wikipedia.org/w/api.php';
  const search = await mwSearch(api, `${titulo} video game`, 8);
  let pageTitle = null;
  for (const h of search) {
    const base = String(h.title || '').replace(/\s*\(video game\)\s*$/i, '').trim();
    if (esMatchTituloEstricto(titulo, base, { umbral: 0.9 })) {
      pageTitle = h.title;
      break;
    }
  }
  if (!pageTitle && search[0]) {
    const base = String(search[0].title || '').replace(/\s*\(video game\)\s*$/i, '').trim();
    if (esMatchTituloEstricto(titulo, base, { umbral: 0.85 })) pageTitle = search[0].title;
  }
  if (!pageTitle) return null;

  // Pedir más enlaces externos
  const data = await leerJson(apiUrl(api, {
    action: 'query',
    titles: pageTitle,
    prop: 'extlinks',
    ellimit: 'max',
    format: 'json',
  }));
  const page = Object.values(data?.query?.pages || {})[0];
  const links = Array.isArray(page?.extlinks) ? page.extlinks.map((e) => e['*']).filter(Boolean) : [];
  const fandom = links.find((u) => /https?:\/\/([\w-]+)\.fandom\.com\//i.test(u) && !/community\.fandom\.com/i.test(u));
  if (!fandom) return null;
  const m = fandom.match(/https?:\/\/([\w-]+)\.fandom\.com/i);
  if (!m) return null;
  const info = await siteInfo(m[1]).catch(() => null);
  return info || { subdomain: m[1], sitename: m[1], mainpage: '', base: fandom };
}

async function docsDesdeFandom(titulo, info) {
  if (!info?.subdomain) return [];
  const host = `${info.subdomain}.fandom.com`;
  const api = `https://${host}/api.php`;
  const out = [];

  const hubTitle = info.mainpage || 'Main Page';
  out.push(itemDoc({
    tipo: 'wiki',
    titulo: 'Wiki del juego',
    tituloOrigen: info.sitename || hubTitle,
    url: pageUrlDesdeWiki(host, hubTitle),
    fuente: 'Fandom',
  }));

  const busquedas = [
    { tipo: 'mapa', etiqueta: 'Mapa', queries: [`"${titulo}" map`, 'World Map', `${titulo} map`, 'Interactive Map', 'Map'] },
    { tipo: 'guia', etiqueta: 'Guía / Walkthrough', queries: [`"${titulo}" walkthrough`, `"${titulo}" guide`, 'Walkthrough', 'How to play', `${titulo} walkthrough`] },
  ];

  for (const b of busquedas) {
    let elegido = null;
    let mejorScore = -1;
    for (const query of b.queries) {
      const hits = await mwSearch(api, query, 10);
      const filtrados = hits.filter((h) => {
        const t = String(h.title || '').toLowerCase();
        if (/^(user|template|category|file|thread|board|message wall):/i.test(h.title || '')) return false;
        if (b.tipo === 'mapa') return /\bmaps?\b|world\s*map|interactive\s*map|overworld/.test(t);
        return /\bwalkthrough|guide|quest|walk.?through|strategy|how to play|endings?\b/.test(t);
      });
      for (const h of filtrados) {
        let score = 1;
        const ht = String(h.title || '');
        const hn = normalizarNumerales(ht);
        const tn = normalizarNumerales(titulo);
        if (hn === tn || hn.startsWith(`${tn} `) || hn.startsWith(`${tn}/`) || hn.includes(`(${tn})`)) score += 6;
        const palabras = tn.split(' ').filter((w) => w.length > 2 && !/^(the|and|of|for)$/.test(w));
        const cubiertas = palabras.filter((p) => hn.includes(p)).length;
        score += cubiertas * 2;
        // Otras entregas de saga con subtítulo tras ":"
        const colonParts = ht.split(':');
        if (colonParts.length > 1) {
          const sub = colonParts.slice(1).join(':').split(/[—–]/)[0].trim();
          const subN = normalizarNumerales(sub);
          if (subN && !tn.includes(subN) && subN.length > 3) score -= 12;
        }
        if (score > mejorScore) {
          mejorScore = score;
          elegido = h;
        }
      }
      if (mejorScore >= 5) break;
    }
    if (elegido?.title && mejorScore >= 3) {
      out.push(itemDoc({
        tipo: b.tipo,
        titulo: b.etiqueta,
        tituloOrigen: elegido.title,
        url: pageUrlDesdeWiki(host, elegido.title),
        fuente: 'Fandom',
      }));
    }
  }

  return out;
}

/**
 * @returns {{ docs: object[] }}
 */
export async function fetchWikiPreservacion(nombre) {
  const titulo = String(nombre || '').trim();
  if (titulo.length < 2) return { docs: [] };

  const cacheKey = `wiki-pres:v2:${titulo.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    let info = await descubrirFandomPorSlug(titulo);
    if (!info) info = await descubrirFandomDesdeWikipedia(titulo);
    const docs = info ? await docsDesdeFandom(titulo, info) : [];
    const out = { docs };
    cache.set(cacheKey, out, TTL_MS);
    return out;
  } catch {
    const vacio = { docs: [] };
    cache.set(cacheKey, vacio, TTL_MS);
    return vacio;
  }
}
