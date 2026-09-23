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

/** Clave estable para deduplicar etiquetas de disponibilidad. */
function claveDisponibilidad(etiqueta) {
  const t = normalizar(etiqueta);
  if (t === 'windows' || t === 'pc') return 'pc';
  if (t === 'mac' || t === 'macos' || t === 'os x') return 'mac';
  if (/switch\s*2|switch2/.test(t)) return 'switch2';
  if (t === 'switch' || t.includes('nintendo switch')) return 'switch';
  if (/^ps5$|playstation 5/.test(t)) return 'ps5';
  if (/^ps4$|playstation 4/.test(t)) return 'ps4';
  if (/^ps3$|playstation 3/.test(t)) return 'ps3';
  if (/^ps2$|playstation 2/.test(t)) return 'ps2';
  if (t.includes('vita')) return 'psvita';
  if (t === 'psp') return 'psp';
  if (t.includes('xbox series')) return 'xboxseries';
  if (t.includes('xbox one')) return 'xboxone';
  if (t.includes('xbox 360')) return 'xbox360';
  if (t === 'xbox') return 'xbox';
  if (t === 'playstation') return 'playstation';
  if (t === 'nintendo') return 'nintendo';
  if (t.includes('epic')) return 'epic';
  if (t.includes('microsoft store')) return 'msstore';
  if (t.includes('app store')) return 'appstore';
  if (t === 'movil' || t === 'mobile') return 'movil';
  return t;
}

/** Etiqueta legible para UI / iconos. */
function etiquetaDisponibilidad(etiqueta) {
  const t = normalizar(etiqueta);
  if (t === 'windows' || t === 'pc') return 'PC';
  if (t === 'mac' || t === 'macos' || t === 'os x') return 'Mac';
  if (/switch\s*2|switch2/.test(t)) return 'Nintendo Switch 2';
  if (t === 'switch' || t.includes('nintendo switch')) return 'Nintendo Switch';
  if (/^ps5$|playstation 5/.test(t)) return 'PlayStation 5';
  if (/^ps4$|playstation 4/.test(t)) return 'PlayStation 4';
  if (/^ps3$|playstation 3/.test(t)) return 'PlayStation 3';
  if (/^ps2$|playstation 2/.test(t)) return 'PlayStation 2';
  if (t.includes('vita')) return 'PS Vita';
  if (t.includes('epic')) return 'Epic Games';
  if (t.includes('microsoft store')) return 'Microsoft Store';
  if (t.includes('app store')) return 'App Store';
  if (t === 'movil' || t === 'mobile') return 'Móvil';
  if (t.includes('xbox series')) return 'Xbox Series X|S';
  return String(etiqueta || '').trim();
}

/**
 * Separa sin solapamiento:
 * - tiendas/plataformas: Steam, Epic, Android, iOS, Nintendo, PlayStation, Xbox...
 * - consolas: PC, Móvil, Switch, PS5, Wii, Xbox Series...
 */
export function clasificarDisponibilidad(item) {
  const crudos = [
    ...partir(item?.donde),
    ...partir(item?.sistemas),
    ...partir(item?.plataformas),
  ];

  let enlaces = item?.enlacesTienda;
  if (typeof enlaces === 'string') {
    try {
      enlaces = JSON.parse(enlaces);
    } catch {
      enlaces = null;
    }
  }
  if (enlaces && typeof enlaces === 'object') {
    if (enlaces.steam) crudos.push('Steam');
    if (enlaces.epic) crudos.push('Epic Games');
    if (enlaces.gog) crudos.push('GOG');
    if (enlaces.microsoft || enlaces.xbox) crudos.push('Microsoft Store');
    if (enlaces.playstation) crudos.push('PlayStation');
    if (enlaces.nintendo) crudos.push('Nintendo');
    if (enlaces.appstore || enlaces.ios) crudos.push('App Store');
  }

  const tiendas = [];
  const consolas = [];
  const vistosTienda = new Set();
  const vistosConsola = new Set();

  function ponerTienda(etiqueta) {
    const clave = claveDisponibilidad(etiqueta);
    if (!clave || vistosTienda.has(clave) || vistosConsola.has(clave)) return;
    vistosTienda.add(clave);
    tiendas.push(etiquetaDisponibilidad(etiqueta));
  }

  function ponerConsola(etiqueta) {
    const clave = claveDisponibilidad(etiqueta);
    if (!clave || vistosConsola.has(clave) || vistosTienda.has(clave)) return;
    vistosConsola.add(clave);
    consolas.push(etiquetaDisponibilidad(etiqueta));
  }

  for (const raw of crudos) {
    const t = normalizar(raw);
    if (!t) continue;

    // Marcas / tiendas digitales
    if (
      t === 'steam'
      || t.includes('epic')
      || t === 'gog'
      || t.includes('microsoft store')
      || t.includes('app store')
      || t === 'android'
      || t === 'ios'
      || t === 'nintendo'
      || t === 'playstation'
      || t === 'xbox'
    ) {
      ponerTienda(raw);
      continue;
    }

    // Consolas / dispositivos
    if (
      t === 'pc'
      || t === 'windows'
      || t === 'mac'
      || t === 'macos'
      || t === 'linux'
      || t === 'movil'
      || t === 'mobile'
      || /^ps\d$/.test(t)
      || t.includes('playstation')
      || t.includes('vita')
      || t === 'psp'
      || t.includes('xbox')
      || /switch|wii|3ds|\bds\b|gamecube|n64|snes|\bnes\b|game boy/.test(t)
    ) {
      ponerConsola(raw);
    }
  }

  // Si hay Android/iOS como plataforma, la consola asociada es Móvil
  if ((vistosTienda.has('android') || vistosTienda.has('ios') || vistosTienda.has('appstore')) && !vistosConsola.has('movil')) {
    ponerConsola('Móvil');
  }

  return { tiendas, consolas };
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
    igdbRating: item.igdbRating ?? base?.igdbRating ?? null,
    jugadores: item.jugadores || base?.jugadores || '',
    requiereInternet: item.requiereInternet === true || base?.requiereInternet === true ? true : null,
    logoUrl: item.logoUrl || base?.logoUrl || null,
    hltbMain: item.hltbMain ?? base?.hltbMain ?? null,
    hltbMainExtra: item.hltbMainExtra ?? base?.hltbMainExtra ?? null,
    hltbCompletionist: item.hltbCompletionist ?? base?.hltbCompletionist ?? null,
    lanzamiento: item.lanzamiento || (item.anoLanzamiento ? `${item.anoLanzamiento}-01-01` : ''),
    etiqueta: item.etiqueta || '',
    ediciones: partir(item.ediciones || base?.ediciones),
    enlacesTienda: tiendas,
    ofertaMeta: item.ofertaMeta || base?.ofertaMeta || null,
    estado: base?.estado || 'PENDIENTE',
    etiquetas: base?.etiquetas || '',
    comentario: base?.comentario || '',
    calificacion: base?.calificacion || '',
    catalogId: item.id,
  };
}
