import { buscarFichas, buscarNintendoPorConsola, consolaEnUrlNintendo } from './fuentes.js';
import { esPortadaVerticalOptima, origenPortada, esCaratulaOficial } from './caratulas.js';
import { obtenerTendenciasCatalogo } from './catalogo-provider.js';

const POR_FILA = 25;
const PARA_TI = 25;
const TENDENCIAS = 25;

const CONSOLAS_NINTENDO = new Set([
  'Switch 2', 'Switch', 'Wii U', 'Wii', 'New 3DS', '3DS', 'DS',
  'GameCube', 'N64', 'SNES', 'NES', 'Game Boy Advance', 'Game Boy Color', 'Game Boy',
]);

const AFINES_NINTENDO = {
  'Switch 2': ['Zelda', 'Mario', 'Metroid', 'Kirby', 'Pokemon', 'Animal Crossing'],
  Switch: ['Zelda', 'Mario', 'Metroid', 'Kirby', 'Pokemon', 'Celeste', 'Ori', 'Hollow Knight'],
  'Wii U': ['Zelda', 'Mario', 'Kirby', 'Splatoon', 'Pikmin'],
  Wii: ['Zelda', 'Mario', 'Kirby', 'Metroid', 'Donkey Kong'],
  'New 3DS': ['Zelda', 'Mario', 'Pokemon', 'Fire Emblem', 'Metroid'],
  '3DS': ['Zelda', 'Mario', 'Pokemon', 'Kirby', 'Metroid'],
  DS: ['Zelda', 'Mario', 'Pokemon', 'Kirby', 'Metroid'],
  GameCube: ['Zelda', 'Mario', 'Metroid', 'Resident Evil', 'Sonic', 'Pikmin', 'Luigi', 'Star Fox', 'F-Zero', 'Animal Crossing'],
  N64: ['Zelda', 'Mario', 'Banjo', 'Perfect Dark', 'Paper Mario'],
  SNES: ['Zelda', 'Mario', 'Metroid', 'Donkey Kong', 'Super Metroid'],
  NES: ['Zelda', 'Mario', 'Metroid', 'Castlevania'],
  'Game Boy Advance': ['Zelda', 'Mario', 'Metroid', 'Pokemon', 'Fire Emblem'],
  'Game Boy Color': ['Zelda', 'Pokemon', 'Mario', 'Wario'],
  'Game Boy': ['Zelda', 'Mario', 'Metroid', 'Pokemon'],
};

