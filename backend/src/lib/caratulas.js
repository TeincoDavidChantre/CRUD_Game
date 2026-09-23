import {
  elegirPorTituloEstricto,
  esMatchTituloEstricto,
  normalizarTitulo,
} from './tituloMatch.js';

const cache = new Map();

const CABECERAS = {
  'User-Agent': 'Mozilla/5.0 (compatible; GameTracker/1.0)',
  Accept: 'application/json',
};

export function esCaptura(url) {
  const s = String(url || '');
  // Solo capturas / headers horizontales — no bloquear media.rawg.io/media/games (fondo de ficha)
  if (/\/screenshots?\//i.test(s)) return true;
  if (/rawg\.io\/media\/screenshots/i.test(s)) return true;
  if (/\/header\.jpg/i.test(s) || /capsule_\d+x\d+/i.test(s)) return true;
  if (/gameplay/i.test(s) && /(rawg\.io|steamstatic)/i.test(s)) return true;
  return false;
}

export function esCaratulaOficial(url) {
  const s = String(url || '');
  if (!s || esCaptura(s)) return false;
  if (/library_600x900/.test(s)) return true;
  if (/nintendo\.com/i.test(s) && s.includes('/05_packshots/')) return true;
  // Packshots legacy (GameCube, etc.) en portrait — no teasers ni default
  if (/nintendo\.com/i.test(s) && /\/migration\/games_7\/packshot\//i.test(s) && /\/portrait\//i.test(s) && !/default/i.test(s)) return true;
  if (/store-images\.s-microsoft\.com/i.test(s) && !/Wide/i.test(s)) return true;
  if (/playstation\.(net|com)/i.test(s)) return true;
  if (/mzstatic\.com/i.test(s) && !/100x100|artworkUrl100/i.test(s)) return true;
  if (/t_cover_big|t_1080p|t_720p/i.test(s)) return true;
  if (/wikimedia\.org/i.test(s) && /cover|boxart|box_art|poster/i.test(s) && !/thumb\/\d+px/i.test(s)) return true;
  // RAWG: imagen de ficha (mejor mostrar que dejar hueco vacío en inicio)
  if (/media\.rawg\.io\/media\/(?:resize\/[^/]+\/)?games\//i.test(s)) return true;
  return false;
}

/** Origen de tienda de la URL de portada (para no mezclar cajas entre consolas). */
export function origenPortada(url) {
  const s = String(url || '');
  if (/nintendo\.com/i.test(s)) return 'nintendo';
  if (/steamstatic|steampowered\.com/i.test(s)) return 'steam';
  if (/playstation\.(net|com)/i.test(s)) return 'playstation';
  if (/store-images\.s-microsoft\.com/i.test(s)) return 'xbox';
  if (/mzstatic\.com/i.test(s)) return 'apple';
  if (/wikimedia\.org/i.test(s)) return 'wiki';
  return 'otro';
}

function normalizar(texto) {
  return normalizarTitulo(texto);
}

function urlSegura(url, permitir) {
  try {
    const absoluta = String(url || '').startsWith('//') ? `https:${url}` : String(url || '');
    const parsed = new URL(absoluta);
    if (parsed.protocol !== 'https:') return '';
    if (!permitir(parsed.hostname)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

async function leerJson(url) {
  const respuesta = await fetch(url, { headers: CABECERAS, signal: AbortSignal.timeout(5000) });
  if (!respuesta.ok) return null;
  return respuesta.json();
}

function idSteam(url) {
  const match = String(url).match(/steampowered\.com\/app\/(\d+)/i);
  return match?.[1] || '';
}

function idXbox(url) {
  if (!/xbox\.com|microsoft\.com/i.test(url)) return '';
  const match = String(url).match(/\/([0-9A-Z]{12})(?:[/?#]|$)/i);
  return match?.[1]?.toUpperCase() || '';
}

function idPlay(url) {
  const match = String(url).match(/\/product\/([A-Z0-9][A-Z0-9_-]{8,})/i);
  return match?.[1] || '';
}

const cacheSteam = new Map();

function urlsSteam(appId) {
  return [
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
    `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
  ];
}

async function imagenExiste(url) {
  const respuesta = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
  const tipo = respuesta.headers.get('content-type') || '';
  return respuesta.ok && tipo.startsWith('image/');
}

export async function caratulaSteam(appId) {
  const id = String(appId || '');
  if (!/^\d+$/.test(id)) return '';
  if (cacheSteam.has(id)) return cacheSteam.get(id);
  let hallada = '';
  for (const url of urlsSteam(id)) {
    try {
      if (await imagenExiste(url)) {
        hallada = url;
        break;
      }
    } catch {
      // Ese CDN no tiene la cápsula: se prueba el siguiente.
    }
  }
  cacheSteam.set(id, hallada);
  return hallada;
}

export async function caratulaSteamCabecera(appId) {
  const id = String(appId || '');
  if (!/^\d+$/.test(id)) return '';
  const clave = `header:${id}`;
  if (cacheSteam.has(clave)) return cacheSteam.get(clave);
  const url = `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;
  let hallada = '';
  try {
    if (await imagenExiste(url)) hallada = url;
  } catch {
    hallada = '';
  }
  cacheSteam.set(clave, hallada);
  return hallada;
}

async function caratulaSteamPorNombre(titulo) {
  if (!normalizar(titulo)) return '';

  try {
    const datos = await leerJson(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(titulo)}&l=english&cc=us`,
    );
    const items = (datos?.items || []).filter((entry) => {
      if (entry.type !== 'app') return false;
      const n = (entry.name || '').toLowerCase();
      if (n.includes('soundtrack') || n.includes('artbook') || n.includes('dlc') || n.includes('season pass') || n.includes('expansion pack')) {
        return false;
      }
      return true;
    });

    // Strict match: jamás items[0] de la franquicia
    const coincidencia = elegirPorTituloEstricto(items, titulo, (e) => e.name);
    if (!coincidencia?.id) return '';
    return caratulaSteam(coincidencia.id);
  } catch {
    return '';
  }
}

async function caratulaXbox(bigId) {
  const datos = await leerJson(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${encodeURIComponent(bigId)}&market=US&languages=en-US`);
  const imagenes = datos?.Products?.[0]?.LocalizedProperties?.[0]?.Images || [];
  const elegida = imagenes.find((img) => img.ImagePurpose === 'Poster')
    || imagenes.find((img) => img.ImagePurpose === 'BoxArt');
  if (!elegida?.Uri) return '';
  return urlSegura(elegida.Uri, (host) => host === 'store-images.s-microsoft.com');
}

async function caratulaPlay(productId) {
  const datos = await leerJson(`https://store.playstation.com/store/api/chihiro/00_09_000/container/US/en/999/${encodeURIComponent(productId)}`);
  const imagen = (datos?.images || []).find((img) => img.type === 10 && img.url);
  if (!imagen) return '';
  return urlSegura(imagen.url, (host) => host.endsWith('.playstation.net'));
}

async function caratulaNintendo(titulo) {
  const datos = await leerJson(
    `https://searching.nintendo-europe.com/en/select?q=${encodeURIComponent(titulo)}&fq=type:GAME&rows=8&wt=json`,
  );
  const exacto = elegirPorTituloEstricto(datos?.response?.docs || [], titulo, (doc) => doc.title);
  const url = exacto?.image_url || '';
  if (!url.startsWith('https://www.nintendo.com/')) return '';
  if (/\/03_teaser_module|default/i.test(url)) return '';
  if (!url.includes('/05_packshots/') && !(url.includes('/migration/games_7/packshot/') && url.includes('/portrait/'))) {
    return '';
  }
  return urlSegura(url, (host) => host === 'www.nintendo.com');
}

function pareceCaja(nombre) {
  const texto = decodeURIComponent(String(nombre || '')).toLowerCase();
  return !/screenshot|gameplay|character|developer|logo_only/.test(texto);
}

async function mediaVertical(titulo) {
  try {
    const pagina = encodeURIComponent(String(titulo || '').replace(/ /g, '_'));
    const datos = await leerJson(`https://en.wikipedia.org/api/rest_v1/page/media-list/${pagina}`);
    if (!datos?.items) return '';

    const itemInfobox = datos.items.find((item) => {
      if (item.type !== 'image') return false;
      const t = (item.title || '').toLowerCase();
      if (!pareceCaja(t)) return false;
      return item.section_id === 0 || /cover|box|packshot|poster/.test(t);
    });

    if (!itemInfobox) return '';
    const srcset = itemInfobox.srcset || [];
    const src2x = srcset.find((s) => s.scale === '2x')?.src || srcset[srcset.length - 1]?.src;
    const srcRaw = src2x || itemInfobox.src || '';
    if (!srcRaw) return '';

    const srcUrl = srcRaw.startsWith('//') ? `https:${srcRaw}` : srcRaw;
    return urlSegura(srcUrl, (host) => host.endsWith('.wikimedia.org'));
  } catch {
    return '';
  }
}

async function caratulaWikipediaVertical(titulo) {
  if (!titulo) return '';
  // Solo página cuyo título coincide de forma estricta (evita redirecciones a hermanos de franquicia)
  const limpia = String(titulo).replace(/\s*\(\d{4}\)$/, '').trim();
  const candidatos = [limpia, `${limpia} (video game)`];
  for (const candidato of candidatos) {
    const url = await mediaVertical(candidato);
    if (!url) continue;
    // media-list usa el título de página; exigir match léxico con lo pedido
    if (esMatchTituloEstricto(limpia, candidato.replace(/\s*\(video game\)$/i, ''))) {
      return url;
    }
  }
  return '';
}

const cacheVertical = new Map();

export async function buscarCaratulaVertical({ titulo, steamAppId } = {}) {
  const clave = `${steamAppId || ''}|${normalizar(titulo)}`;
  if (!normalizar(titulo) && !steamAppId) return '';
  if (cacheVertical.has(clave)) return cacheVertical.get(clave);
  const base = String(titulo || '').replace(/\s*\(\d{4}\)$/, '').trim();

  // 1) ID Steam primero — nunca buscar por nombre si ya hay app id
  if (steamAppId) {
    const porId = await caratulaSteam(steamAppId);
    if (porId) {
      cacheVertical.set(clave, porId);
      return porId;
    }
  }

  const portada = await primera([
    async () => (base ? caratulaSteamPorNombre(base) : ''),
    async () => (base ? caratulaNintendo(base) : ''),
    async () => (base ? caratulaWikipediaVertical(base) : ''),
  ]);
  cacheVertical.set(clave, portada);
  return portada;
}

export function esPortadaVerticalOptima(url) {
  return esCaratulaOficial(url);
}

export async function resolverMejorPortada({ titulo, steamAppId, tiendas = {}, urlActual = '' }) {
  if (esPortadaVerticalOptima(urlActual)) {
    return urlActual;
  }

  // 1. Extraer AppId de Steam si existe — petición por ID, no por nombre
  const steamUrl = tiendas.steam || '';
  const idS = steamAppId || (steamUrl.match(/app\/(\d+)/)?.[1]);
  if (idS) {
    const steamCover = await caratulaSteam(idS);
    if (steamCover) return steamCover;
  }

  // 2. Búsqueda por nombre solo con match estricto (sin fallbacks de franquicia)
  if (titulo) {
    const vertical = await buscarCaratulaVertical({ titulo, steamAppId: idS });
    if (vertical) return vertical;
  }

  // 3. IGDB cover (cuenta del proyecto) si Steam/Nintendo no aportaron
  if (titulo) {
    try {
      const { metaIgdb } = await import('./fetchers/igdbFetcher.js');
      const clientId = (process.env.TWITCH_CLIENT_ID || process.env.IGDB_CLIENT_ID || '').trim();
      const clientSecret = (process.env.TWITCH_CLIENT_SECRET || process.env.IGDB_CLIENT_SECRET || '').trim();
      if (clientId && clientSecret) {
        const meta = await metaIgdb(titulo, clientId, clientSecret);
        if (meta?.coverUrl && esPortadaVerticalOptima(meta.coverUrl)) return meta.coverUrl;
      }
    } catch {
      // sin cover IGDB
    }
  }

  // 4. Si la URL actual ya es usable (RAWG games / IGDB), conservarla
  if (urlActual && esPortadaVerticalOptima(urlActual)) return urlActual;

  return '';
}

async function primera(tareas) {
  for (const tarea of tareas) {
    try {
      const url = await tarea();
      if (url) return url;
    } catch {
      // Siguiente fuente
    }
  }
  return '';
}

function conFamilias(plataformas) {
  const texto = plataformas.join(' ');
  const vistas = new Set(plataformas);
  if (/nintendo|switch|wii|3ds|game boy|gamecube|\bnes\b|\bsnes\b|\bn64\b/i.test(texto)) vistas.add('Nintendo');
  if (/playstation|\bps\d?\b|psp|vita/i.test(texto)) vistas.add('PlayStation');
  if (/xbox/i.test(texto)) vistas.add('Xbox');
  if (/\bpc\b|windows|steam|epic/i.test(texto)) vistas.add('PC');
  return [...vistas];
}

const ORDEN_FAMILIAS = ['PC', 'PlayStation', 'Xbox', 'Nintendo'];

export function unirPlataformas(plataformas, tiendas = [], portada = '') {
  const vistas = new Set(conFamilias(plataformas).filter((familia) => ORDEN_FAMILIAS.includes(familia)));
  const urls = tiendas.map((tienda) => tienda.url || '');
  if (urls.some((url) => idSteam(url)) || /steamstatic\.com|steampowered\.com/i.test(portada)) vistas.add('PC');
  if (urls.some((url) => idXbox(url)) || /store-images\.s-microsoft\.com/i.test(portada)) vistas.add('Xbox');
  if (urls.some((url) => idPlay(url)) || /playstation\.net/i.test(portada)) vistas.add('PlayStation');
  if (urls.some((url) => /nintendo\.com/i.test(url)) || /nintendo\.com/i.test(portada)) vistas.add('Nintendo');
  return ORDEN_FAMILIAS.filter((familia) => vistas.has(familia));
}

export async function caratulaOficial({ cacheId, titulo, tiendas = [], plataformas = [] }) {
  const claveCache = String(cacheId || `nombre:${normalizar(titulo)}`);
  if (cache.has(claveCache)) return cache.get(claveCache);

  const urls = tiendas.map((tienda) => tienda.url || '').filter(Boolean);
  const appId = urls.map(idSteam).find(Boolean) || '';
  const portada = await buscarCaratulaVertical({ titulo, steamAppId: appId });
  cache.set(claveCache, portada);
  return portada;
}
