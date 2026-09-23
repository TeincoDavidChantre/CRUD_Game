/**
 * Mapas por enlace (no se embebe el visor ajeno):
 * - MapGenie
 * - VGMaps (atlas retro; si el hit es imagen, se puede ver aquí)
 * - IGN Maps (solo enlace extra)
 * - Índice de guías de Steam Community cuando hay appid
 */
import { normalizarNumerales } from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const cache = crearTtlCache({ max: 200 });
const TTL_MS = 12 * 60 * 60 * 1000;
const UA = {
  Accept: 'text/html,application/json',
  'User-Agent': 'GameTracker/1.0 (preservacion mapas; enlaces publicos)',
};

const RUIDO = new Set([
  'map', 'maps', 'mapa', 'mapas', 'interactive', 'mapgenie', 'genie', 'atlas', 'video', 'game',
  'ign', 'guide', 'guides', 'the', 'and', 'of', 'for', 'a', 'to', 'wiki',
  'super', 'world', 'file', 'png', 'jpg', 'jpeg', 'webp', 'commons', 'wikimedia',
  'hd', 'hires', 'resolution',
]);

function textoPlano(valor) {
  return String(valor || '')
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAPA_EXTRA = new Set([
  ...RUIDO,
  'hyrule', 'dark', 'light', 'zone', 'zones', 'dungeon', 'overworld', 'area',
  'level', 'castle', 'region', 'labeled', 'labelled', 'official', 'complete',
  'full', 'svg', 'jpg', 'png', 'link',
]);

function coincideMapa(titulo, nombre) {
  const bases = [titulo, String(titulo).replace(/^the legend of zelda\s*:?\s*/i, '')];
  return bases.some((base) => {
    const q = normalizarNumerales(base).split(' ').filter((t) => t.length > 2 && !RUIDO.has(t));
    const c = normalizarNumerales(nombre).split(' ').filter((t) => t.length > 1);
    if (!q.length || !q.every((t) => c.includes(t))) return false;
    const extra = c.filter((t) => !q.includes(t) && !MAPA_EXTRA.has(t) && !/^\d+$/.test(t));
    return extra.length === 0;
  });
}

function coincide(tituloJuego, texto) {
  const plano = textoPlano(texto).replace(/[-_]/g, ' ');
  const q = normalizarNumerales(tituloJuego).split(' ').filter((t) => t.length > 1);
  const c = normalizarNumerales(plano).split(' ').filter((t) => t.length > 1);
  if (!q.length || !q.every((t) => c.includes(t))) return false;
  const extra = c.filter((t) => !q.includes(t) && !RUIDO.has(t) && !/^\d+$/.test(t));
  return extra.length === 0;
}

function itemDoc({ tipo, titulo, url, fuente, urlOrigen, soloExtra = false, esImagen = false }) {
  return {
    id: `${tipo}:${fuente}:${encodeURIComponent(String(url).slice(0, 120))}`,
    tipo,
    titulo: textoPlano(titulo || 'Mapa').slice(0, 120),
    tituloOrigen: textoPlano(titulo || '').slice(0, 200),
    url,
    fuente,
    urlOrigen: urlOrigen || url,
    esPdf: false,
    esImagen,
    esEnlace: !esImagen,
    soloExtra,
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

async function buscarDdg(consulta) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(consulta)}`;
  const r = await fetch(searchUrl, {
    headers: UA,
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  });
  if (!r.ok) return { searchUrl, hits: [] };
  const html = await r.text();
  const hits = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && hits.length < 15) {
    const url = decodificarHref(m[1]);
    const titulo = textoPlano(m[2]);
    if (url && titulo) hits.push({ url: url.split('?')[0], titulo });
  }
  return { searchUrl, hits };
}

function slugDe(titulo) {
  return normalizarNumerales(titulo).replace(/\s+/g, '-').replace(/^-|-$/g, '');
}

async function leerHtml(url) {
  const r = await fetch(url, {
    headers: UA,
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  });
  if (!r.ok) return null;
  const html = await r.text();
  const title = textoPlano((html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '');
  return { url: r.url || url, title, html };
}

async function docMapGenie(titulo) {
  const slugs = [slugDe(titulo)];
  const sinThe = slugDe(String(titulo).replace(/^\s*the\s+/i, ''));
  if (sinThe && sinThe !== slugs[0]) slugs.push(sinThe);

  for (const slug of slugs) {
    if (!slug) continue;
    const page = await leerHtml(`https://mapgenie.io/${slug}`).catch(() => null);
    if (!page?.title || /not found|page not found/i.test(page.title)) continue;
    const slugTexto = slug.replace(/-/g, ' ');
    if (!coincide(titulo, page.title) && !coincide(titulo, slugTexto)) continue;
    return itemDoc({
      tipo: 'mapa',
      titulo: `Mapa interactivo · ${textoPlano(titulo)}`,
      url: String(page.url || `https://mapgenie.io/${slug}`).split('?')[0].replace(/\/$/, ''),
      fuente: 'MapGenie',
      urlOrigen: `https://mapgenie.io/${slug}`,
    });
  }

  const { searchUrl, hits } = await buscarDdg(`site:mapgenie.io ${titulo} map`);
  const hit = hits.find((h) => {
    if (!/mapgenie\.io\/[a-z0-9-]+/i.test(h.url)) return false;
    const slug = (h.url.match(/mapgenie\.io\/([a-z0-9-]+)/i) || [])[1] || '';
    return coincide(titulo, h.titulo) || coincide(titulo, slug.replace(/-/g, ' '));
  });
  if (!hit) return null;
  return itemDoc({
    tipo: 'mapa',
    titulo: `Mapa interactivo · ${textoPlano(titulo)}`,
    url: hit.url.replace(/\/$/, ''),
    fuente: 'MapGenie',
    urlOrigen: searchUrl,
  });
}

