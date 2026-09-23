/**
 * Capas seguras extra de preservación:
 * - Wikidata (sitio oficial / enlaces)
 * - Sitios IGDB / Steam (solo URLs ya conocidas)
 * - Mapas interactivos curados (lista fija, sin scrapear)
 */
import { esMatchTituloEstricto, normalizarNumerales } from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const cache = crearTtlCache({ max: 200 });
const TTL_MS = 12 * 60 * 60 * 1000;
const UA = {
  Accept: 'application/json',
  'User-Agent': 'GameTracker/1.0 (preservacion sitios; local)',
};

/** Mapas interactivos conocidos (slug normalizado → URL). */
const MAPAS_CURADOS = [
  {
    match: ['hollow knight', 'hollowknight'],
    titulo: 'Mapa interactivo',
    url: 'https://mapgenie.io/hollow-knight',
    fuente: 'MapGenie',
  },
  {
    match: ['hades', 'hades i', 'hades 1'],
    titulo: 'Mapa / Underworld',
    url: 'https://hades.fandom.com/wiki/The_Underworld',
    fuente: 'Fandom (curado)',
  },
  {
    match: ['zelda', 'the legend of zelda', 'legend of zelda'],
    titulo: 'Zelda Wiki (mapas)',
    url: 'https://zelda.fandom.com/wiki/Category:Maps',
    fuente: 'Fandom (curado)',
  },
  {
    match: ['breath of the wild', 'botw', 'zelda breath of the wild'],
    titulo: 'Mapa interactivo BOTW',
    url: 'https://www.zeldadungeon.net/breath-of-the-wild-interactive-map/',
    fuente: 'ZeldaDungeon',
  },
  {
    match: ['tears of the kingdom', 'totk'],
    titulo: 'Mapa interactivo TOTK',
    url: 'https://www.zeldadungeon.net/tears-of-the-kingdom-interactive-map/',
    fuente: 'ZeldaDungeon',
  },
  {
    match: ['elden ring'],
    titulo: 'Mapa interactivo',
    url: 'https://eldenring.wiki.fextralife.com/Interactive+Map',
    fuente: 'Fextralife',
  },
  {
    match: ['gta v', 'gta 5', 'grand theft auto v', 'grand theft auto 5'],
    titulo: 'Mapa GTA V',
    url: 'https://gta-5-map.com/',
    fuente: 'gta-5-map',
  },
  {
    match: ['the witcher 3', 'witcher 3', 'wild hunt'],
    titulo: 'Mapa interactivo',
    url: 'https://witcher3map.com/',
    fuente: 'Witcher3Map',
  },
  {
    match: ['stardew valley'],
    titulo: 'Mapa interactivo',
    url: 'https://stardew.info/',
    fuente: 'stardew.info',
  },
  {
    match: ['skyrim', 'the elder scrolls v'],
    titulo: 'Mapa interactivo',
    url: 'https://mapgenie.io/skyrim',
    fuente: 'MapGenie',
  },
  {
    match: ['minecraft'],
    titulo: 'Wiki / mapas',
    url: 'https://minecraft.wiki/',
    fuente: 'Minecraft Wiki',
  },
];

function itemDoc({ tipo, titulo, tituloOrigen, url, fuente }) {
  return {
    id: `${tipo}:${fuente}:${encodeURIComponent(String(url).slice(0, 100))}`,
    tipo,
    titulo,
    tituloOrigen: tituloOrigen || titulo,
    url,
    fuente,
    esPdf: /\.pdf($|\?)/i.test(url || ''),
    esImagen: /\.(jpe?g|png|webp|gif)($|\?)/i.test(url || ''),
    esEnlace: !/\.pdf($|\?)/i.test(url || ''),
  };
}

function slugTitulo(titulo) {
  return normalizarNumerales(titulo);
}

function mapaCuradoDe(titulo) {
  const n = slugTitulo(titulo);
  if (!n) return null;
  for (const m of MAPAS_CURADOS) {
    if (m.match.some((k) => n === k || n.includes(k) || k.includes(n))) {
      return itemDoc({
        tipo: 'mapa',
        titulo: m.titulo,
        tituloOrigen: m.titulo,
        url: m.url,
        fuente: m.fuente,
      });
    }
  }
  return null;
}

/**
 * IGDB website category → tipo de preservación.
 * https://api-docs.igdb.com/#website
 */