/** Alias ES→EN y consultas Steam más útiles que la etiqueta cruda. */
const CONSULTA_ETIQUETA = {
  accion: 'action',
  action: 'action',
  aventura: 'adventure',
  adventure: 'adventure',
  indie: 'indie',
  plataformas: 'platformer',
  rpg: 'rpg',
  estrategia: 'strategy',
  strategy: 'strategy',
  terror: 'horror',
  horror: 'horror',
  simulacion: 'simulation',
  simulation: 'simulation',
};

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function partir(valor) {
  if (Array.isArray(valor)) return valor.map((item) => String(item).trim()).filter(Boolean);
  return String(valor || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function pesoJuego(juego) {
  if (juego.estado === 'ABANDONADO') return 0;
  if (juego.estado === 'JUGANDO') return 2;
  if (juego.estado === 'COMPLETADO') {
    const nota = Number(juego.calificacion) || 0;
    if (nota >= 4) return 3;
    if (nota >= 1) return 1;
    return 1;
  }
  if (juego.estado === 'PENDIENTE') return 0.35;
  return 0;
}

/** Fila de exploración: consolas Nintendo concretas; resto por familia. */
function claveFila(marca) {
  const texto = String(marca || '').toLowerCase().trim();
  if (!texto) return '';

  if (texto.includes('switch 2')) return 'Switch 2';
  if (texto.includes('switch')) return 'Switch';
  if (texto.includes('wii u')) return 'Wii U';
  if (texto === 'wii' || /(^|[^a-z])wii([^a-z]|$)/.test(texto)) return 'Wii';
  if (texto.includes('new 3ds') || texto.includes('new nintendo 3ds')) return 'New 3DS';
  if (texto.includes('3ds')) return '3DS';
  if (texto.includes('nintendo ds') || texto === 'ds' || /(^|[^a-z])ds([^a-z]|$)/.test(texto)) return 'DS';
  if (texto.includes('gamecube') || texto.includes('game cube')) return 'GameCube';
  if (/\bn64\b|nintendo\s*64/.test(texto)) return 'N64';
  if (texto.includes('super nintendo') || /\bsnes\b/.test(texto)) return 'SNES';
  if (/\bnes\b|entertainment system/.test(texto) && !texto.includes('genesis')) return 'NES';
  if (texto.includes('game boy advance') || texto.includes('gameboy advance') || /\bgba\b/.test(texto)) return 'Game Boy Advance';
  if (texto.includes('game boy color') || texto.includes('gameboy color')) return 'Game Boy Color';
  if (texto.includes('game boy') || texto.includes('gameboy')) return 'Game Boy';

  if (texto.startsWith('ps') || texto.includes('playstation') || texto.includes('vita') || texto === 'psp') return 'PlayStation';
  if (texto.includes('xbox')) return 'Xbox';
  if (texto.includes('ios') || texto.includes('android') || texto.includes('app store') || texto.includes('móvil') || texto.includes('movil')) return 'Móvil';
  if (/steam|epic|windows|linux|\bmac\b|macintosh|\bpc\b|microsoft/.test(texto)) return 'PC';
  return '';
}

function fuenteParaClave(clave) {
  if (clave === 'PC') return 'steam';
  if (clave === 'Móvil') return 'apple';
  if (clave === 'PlayStation') return 'playstation';
  if (clave === 'Xbox') return 'microsoft';
  if (CONSOLAS_NINTENDO.has(clave)) return 'nintendo';
  return 'steam';
}

function marcasPropias(juego) {
  const propias = partir(juego.plataformas);
  if (propias.length) return propias;
  return partir(juego.sistemas);
}

function marcasItem(item) {
  return [...partir(item.donde), ...partir(item.plataformas), ...partir(item.sistemas)];
}

function perteneceAFila(item, clave) {
  if (clave === 'PC') {
    return marcasItem(item).some((m) => claveFila(m) === 'PC') || Boolean(item.steamAppId);
  }
  if (clave === 'Móvil' || clave === 'PlayStation' || clave === 'Xbox') {
    return marcasItem(item).some((m) => claveFila(m) === clave);
  }
  const donde = [...partir(item.donde), ...partir(item.plataformas)];
  if (donde.some((m) => claveFila(m) === clave)) return true;
  return false;
}

/** La carátula debe ser de la misma tienda/consola que la fila. */
function portadaAcordeFila(item, clave) {
  const url = item.portada || item.urlPortada || '';
  if (!url || !esCaratulaOficial(url) && !esPortadaVerticalOptima(url) && !/mzstatic\.com|nintendo\.com/i.test(url)) {
    // permitir mzstatic/nintendo aunque el helper estricto falle en migration
    if (!/nintendo\.com|mzstatic\.com|library_600x900|playstation\.|store-images\.s-microsoft/i.test(url)) return false;
  }
  const origen = origenPortada(url);

  if (CONSOLAS_NINTENDO.has(clave)) {
    if (origen !== 'nintendo') return false;
    const hint = consolaEnUrlNintendo(url);
    // Si la URL tipifica otra consola, rechazar
    if (hint && hint !== clave) {
      // Switch 2 vs Switch: Switch 2 hint might be Switch — allow Switch 2 URL for Switch 2 only
      if (clave === 'Switch 2' && hint === 'Switch' && /switch\s*2|switch2|switch_2/i.test(url)) return true;
      if (clave === 'Switch' && hint === 'Switch') return true;
      return false;
    }
    return true;
  }
  if (clave === 'PC') return origen === 'steam' || (/library_600x900/i.test(url));
  if (clave === 'Móvil') return origen === 'apple';
  if (clave === 'PlayStation') return origen === 'playstation';
  if (clave === 'Xbox') return origen === 'xbox';
  return true;
}

function serieDe(titulo) {
  return String(titulo || '')
    .split(':')[0]
    .replace(/\b(part|parte)\s+[ivx0-9]+\b/gi, '')
    .replace(/\b(remastered|remaster|remake|definitive(?:\s+edition)?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function esEdicionPropia(titulo, propios) {
  const nombre = normalizar(titulo);
  for (const propio of propios) {
    if (nombre === propio) return true;
    const corto = nombre.length < propio.length ? nombre : propio;
    const largo = nombre.length < propio.length ? propio : nombre;
    if (largo.startsWith(`${corto} `) && /remaster|remake|definitiv|deluxe|edition|goty/.test(largo)) return true;
  }
  return false;
}

function etiquetasDe(juego) {
  return [...partir(juego.generos), ...partir(juego.etiquetas)].map(normalizar).filter(Boolean);
}

export function perfilDeGusto(juegos) {
  const etiquetas = new Map();
  const estudios = new Map();
  const familias = new Map();
  const propios = new Set();
  const semillas = [];

  for (const juego of juegos) {
    const peso = pesoJuego(juego);
    propios.add(normalizar(juego.tituloJuego));
    for (const clave of new Set(marcasPropias(juego).map(claveFila).filter(Boolean))) {
      familias.set(clave, (familias.get(clave) || 0) + Math.max(peso, 0.25));
    }
    if (peso <= 0) continue;
    semillas.push(juego);
    for (const etiqueta of etiquetasDe(juego)) {
      etiquetas.set(etiqueta, (etiquetas.get(etiqueta) || 0) + peso);
    }
    const estudio = String(juego.desarrollador || '').trim();
    if (estudio.length >= 2) estudios.set(estudio, (estudios.get(estudio) || 0) + peso);
  }

  if (semillas.length === 0) {
    for (const juego of juegos.slice(0, 3)) semillas.push(juego);
  } else {
    for (const juego of juegos) {
      if (juego.estado === 'COMPLETADO' && !semillas.includes(juego)) semillas.push(juego);
    }
  }

  semillas.sort((a, b) => pesoJuego(b) - pesoJuego(a));
  const vistosSemilla = new Set();
  const semillasUnicas = semillas.filter((juego) => {
    const id = juego.id || normalizar(juego.tituloJuego);
    if (vistosSemilla.has(id)) return false;
    vistosSemilla.add(id);
    return true;
  }).slice(0, 5);

  const etiquetasTop = [...etiquetas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const estudioTop = [...estudios.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const familiasTop = [...familias.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([clave]) => clave);

  return { etiquetas, etiquetasTop, estudios, estudioTop, familiasTop, propios, semillas: semillasUnicas };
}

function conPortada(ficha) {
  const url = ficha.portada || ficha.urlPortada || '';
  if (!url) return false;
  if (/\/03_teaser_module|artworkUrl100|100x100|gc_default|default_en/i.test(url)) return false;
  if (ficha.portadaVertical || esPortadaVerticalOptima(url) || esCaratulaOficial(url)) return true;
  if (/mzstatic\.com/.test(url) && !/100x100|artworkUrl100/i.test(url)) return true;
  if (/nintendo\.com/.test(url) && (/\/05_packshots\//.test(url) || (/\/portrait\//.test(url) && !/default/i.test(url)))) return true;
  return false;
}

function esBasura(titulo) {
  const t = String(titulo || '');
  if (/\b(friend'?s pass|demo|soundtrack|ost|dlc|upgrade|trial|teaser|playtest|prologue|box simulator|the movie|gameplay recording|streaming|wallpaper engine|wallpaper|sdk|server|dedicated server|benchmark)\b/i.test(t)) return true;
  if (/brawl stars/i.test(t) && !/^brawl stars$/i.test(t.trim())) return true;
  return false;
}

function serieClave(titulo) {
  return normalizar(serieDe(titulo));
}

function puntuarCandidato(ficha, perfil, base = 2) {
  let puntos = base;
  if (ficha._porEtiqueta) puntos -= 0.5;
  const generos = new Set(partir(ficha.generos).map(normalizar));
  for (const [etiqueta, peso] of perfil.etiquetasTop) {
    const alias = CONSULTA_ETIQUETA[etiqueta] || etiqueta;
    if (generos.has(etiqueta) || generos.has(alias)) puntos += 2 * peso;
  }
  const estudio = String(ficha.desarrollador || '').trim();
  if (estudio && perfil.estudios.has(estudio)) puntos += 4 * (perfil.estudios.get(estudio) || 1);
  const filasItem = new Set(marcasItem(ficha).map(claveFila).filter(Boolean));
  for (const clave of perfil.familiasTop) {
    if (filasItem.has(clave)) puntos += 1.5;
  }
  return puntos;
}

function hashSeed(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function barajar(lista, seedTexto) {
  const salida = [...lista];
  let estado = hashSeed(String(seedTexto || Date.now()));
  for (let i = salida.length - 1; i > 0; i -= 1) {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    const j = estado % (i + 1);
    [salida[i], salida[j]] = [salida[j], salida[i]];
  }
  return salida;
}

async function buscarCandidatos(perfil) {
  const consultas = [];
  const vistas = new Set();

  function agregar(q, fuente, porEtiqueta = false) {
    const texto = String(q || '').trim();
    if (texto.length < 2) return;
    const clave = `${fuente}:${normalizar(texto)}:${porEtiqueta ? 'e' : 't'}`;
    if (vistas.has(clave) || consultas.length >= 24) return;
    vistas.add(clave);
    consultas.push({ q: texto, fuente, porEtiqueta });
  }

  const clavesEtiqueta = new Set(perfil.etiquetasTop.map(([nombre]) => nombre));
  const perfilPlataformas = clavesEtiqueta.has('plataformas')
    || (clavesEtiqueta.has('indie') && (clavesEtiqueta.has('aventura') || clavesEtiqueta.has('adventure') || clavesEtiqueta.has('action') || clavesEtiqueta.has('accion')));

  for (const juego of perfil.semillas.slice(0, 4)) {
    const serie = serieDe(juego.tituloJuego);
    const fuente = fuenteParaClave(claveFila(marcasPropias(juego)[0] || '')) || 'steam';
    agregar(serie, fuente, false);
  }

  if (perfilPlataformas) {
    agregar('platformer', 'steam', true);
    agregar('metroidvania', 'steam', true);
  }
  for (const [etiqueta] of perfil.etiquetasTop.slice(0, 2)) {
    const q = CONSULTA_ETIQUETA[etiqueta];
    if (!q || q.length < 4) continue;
    agregar(q, 'steam', true);
  }

  for (const clave of perfil.familiasTop) {
    const fuente = fuenteParaClave(clave);
    const semillasFam = perfil.semillas.filter((juego) => marcasPropias(juego).some((m) => claveFila(m) === clave));
    for (const juego of semillasFam.slice(0, 1)) {
      agregar(serieDe(juego.tituloJuego), fuente, false);
    }
    if (fuente === 'apple') {
      agregar('action', 'apple', true);
      agregar('adventure', 'apple', true);
      for (const juego of semillasFam.slice(0, 1)) agregar(serieDe(juego.tituloJuego), 'apple', true);
    } else if (CONSOLAS_NINTENDO.has(clave)) {
      const afines = AFINES_NINTENDO[clave] || ['Zelda', 'Mario', 'Metroid', 'Kirby'];
      for (const q of afines) agregar(q, 'nintendo', false);
      // Ampliación sin cercanía estricta para rellenar ~25 por consola
      agregar(clave === 'Game Boy Advance' ? 'Game Boy' : clave, 'nintendo', true);
      agregar('Nintendo', 'nintendo', true);
    } else if (fuente === 'steam') {
      agregar('indie', 'steam', true);
      agregar('adventure', 'steam', true);
    } else if (fuente === 'playstation' || fuente === 'microsoft') {
      for (const juego of perfil.semillas.slice(0, 2)) agregar(serieDe(juego.tituloJuego), fuente, false);
    }
  }

  const listas = await Promise.all(consultas.map(async ({ q, fuente, porEtiqueta }) => {
    try {
      const crudas = await buscarFichas(q, 20, fuente, { porEtiqueta });
      const boostTag = porEtiqueta && (q === 'platformer' || q === 'metroidvania') ? 5 : porEtiqueta ? 2.2 : 3.5;
      return crudas.map((f) => ({ ...f, _porEtiqueta: porEtiqueta, _boost: boostTag }));
    } catch {
      return [];
    }
  }));

  // Catálogo por consola Nintendo (relleno real de Switch/GameCube/N64…)
  const porConsola = await Promise.all(
    perfil.familiasTop.filter((c) => CONSOLAS_NINTENDO.has(c)).map(async (consola) => {
      try {
        const fichas = await buscarNintendoPorConsola(consola, 30);
        return fichas.map((f) => ({ ...f, _porEtiqueta: false, _boost: 4 }));
      } catch {
        return [];
      }
    }),
  );

  const porTitulo = new Map();
  for (const ficha of [...listas.flat(), ...porConsola.flat()]) {
    if (!conPortada(ficha) || esBasura(ficha.titulo)) continue;
    if (esEdicionPropia(ficha.titulo, perfil.propios)) continue;
    const clave = normalizar(ficha.titulo);
    if (!clave) continue;
    const puntos = puntuarCandidato(ficha, perfil, ficha._boost || 2);
    const previa = porTitulo.get(clave);
    if (!previa || puntos > previa._puntos) {
      porTitulo.set(clave, {
        ...ficha,
        urlPortada: ficha.portada,
        portadaVertical: Boolean(ficha.portadaVertical || esPortadaVerticalOptima(ficha.portada) || /mzstatic\.com/.test(ficha.portada || '')),
        _puntos: puntos,
        _serie: serieClave(ficha.titulo),
      });
    }
  }

  const porSerie = new Map();
  const diversos = [];
  for (const item of [...porTitulo.values()].sort((a, b) => b._puntos - a._puntos)) {
    if (item._puntos < 2) continue;
    const serie = item._serie || normalizar(item.titulo) || '_';
    const n = porSerie.get(serie) || 0;
    if (n >= 5) continue;
    porSerie.set(serie, n + 1);
    diversos.push(item);
  }
  return diversos;
}

function repartir(pool, perfil, seed) {
  const cupos = new Map(perfil.familiasTop.map((clave) => [clave, []]));
  const resto = [];
  for (const item of pool) {
    const clave = perfil.familiasTop.find(
      (f) => perteneceAFila(item, f) && portadaAcordeFila(item, f) && (cupos.get(f) || []).length < POR_FILA + 5,
    );
    if (clave) cupos.get(clave).push(item);
    else resto.push(item);
  }
  const reservados = perfil.familiasTop.flatMap((clave) => cupos.get(clave) || []);
  const mezclado = barajar([...reservados, ...resto.slice(0, 60)], seed);
  const usados = new Set(perfil.propios);
  const tomar = (lista, limite, filtro, maxPorSerie = 2) => {
    const salida = [];
    const series = new Map();
    for (const item of lista) {
      const clave = normalizar(item.titulo);
      if (!clave || usados.has(clave)) continue;
      if (filtro && !filtro(item)) continue;
      const serie = item._serie || serieClave(item.titulo);
      const nSerie = series.get(serie) || 0;
      if (nSerie >= maxPorSerie) continue;
      usados.add(clave);
      series.set(serie, nSerie + 1);
      salida.push(item);
      if (salida.length >= limite) break;
    }
    return salida;
  };

  const porFamilia = perfil.familiasTop.map((clave) => {
    const sugeridos = tomar(
      mezclado,
      POR_FILA,
      (item) => perteneceAFila(item, clave) && portadaAcordeFila(item, clave),
      CONSOLAS_NINTENDO.has(clave) ? 4 : 3,
    );
    return { familia: clave, nombre: clave, sugeridos };
  }).filter((fila) => fila.sugeridos.length > 0);

  const paraTi = tomar(mezclado, PARA_TI, null, 2);

  let estudio = null;
  if (perfil.estudioTop && perfil.estudioTop[1] >= 2) {
    const nombre = perfil.estudioTop[0];
    const sugeridos = tomar(mezclado, POR_FILA, (item) => normalizar(item.desarrollador) === normalizar(nombre), 3);
    if (sugeridos.length) estudio = { nombre, sugeridos };
  }

  return { paraTi, porFamilia, estudio };
}

export async function armarSugerenciasInicio(juegos, headers = {}, seed = '') {
  const perfil = perfilDeGusto(juegos);
  const seedFinal = seed || `${Date.now()}-${Math.random()}`;

  const [pool, tendenciasCrudas] = await Promise.all([
    perfil.semillas.length ? buscarCandidatos(perfil) : Promise.resolve([]),
    obtenerTendenciasCatalogo(headers).catch(() => []),
  ]);

  const { paraTi, porFamilia, estudio } = repartir(pool, perfil, seedFinal);

  const usadosPropios = new Set(perfil.propios);

  const tendenciasPool = (tendenciasCrudas || [])
    .filter((item) => conPortada({ portada: item.urlPortada || item.portada, portadaVertical: item.portadaVertical }))
    .filter((item) => !esEdicionPropia(item.titulo, usadosPropios));
  const tendencias = barajar(tendenciasPool, `tend-${seedFinal}`).slice(0, TENDENCIAS);

  return {
    seed: seedFinal,
    etiquetasTop: perfil.etiquetasTop.map(([nombre, peso]) => ({ nombre, peso })),
    familiasTop: perfil.familiasTop,
    paraTi,
    porFamilia,
    estudio,
    tendencias,
  };
}