async function docVgmaps(titulo) {
  const { searchUrl, hits } = await buscarDdg(`site:vgmaps.com ${titulo}`);
  const hit = hits.find((h) => {
    if (!/vgmaps\.com/i.test(h.url)) return false;
    return coincide(titulo, h.titulo) || coincide(titulo, decodeURIComponent(h.url).replace(/[-_]/g, ' '));
  });
  if (!hit) return null;
  const esImagen = /\.(png|gif|jpe?g|webp)$/i.test(hit.url);
  return itemDoc({
    tipo: 'mapa',
    titulo: esImagen ? `Mapa · ${textoPlano(titulo)}` : `Atlas · ${textoPlano(titulo)}`,
    url: hit.url,
    fuente: 'VGMaps',
    urlOrigen: searchUrl,
    esImagen,
  });
}

async function docIgn(titulo) {
  const { searchUrl, hits } = await buscarDdg(`site:ign.com/maps ${titulo}`);
  const hit = hits.find((h) => /ign\.com\/maps\//i.test(h.url) && (coincide(titulo, h.titulo) || coincide(titulo, h.url.replace(/-/g, ' '))));
  if (!hit) return null;
  return itemDoc({
    tipo: 'mapa',
    titulo: `Mapa IGN · ${textoPlano(titulo)}`,
    url: hit.url,
    fuente: 'IGN Maps',
    urlOrigen: searchUrl,
    soloExtra: true,
  });
}

async function docCommons(titulo) {
  const q = `${titulo.replace(/"/g, '')} map`;
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|size|mime`;
  const r = await fetch(api, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'GameTracker/1.0 (local game catalog; map images) node',
      'Api-User-Agent': 'GameTracker/1.0 (local game catalog; map images)',
    },
    signal: AbortSignal.timeout(12000),
  });
  const tipo = r.headers.get('content-type') || '';
  if (!r.ok || !tipo.includes('json')) return null;
  const data = await r.json();
  const pages = Object.values(data?.query?.pages || {});
  const candidatos = pages
    .map((p) => {
      const info = p?.imageinfo?.[0];
      if (!info?.url || !/^image\/(jpeg|png|webp|svg\+xml)$/i.test(info.mime || '')) return null;
      const ancho = Number(info.width || 0);
      const esSvg = /svg/i.test(info.mime || '');
      if (!esSvg && ancho < 1000) return null;
      const nombre = String(p.title || '').replace(/^File:/i, '');
      if (!/map|mapa|overworld|dungeon/i.test(nombre)) return null;
      if (/saturday|cosplay|convention|screenshot|fan.?art|photo|portrait/i.test(nombre)) return null;
      if (!coincideMapa(titulo, nombre)) return null;
      return { url: info.url.split('?')[0], nombre, ancho, bytes: Number(info.size || 0) };
    })
    .filter(Boolean)
    .sort((a, b) => b.ancho - a.ancho || b.bytes - a.bytes);
  const hit = candidatos[0];
  if (!hit) return null;
  return itemDoc({
    tipo: 'mapa',
    titulo: `Mapa en alta resolución · ${textoPlano(titulo)}`,
    url: hit.url,
    fuente: 'Wikimedia Commons',
    urlOrigen: `https://commons.wikimedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
    esImagen: true,
  });
}

function docSteamGuias(steamAppId) {
  const id = String(steamAppId || '').replace(/\D/g, '');
  if (!id) return null;
  return itemDoc({
    tipo: 'guia',
    titulo: 'Guías de la comunidad',
    url: `https://steamcommunity.com/app/${id}/guides/`,
    fuente: 'Steam Community',
    urlOrigen: `https://store.steampowered.com/app/${id}`,
  });
}

/**
 * @returns {{ docs: object[] }}
 */
export async function fetchMapasExternos(titulo, { steamAppId = null } = {}) {
  const t = String(titulo || '').trim();
  if (!t) return { docs: [] };
  const key = `mapas-ext:v4:${t.toLowerCase()}:${steamAppId || ''}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const settled = await Promise.allSettled([
    docMapGenie(t),
    docCommons(t),
    docVgmaps(t),
    docIgn(t),
    Promise.resolve(docSteamGuias(steamAppId)),
  ]);
  const docs = [];
  const seen = new Set();
  for (const s of settled) {
    const d = s.status === 'fulfilled' ? s.value : null;
    if (!d?.url || seen.has(d.url)) continue;
    seen.add(d.url);
    docs.push(d);
  }
  const pack = { docs };
  cache.set(key, pack, docs.length ? TTL_MS : 2 * 60 * 1000);
  return pack;
}