function docDesdeUrl(url, { fuente = 'Sitio', category = null } = {}) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return null;
  const low = u.toLowerCase();

  // Redes / tiendas: no son documentos de preservación
  if (/facebook\.com|twitter\.com|x\.com|instagram\.com|tiktok\.com|discord\.com|discord\.gg|twitch\.tv|youtube\.com|reddit\.com|steamcommunity\.com|store\.steampowered\.com|epicgames\.com|xbox\.com|playstation\.com|nintendo\.com\/store|itunes\.apple|play\.google/i.test(low)) {
    return null;
  }

  if (/\.pdf($|\?)/i.test(low) || /manual|instruction.?booklet/i.test(low)) {
    return itemDoc({
      tipo: 'manual',
      titulo: 'Manual de Instrucciones',
      tituloOrigen: u,
      url: u,
      fuente,
    });
  }

  if (/fandom\.com|gamepedia\.com|wiki\.|strategywiki\.org|fextralife\.com/i.test(low)) {
    if (/map|interactive.?map/i.test(low)) {
      return itemDoc({ tipo: 'mapa', titulo: 'Mapa', tituloOrigen: u, url: u, fuente });
    }
    if (/walkthrough|guide|strategy/i.test(low)) {
      return itemDoc({ tipo: 'guia', titulo: 'Guía', tituloOrigen: u, url: u, fuente });
    }
    return itemDoc({ tipo: 'wiki', titulo: 'Wiki del juego', tituloOrigen: u, url: u, fuente });
  }

  if (/map|interactive.?map|zeldadungeon\.net.*map|gta-5-map/i.test(low)) {
    return itemDoc({ tipo: 'mapa', titulo: 'Mapa interactivo', tituloOrigen: u, url: u, fuente });
  }

  // Sitio oficial (categoría IGDB 1 / 17)
  if (category === 1 || category === 17 || /official/i.test(fuente)) {
    return itemDoc({
      tipo: 'oficial',
      titulo: 'Sitio oficial',
      tituloOrigen: u,
      url: u,
      fuente,
    });
  }

  return null;
}

async function leerJson(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return null;
  return r.json();
}

/**
 * Wikidata: busca el ítem del videojuego y saca P856 (sitio oficial) + sitelinks.
 */
async function docsDesdeWikidata(titulo) {
  const q = String(titulo || '').trim();
  if (!q) return [];

  const buscar = async (term) => {
    const search = await leerJson(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(term)}&language=en&type=item&limit=8&format=json`,
    );
    return Array.isArray(search?.search) ? search.search : [];
  };

  let hits = await buscar(q);
  const tieneJuego = hits.some((h) => /video\s*game|videogame|videojuego/i.test(String(h.description || '')));
  if (!tieneJuego && q.split(/\s+/).length <= 2) {
    const extra = await buscar(`${q} video game`);
    hits = [...hits, ...extra];
  }

  const scored = hits.map((h) => {
    const label = h.label || '';
    const desc = String(h.description || '').toLowerCase();
    const esJuego = /video\s*game|videogame|videojuego|juego (de|para)|indie game/i.test(desc);
    const match = esMatchTituloEstricto(q, label, { umbral: esJuego ? 0.82 : 0.95 });
    return { h, esJuego, match, score: (esJuego ? 2 : 0) + (match ? 1 : 0) };
  }).filter((x) => x.match);
  scored.sort((a, b) => b.score - a.score || (b.esJuego ? 1 : 0) - (a.esJuego ? 1 : 0));
  const candidato = scored[0]?.h;
  if (!candidato?.id) return [];

  const entity = await leerJson(
    `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(candidato.id)}.json`,
  );
  const ent = entity?.entities?.[candidato.id];
  if (!ent) return [];

  const out = [];
  const claims = ent.claims || {};

  // P856 official website
  for (const c of (claims.P856 || [])) {
    const url = c?.mainsnak?.datavalue?.value;
    const doc = docDesdeUrl(url, { fuente: 'Wikidata', category: 1 });
    if (doc) out.push(doc);
  }

  // Sitelink Wikipedia EN → como wiki genérica si no hay otra
  const enwiki = ent.sitelinks?.enwiki?.title;
  if (enwiki) {
    out.push(itemDoc({
      tipo: 'wiki',
      titulo: 'Wikipedia',
      tituloOrigen: enwiki,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(enwiki.replace(/ /g, '_'))}`,
      fuente: 'Wikipedia',
    }));
  }

  return out;
}

/**
 * Convierte websites IGDB + website Steam + Wikidata + curados.
 * @returns {{ docs: object[] }}
 */
export async function fetchPreservacionSitios(titulo, { igdbWebsites = [], steamWebsite = null } = {}) {
  const t = String(titulo || '').trim();
  if (!t) return { docs: [] };

  const cacheKey = `pres-sitios:v4:${t.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  // No cachear con websites dinámicos vacíos si luego llegan — clave solo título está ok para wikidata+curados;
  // mezclamos siempre los websites pasados en caliente.
  let base = cached;
  if (base === undefined) {
    try {
      const wd = await docsDesdeWikidata(t).catch(() => []);
      const curado = mapaCuradoDe(t);
      base = { wikidata: wd, curado };
      cache.set(cacheKey, base, TTL_MS);
    } catch {
      base = { wikidata: [], curado: null };
      cache.set(cacheKey, base, TTL_MS);
    }
  }

  const docs = [];
  const seen = new Set();
  const push = (d) => {
    if (!d?.url || seen.has(d.url)) return;
    seen.add(d.url);
    docs.push(d);
  };

  for (const w of (Array.isArray(igdbWebsites) ? igdbWebsites : [])) {
    push(docDesdeUrl(w.url || w, { fuente: 'IGDB', category: w.category }));
  }
  if (steamWebsite) {
    push(docDesdeUrl(steamWebsite, { fuente: 'Steam', category: 1 }));
  }
  for (const d of (base.wikidata || [])) push(d);
  if (base.curado) push(base.curado);

  return { docs };
}
