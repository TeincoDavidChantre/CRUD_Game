/**
 * Enlaces públicos de foros y guías de comunidad.
 * GameFAQs y Steam Community salen de la búsqueda HTML de DuckDuckGo
 * (esos sitios bloquean el fetch directo). Solo URL, título y fuente.
 */
import { normalizarNumerales } from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const cache = crearTtlCache({ max: 200 });
const TTL_MS = 12 * 60 * 60 * 1000;
const UA = {
  Accept: 'text/html,application/json',
  'User-Agent': 'GameTracker/1.0 (preservacion foros; enlaces publicos)',
};

function itemDoc({ tipo, titulo, url, fuente, urlOrigen }) {
  return {
    id: `${tipo}:${fuente}:${encodeURIComponent(String(url).slice(0, 120))}`,
    tipo,
    titulo: textoPlano(titulo || 'Enlace').slice(0, 120),
    tituloOrigen: String(titulo || '').slice(0, 200),
    url,
    fuente,
    urlOrigen: urlOrigen || url,
    esPdf: false,
    esImagen: false,
    esEnlace: true,
  };
}

function decodificarHref(href) {
  const raw = String(href || '').replace(/&amp;/g, '&');
  try {
    const abs = raw.startsWith('//') ? `https:${raw}` : raw;
    const u = new URL(abs, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    if (/^https?:\/\//i.test(abs) && !/duckduckgo\.com/i.test(u.hostname)) return abs;
  } catch {
    /* ignore */
  }
  return '';
}

async function leer(url, { json = false } = {}) {
  const r = await fetch(url, {
    headers: { ...UA, Accept: json ? 'application/json' : UA.Accept },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  });
  if (!r.ok) return null;
  return json ? r.json() : r.text();
}

function enlacesDdg(html) {
  const out = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html || '')) && out.length < 20) {
    const url = decodificarHref(m[1]);
    const titulo = textoPlano(m[2]);
    if (url && titulo) out.push({ url, titulo });
  }
  return out;
}

async function buscarDdg(consulta) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(consulta)}`;
  const html = await leer(searchUrl);
  return { searchUrl, hits: enlacesDdg(html || '') };
}

const RUIDO = new Set([
  'guide', 'guides', 'complete', 'completed', 'beginner', 'beginners', 'walkthrough',
  'faq', 'faqs', 'map', 'maps', 'steam', 'community', 'for', 'pc', 'switch',
  'playstation', 'xbox', 'nintendo', 'tips', 'tip', 'full', 'how', 'to', 'a',
  'the', 'and', 'of', 'wiki', 'gamefaqs', 'completion', 'file', 'details',
  'sharedfiles', 'cheats', 'cheat',
]);

function textoPlano(valor) {
  return String(valor || '')
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function coincide(tituloJuego, texto) {
  const plano = textoPlano(texto);
  const q = normalizarNumerales(tituloJuego).split(' ').filter((t) => t.length > 1);
  const c = normalizarNumerales(plano).split(' ').filter((t) => t.length > 1);
  if (!q.length || !q.every((t) => c.includes(t))) return false;
  const extra = c.filter((t) => !q.includes(t) && !RUIDO.has(t) && !/^\d+$/.test(t));
  return extra.length === 0;
}

async function docsGameFaqs(titulo) {
  const { searchUrl, hits } = await buscarDdg(`site:gamefaqs.gamespot.com ${titulo}`);
  const juego = hits.find((h) => {
    if (!/gamefaqs\.gamespot\.com\/[a-z0-9-]+\/\d+-/i.test(h.url)) return false;
    if (/\/(faqs|maps|boards|cheats)\b/i.test(h.url)) return false;
    return coincide(titulo, h.titulo) || coincide(titulo, h.url.replace(/-/g, ' '));
  });
  if (!juego) return [];
  const base = juego.url.replace(/\/$/, '').split('?')[0];
  return [
    itemDoc({
      tipo: 'guia',
      titulo: `Guías · ${juego.titulo}`,
      url: `${base}/faqs`,
      fuente: 'GameFAQs',
      urlOrigen: searchUrl,
    }),
  ];
}

async function docsSteamGuias(titulo) {
  const { searchUrl, hits } = await buscarDdg(`site:steamcommunity.com/sharedfiles ${titulo} guide`);
  const docs = [];
  for (const h of hits) {
    if (!/steamcommunity\.com\/sharedfiles\/filedetails/i.test(h.url)) continue;
    if (!coincide(titulo, h.titulo)) continue;
    docs.push(itemDoc({
      tipo: /map|mapa/i.test(h.titulo) ? 'mapa' : 'guia',
      titulo: h.titulo,
      url: h.url.split('&')[0],
      fuente: 'Steam Community',
      urlOrigen: searchUrl,
    }));
    if (docs.length >= 3) break;
  }
  return docs;
}

/**
 * @returns {{ docs: object[] }}
 */
export async function fetchForosPreservacion(titulo) {
  const t = String(titulo || '').trim();
  if (!t) return { docs: [] };
  const key = `foros:v4:${t.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const settled = await Promise.allSettled([
    docsGameFaqs(t),
    docsSteamGuias(t),
  ]);
  const docs = [];
  const seen = new Set();
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const d of s.value || []) {
      if (!d?.url || seen.has(d.url)) continue;
      seen.add(d.url);
      docs.push(d);
    }
  }
  const pack = { docs };
  cache.set(key, pack, docs.length ? TTL_MS : 2 * 60 * 1000);
  return pack;
}
