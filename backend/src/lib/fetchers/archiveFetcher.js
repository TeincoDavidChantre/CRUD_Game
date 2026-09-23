/**
 * Documentos de preservación en Internet Archive (manuales, mapas, guías).
 * Sin API key. Match estricto: nunca docs[0] genérico.
 */
import {
  elegirPorTituloEstricto,
  esMatchTituloEstricto,
  normalizarNumerales,
  tituloSinEdicion,
} from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const UA = 'GameTracker/1.0 (catalogo local de videojuegos; personal)';
const cache = crearTtlCache({ max: 200 });
const TTL_MS = 24 * 60 * 60 * 1000;

const TIPOS = {
  manual: {
    id: 'manual',
    etiqueta: 'Manual de Instrucciones',
    ruido: /\b(instruction\s+booklet|instruction\s+manual|game\s+manual|user\s+manual|owner'?s?\s+manual|spielanleitung|manual|booklet|instructions?|handbook)\b/gi,
    queryTerms: 'manual OR "instruction booklet" OR "instruction manual" OR "game manual" OR booklet',
    parece: (blob) => /\b(manual|booklet|spielanleitung|instructions?)\b/.test(blob) || /manual|booklet/.test(blob),
  },
  mapa: {
    id: 'mapa',
    etiqueta: 'Mapa',
    ruido: /\b(world\s+map|game\s+map|map\s+foldout|foldout\s+map|poster\s+map|overworld\s+map|map)\b/gi,
    queryTerms: 'map OR "world map" OR "game map" OR foldout OR "poster map"',
    parece: (blob) => /\b(world\s+map|game\s+map|foldout|poster\s+map|overworld|\bmap\b)\b/.test(blob)
      && !/\b(manual|booklet|guide|strategy)\b/.test(blob),
  },
  guia: {
    id: 'guia',
    etiqueta: 'Guía oficial',
    ruido: /\b(strategy\s+guide|player'?s?\s+guide|official\s+guide|prima\s+guide|walkthrough|guidebook|guide)\b/gi,
    queryTerms: '"strategy guide" OR "player\'s guide" OR "official guide" OR "prima guide" OR guidebook',
    parece: (blob) => /\b(strategy\s+guide|player'?s?\s+guide|official\s+guide|prima|walkthrough|guidebook)\b/.test(blob)
      || (/\bguide\b/.test(blob) && !/\b(manual|booklet|map)\b/.test(blob)),
  },
};

const RUIDO_META =
  /\b(usa|eur|pal|ntsc|jp|jpn|japanese|english|deutsch|dutch|french|spanish|portuguese|nes|snes|n64|gamecube|wii|wii\s*u|3ds|ds|gba|game\s*boy|switch|playstation|ps[1-5]|xbox|sega|genesis|mega\s*drive|steam|team\s+cherry|nintendo|printed\s+in\s+\w+|nfr|600\s*dpi|meisaku)\b/gi;

function limpiarTituloDoc(titulo, tipo) {
  const ruido = TIPOS[tipo]?.ruido || TIPOS.manual.ruido;
  return String(titulo || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(ruido, ' ')
    .replace(RUIDO_META, ' ')
    .replace(/[-–—|:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pareceDocTipo(doc, tipo) {
  const t = String(doc?.title || '');
  const id = String(doc?.identifier || '');
  if (!t && !id) return false;
  if (/\b(dimplex|sunstech|owner`?s?\s+manual|service\s+manual|microwave|fridge|washer)\b/i.test(t)) {
    return false;
  }
  if (/^nintendo\s+\w+\s+manuals$/i.test(t.trim())) return false;
  const blob = `${t} ${id}`.toLowerCase();
  return TIPOS[tipo].parece(blob);
}

function scoreCandidato(esperado, doc, tipo) {
  const limpio = limpiarTituloDoc(doc.title, tipo);
  if (!limpio) return -1;
  if (!esMatchTituloEstricto(esperado, limpio, { umbral: 0.85 })) return -1;

  let pts = 10;
  const nEsp = normalizarNumerales(esperado);
  const nDoc = normalizarNumerales(limpio);
  if (nEsp === nDoc) pts += 5;
  if (tituloSinEdicion(esperado) === tituloSinEdicion(limpio)) pts += 3;
  if (tipo === 'manual' && /\binstruction\s+booklet\b/i.test(doc.title || '')) pts += 2;
  if (tipo === 'mapa' && /\bworld\s+map\b/i.test(doc.title || '')) pts += 2;
  if (tipo === 'guia' && /\bstrategy\s+guide\b/i.test(doc.title || '')) pts += 2;
  if (/\b(usa|english)\b/i.test(doc.title || '')) pts += 1;
  if (/\b(japanese|deutsch|dutch|spielanleitung)\b/i.test(doc.title || '')) pts -= 1;
  return pts;
}

async function buscarDocs(query) {
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&fl[]=mediatype&rows=15&page=1&output=json`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data?.response?.docs) ? data.response.docs : [];
}

function elegirMejor(titulo, docs, tipo) {
  const validos = (docs || []).filter((d) => pareceDocTipo(d, tipo));
  if (!validos.length) return null;

  const porMatch = elegirPorTituloEstricto(
    validos.map((d) => ({ ...d, _limpio: limpiarTituloDoc(d.title, tipo) })),
    titulo,
    (d) => d._limpio,
  );
  if (porMatch) return porMatch;

  let mejor = null;
  let mejorPts = -1;
  for (const doc of validos) {
    const pts = scoreCandidato(titulo, doc, tipo);
    if (pts > mejorPts) {
      mejorPts = pts;
      mejor = doc;
    }
  }
  return mejorPts >= 0 ? mejor : null;
}

async function urlDescargaPreferida(identifier, { preferirImagen = false } = {}) {
  let url = `https://archive.org/details/${encodeURIComponent(identifier)}`;
  let esPdf = false;
  let esImagen = false;
  try {
    const meta = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!meta.ok) return { url, esPdf, esImagen };
    const mj = await meta.json();
    const files = Array.isArray(mj?.files) ? mj.files : [];
    const imagenes = files
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f?.name || '') && !/_thumb|_small|__ia_thumb/i.test(f.name || ''))
      .sort((a, b) => Number(b.size || 0) - Number(a.size || 0));
    const pdf = files.find((f) => /\.pdf$/i.test(f?.name || '') && !/encrypted|password/i.test(f.name || ''));
    const elegido = (preferirImagen && imagenes[0]) || pdf || imagenes[0];
    if (!elegido?.name) return { url, esPdf, esImagen };
    url = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(elegido.name)}`;
    esPdf = /\.pdf$/i.test(elegido.name);
    esImagen = !esPdf;
  } catch {
    // details basta
  }
  return { url, esPdf, esImagen };
}

async function buscarTipo(titulo, tipo) {
  const seguro = titulo.replace(/"/g, '').slice(0, 80);
  const terms = TIPOS[tipo].queryTerms;
  const consultas = [
    `title:("${seguro}") AND (${terms}) AND mediatype:(texts OR image)`,
    `("${seguro}") AND (${terms}) AND (game OR nintendo OR sega OR playstation OR xbox OR "video game" OR steam) AND mediatype:(texts OR image)`,
  ];

  const vistos = new Set();
  const pool = [];
  for (const q of consultas) {
    const docs = await buscarDocs(q);
    for (const d of docs) {
      const id = d?.identifier;
      if (!id || vistos.has(id)) continue;
      vistos.add(id);
      pool.push(d);
    }
    const hit = elegirMejor(titulo, pool, tipo);
    if (hit) {
      const identifier = String(hit.identifier);
      const { url, esPdf, esImagen } = await urlDescargaPreferida(identifier, {
        preferirImagen: tipo === 'mapa',
      });
      return {
        id: `${tipo}:${identifier}`,
        tipo,
        titulo: TIPOS[tipo].etiqueta,
        tituloOrigen: hit.title || TIPOS[tipo].etiqueta,
        url,
        fuente: 'Internet Archive',
        archiveIdentifier: identifier,
        esPdf,
        esImagen,
      };
    }
  }
  return null;
}

/**
 * Busca manual + mapa + guía en paralelo.
 * @returns {{ docs: object[], manualUrl: string|null, archiveIdentifier: string|null }}
 */
export async function fetchInternetArchiveDocs(nombre) {
  const titulo = String(nombre || '').trim();
  if (titulo.length < 2) return { docs: [], manualUrl: null, archiveIdentifier: null };

  const cacheKey = `ia-docs:v3:${titulo.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const settled = await Promise.allSettled([
      buscarTipo(titulo, 'manual'),
      buscarTipo(titulo, 'mapa'),
      buscarTipo(titulo, 'guia'),
    ]);
    const docs = settled
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter(Boolean);

    const manual = docs.find((d) => d.tipo === 'manual') || null;
    const out = {
      docs,
      manualUrl: manual?.url || null,
      archiveIdentifier: manual?.archiveIdentifier || docs[0]?.archiveIdentifier || null,
      manualTitulo: manual?.tituloOrigen,
      manualEsPdf: Boolean(manual?.esPdf),
    };
    cache.set(cacheKey, out, TTL_MS);
    return out;
  } catch {
    const vacio = { docs: [], manualUrl: null, archiveIdentifier: null };
    cache.set(cacheKey, vacio, TTL_MS);
    return vacio;
  }
}

/** Compat: solo manual. */
export async function fetchInternetArchiveManual(nombre) {
  const pack = await fetchInternetArchiveDocs(nombre);
  if (!pack?.manualUrl) return null;
  return {
    archiveIdentifier: pack.archiveIdentifier,
    manualUrl: pack.manualUrl,
    manualTitulo: pack.manualTitulo,
    manualEsPdf: pack.manualEsPdf,
    docs: pack.docs,
  };
}
