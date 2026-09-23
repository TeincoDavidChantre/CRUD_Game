/**
 * Matching estricto de títulos para carátulas / logos / multimedia.
 * Regla: nunca aceptar el primer resultado genérico de una búsqueda por nombre.
 */

const EDICION = /\b(complete|goty|game of the year|definitive|deluxe|standard|ultimate|gold|platinum|remastered|remake|enhanced|anniversary|special|director.?s cut|legacy|edition|hd|collection|bundle|pack)\b/gi;

export function normalizarTitulo(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/—|–|-/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Romanos / arábigos frecuentes en títulos de juegos → dígitos. */
export function normalizarNumerales(texto) {
  return normalizarTitulo(texto)
    .replace(/\bviii\b/g, '8')
    .replace(/\bvii\b/g, '7')
    .replace(/\bvi\b/g, '6')
    .replace(/\biv\b/g, '4')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bix\b/g, '9')
    .replace(/\bx\b/g, '10')
    .replace(/\bv\b/g, '5')
    .replace(/\bi\b/g, '1');
}

export function tituloSinEdicion(texto) {
  return normalizarNumerales(texto).replace(EDICION, ' ').replace(/\s+/g, ' ').trim();
}

export function distanciaLevenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const fila = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) fila[j] = j;
  for (let i = 1; i <= m; i += 1) {
    let prev = fila[0];
    fila[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = fila[j];
      const costo = s[i - 1] === t[j - 1] ? 0 : 1;
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, prev + costo);
      prev = tmp;
    }
  }
  return fila[n];
}

export function similitudTitulo(a, b) {
  const x = normalizarNumerales(a);
  const y = normalizarNumerales(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const maxLen = Math.max(x.length, y.length);
  if (!maxLen) return 0;
  return 1 - distanciaLevenshtein(x, y) / maxLen;
}

function tokensClave(texto) {
  return normalizarNumerales(texto)
    .split(' ')
    .filter((t) => t && !/^(the|a|an|of|and|or|el|la|los|las|de|del)$/.test(t));
}

/** Números / romanos del título (evita GTA V ↔ GTA VI). */
function numeralesDe(texto) {
  return (normalizarNumerales(texto).match(/\b\d+\b/g) || []).sort().join(',');
}

/**
 * true solo con coincidencia léxica alta.
 * - Igualdad exacta (normalizada / numerales)
 * - Misma base sin edición + similitud ≥ umbral
 * - Nunca acepta hermanos de franquicia (Vice City ≠ VI)
 */
export function esMatchTituloEstricto(esperado, candidato, { umbral = 0.9 } = {}) {
  const q = normalizarNumerales(esperado);
  const c = normalizarNumerales(candidato);
  if (!q || !c) return false;
  if (q === c) return true;

  if (numeralesDe(q) !== numeralesDe(c)) return false;

  const qBase = tituloSinEdicion(esperado);
  const cBase = tituloSinEdicion(candidato);
  if (qBase && cBase && qBase === cBase) return true;

  // Candidato = consulta + sufijo de edición
  if (c.startsWith(`${q} `) || q.startsWith(`${c} `)) {
    const resto = c.startsWith(`${q} `) ? c.slice(q.length).trim() : q.slice(c.length).trim();
    if (!resto || EDICION.test(resto)) {
      EDICION.lastIndex = 0;
      return true;
    }
    EDICION.lastIndex = 0;
  }

  const sim = similitudTitulo(qBase || q, cBase || c);
  if (sim < umbral) return false;

  // Exigir que casi todas las palabras clave de la consulta estén en el candidato
  const palabrasQ = tokensClave(qBase || q);
  const setC = new Set(tokensClave(cBase || c));
  if (palabrasQ.length === 0) return false;
  const cubiertas = palabrasQ.filter((p) => setC.has(p)).length;
  return cubiertas / palabrasQ.length >= 0.9;
}

/**
 * Elige el mejor candidato por título estricto. Nunca cae al [0] genérico.
 * @returns {T|null}
 */
export function elegirPorTituloEstricto(lista, consulta, obtenerNombre = (x) => x?.name || x?.titulo || x?.title || '') {
  if (!consulta || !Array.isArray(lista) || lista.length === 0) return null;

  const exactos = [];
  const buenos = [];
  for (const item of lista) {
    const nombre = obtenerNombre(item);
    if (!nombre) continue;
    if (!esMatchTituloEstricto(consulta, nombre)) continue;
    const sim = similitudTitulo(consulta, nombre);
    if (normalizarNumerales(consulta) === normalizarNumerales(nombre)) {
      exactos.push({ item, sim });
    } else {
      buenos.push({ item, sim });
    }
  }

  const pool = exactos.length ? exactos : buenos;
  if (!pool.length) return null;
  pool.sort((a, b) => b.sim - a.sim);
  return pool[0].item;
}

/** Extrae IDs canónicos desde ficha / externalId / enlaces. */
export function idsImagenDesde(ficha = {}) {
  const id = String(ficha.id || ficha.externalId || '');
  let rawgId = ficha.rawgId ? String(ficha.rawgId) : null;
  let igdbId = ficha.igdbId ? String(ficha.igdbId) : null;
  let steamAppId = ficha.steamAppId ? String(ficha.steamAppId) : null;

  if (!rawgId && id.startsWith('rawg:')) rawgId = id.slice(5);
  if (!igdbId && id.startsWith('igdb:')) igdbId = id.slice(5);
  if (!steamAppId && id.startsWith('steam:')) steamAppId = id.slice(6);

  let enlaces = ficha.enlacesTienda || ficha.tiendas || {};
  if (typeof enlaces === 'string') {
    try {
      enlaces = JSON.parse(enlaces);
    } catch {
      enlaces = {};
    }
  }
  if (!steamAppId && enlaces?.steam) {
    const m = String(enlaces.steam).match(/\/app\/(\d+)/);
    if (m) steamAppId = m[1];
  }

  return {
    rawgId: rawgId && /^\d+$/.test(rawgId) ? rawgId : null,
    igdbId: igdbId && /^\d+$/.test(igdbId) ? igdbId : null,
    steamAppId: steamAppId && /^\d+$/.test(steamAppId) ? steamAppId : null,
  };
}
