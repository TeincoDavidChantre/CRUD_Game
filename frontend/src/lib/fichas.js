export const ESTADOS = ['PENDIENTE', 'JUGANDO', 'COMPLETADO', 'ABANDONADO'];

export function partir(valor) {
  if (Array.isArray(valor)) return valor.map((item) => String(item).trim()).filter(Boolean);
  return String(valor || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function unirLinea(valor) {
  return partir(valor).join(' · ');
}

export function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function anioDe(valor) {
  const match = String(valor || '').match(/\b(?:19|20)\d{2}\b/);
  return match ? match[0] : '';
}

export function desdeBiblioteca(juego) {
  return {
    libraryId: juego.id,
    titulo: juego.tituloJuego || juego.title || '',
    portada: juego.urlPortada || juego.coverUrl || '',
    donde: partir(juego.plataformas),
    sistemas: partir(juego.sistemas),
    descripcion: juego.descripcion || '',
    desarrollador: juego.desarrollador || '',
    generos: partir(juego.generos),
    metacritic: juego.metacritic || null,
    lanzamiento: '',
    etiqueta: '',
    ediciones: [],
    estado: juego.estado || juego.status || 'PENDIENTE',
    etiquetas: juego.etiquetas || '',
    comentario: juego.comentario || '',
    calificacion: juego.calificacion || '',
  };
}

function anioNumero(valor) {
  const match = String(valor || '').match(/\b(?:19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

export function mejorLanzamiento(actual, extra) {
  const deTienda = [actual, extra].filter((ficha) => ficha?.anioFuente !== 'wiki' && anioNumero(ficha?.lanzamiento) != null);
  const lista = deTienda.length ? deTienda : [actual, extra].filter((ficha) => anioNumero(ficha?.lanzamiento) != null);
  if (!lista.length) return actual?.lanzamiento || extra?.lanzamiento || '';
  return lista.reduce((mejor, ficha) => (anioNumero(ficha.lanzamiento) < anioNumero(mejor.lanzamiento) ? ficha : mejor)).lanzamiento;
}

function puntajePortada(url) {
  if (/library_600x900/.test(url || '')) return 6;
  if (/nintendo\.com/.test(url || '') && String(url).includes('/05_packshots/')) return 5;
  if (/store-images\.s-microsoft\.com/.test(url || '')) return 4;
  if (/playstation\.(net|com)/.test(url || '')) return 3;
  if (/mzstatic\.com/.test(url || '')) return 2;
  if (/steamstatic\.com/.test(url || '')) return 2;
  if (/wikimedia\.org/.test(url || '')) return 1;
  return 0;
}

function elegirPortada(actual, extra) {
  if (extra.portada && extra.portadaVertical && !actual.portadaVertical) return extra;
  if (actual.portada && actual.portadaVertical && !extra.portadaVertical) return actual;
  if (extra.portada && (!actual.portada || extra.portada !== actual.portada)) return extra;
  if (!actual.portada) return extra;
  if (!extra.portada) return actual;
  return puntajePortada(extra.portada) > puntajePortada(actual.portada) ? extra : actual;
}

function describir(actual, extra) {
  if (extra.descripcion && extra.descripcion.trim()) return extra;
  if (actual.descripcion && actual.descripcion.trim()) return actual;
  return extra;
}

export function puntajeNombre(item, consulta) {
  const nombre = normalizar(item?.titulo);
  const q = normalizar(consulta);
  let puntos = 40;
  if (nombre && q && nombre === q) puntos = 100;
  else if (nombre.startsWith(`${q} `)) puntos = 80;
  else if (q && nombre.startsWith(q)) puntos = 70;
  const lugares = new Set([...(item?.tiendas || []), ...(item?.donde || item?.plataformas || [])]);
  if (lugares.size >= 2) puntos += 15;
  return puntos;
}

export function fusionarFichas(actual, extra) {
  const donde = [...new Set([...partir(actual.donde || actual.plataformas), ...partir(extra.donde || extra.plataformas)])].filter((s) => s.length > 1);
  const sistemas = [...new Set([...partir(actual.sistemas), ...partir(extra.sistemas)])].filter((s) => s.length > 1);
  const generos = [...new Set([...partir(actual.generos), ...partir(extra.generos)])].filter((s) => s.length > 1).slice(0, 6);
  const ediciones = [...new Set([...partir(actual.ediciones), ...partir(extra.ediciones)])].filter((s) => s.length > 1);
  const tiendas = [...new Set([...partir(actual.tiendas), ...partir(extra.tiendas)])];
  const portadaFicha = elegirPortada(actual, extra);
  const texto = describir(actual, extra);
  const estudio = extra.desarrolladorFuente === 'steam' && extra.desarrollador
    ? extra
    : (actual.desarrolladorFuente === 'steam' && actual.desarrollador ? actual : (actual.desarrollador ? actual : extra));
  const steamAppId = actual.steamAppId || extra.steamAppId || '';
  const tituloFinal = (extra.titulo || actual.titulo || '').replace(/\s*\(\d{4}\)$/, '').trim() || actual.titulo;
  return {
    ...actual,
    ...extra,
    titulo: tituloFinal,
    portada: portadaFicha.portada || '',
    portadaVertical: Boolean(portadaFicha.portada && portadaFicha.portadaVertical),
    descripcion: texto.descripcion || '',
    origenDescripcion: texto.origenDescripcion || 'tienda',
    donde,
    plataformas: donde,
    sistemas,
    ediciones,
    lanzamiento: mejorLanzamiento(actual, extra),
    anioFuente: [actual, extra].some((ficha) => ficha.anioFuente !== 'wiki' && anioNumero(ficha.lanzamiento) != null) ? 'tienda' : (actual.anioFuente || extra.anioFuente || 'tienda'),
    metacritic: actual.metacritic || extra.metacritic,
    desarrollador: estudio.desarrollador || '',
    desarrolladorFuente: estudio.desarrolladorFuente || '',
    generos,
    tiendas,
    steamAppId,
    id: steamAppId ? `steam:${steamAppId}` : (puntajePortada(actual.portada) >= puntajePortada(extra.portada) ? actual.id : extra.id),
  };
}

export function agruparFichas(lista) {
  const grupos = new Map();
  for (const ficha of lista) {
    const clave = normalizar(ficha.titulo);
    const previa = grupos.get(clave);
    const base = {
      ...ficha,
      donde: partir(ficha.donde || ficha.plataformas),
      plataformas: partir(ficha.donde || ficha.plataformas),
      sistemas: partir(ficha.sistemas),
      generos: partir(ficha.generos),
    };
    grupos.set(clave, previa ? fusionarFichas(previa, base) : base);
  }
  const porSteam = new Map();
  const salida = [];
  for (const ficha of grupos.values()) {
    if (!ficha.steamAppId) {
      salida.push(ficha);
      continue;
    }
    const indice = porSteam.get(ficha.steamAppId);
    if (indice == null) {
      porSteam.set(ficha.steamAppId, salida.length);
      salida.push(ficha);
      continue;
    }
    salida[indice] = fusionarFichas(salida[indice], ficha);
  }
  return salida;
}

export function combinarCatalogo(item, data) {
  return fusionarFichas(item, data);
}

export function desdeCatalogo(item, propio) {
  const base = propio ? desdeBiblioteca(propio) : null;
  let tiendas = item.enlacesTienda || base?.enlacesTienda || {};
  if (typeof tiendas === 'string') {
    try {
      tiendas = JSON.parse(tiendas);
    } catch {
      tiendas = {};
    }
  }

  return {
    libraryId: base?.libraryId || null,
    titulo: item.titulo || item.tituloJuego || base?.titulo || '',
    portada: item.portada || item.urlPortada || base?.portada || '',
    donde: partir(item.donde || item.plataformas || base?.donde),
    sistemas: partir(item.sistemas || base?.sistemas),
    descripcion: item.descripcion || base?.descripcion || '',
    desarrollador: item.desarrollador || base?.desarrollador || '',
    generos: partir(item.generos || base?.generos),
    metacritic: item.metacritic || base?.metacritic || null,
    lanzamiento: item.lanzamiento || (item.anoLanzamiento ? `${item.anoLanzamiento}-01-01` : ''),
    etiqueta: item.etiqueta || '',
    ediciones: partir(item.ediciones || base?.ediciones),
    enlacesTienda: tiendas,
    estado: base?.estado || 'PENDIENTE',
    etiquetas: base?.etiquetas || '',
    comentario: base?.comentario || '',
    calificacion: base?.calificacion || '',
    catalogId: item.id,
  };
}
