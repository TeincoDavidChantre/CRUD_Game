import { buscarCaratulaVertical, caratulaSteam } from './caratulas.js';

const CABECERAS = {
  'User-Agent': 'GameTracker/1.0 (catalogo local de videojuegos)',
  Accept: 'application/json',
};

const cacheFichas = new Map();
const ORDEN_DONDE = [
  'PS5', 'PS4', 'PS3', 'PS Vita', 'PSP', 'PS2',
  'Xbox Series X|S', 'Xbox One', 'Xbox 360', 'Xbox',
  'Switch 2', 'Switch', 'Wii U', 'Wii', 'New 3DS', '3DS', 'DS', 'GameCube', 'N64', 'SNES', 'NES', 'Game Boy Advance', 'Game Boy Color', 'Game Boy',
  'Steam', 'Epic Games', 'App Store', 'Microsoft Store',
];
const ORDEN_SISTEMAS = ['PlayStation', 'Xbox', 'Nintendo', 'Windows', 'Linux', 'Mac', 'Android', 'iOS'];

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cercania(titulo, consulta) {
  const nombre = normalizar(titulo);
  const q = normalizar(consulta);
  if (!nombre || !q) return 3;
  if (nombre === q) return 0;
  const palabras = nombre.split(' ');
  const buscadas = q.split(' ').filter(Boolean);
  if (nombre.startsWith(`${q} `)) return 1;
  if (buscadas.every((palabra) => palabras.includes(palabra))) return 2;
  return 3;
}

function nota(valor) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 100) return null;
  return numero;
}

function textoPlano(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function leerJson(url, headers = CABECERAS) {
  const respuesta = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!respuesta.ok) return null;
  return respuesta.json();
}

function fichaVacia(parcial) {
  return {
    id: '',
    titulo: '',
    portada: '',
    descripcion: '',
    plataformas: [],
    generos: [],
    lanzamiento: '',
    metacritic: null,
    desarrollador: '',
    editor: '',
    donde: [],
    sistemas: [],
    tiendas: [],
    ediciones: [],
    steamAppId: '',
    orden: 50,
    portadaVertical: false,
    origenDescripcion: 'tienda',
    anioFuente: 'tienda',
    desarrolladorFuente: '',
    enriquecida: false,
    ...parcial,
  };
}

function anioNumero(valor) {
  const match = String(valor || '').match(/\b(?:19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function lanzamientoElegido(actual, extra) {
  const deTienda = [actual, extra].filter((ficha) => ficha.anioFuente !== 'wiki' && anioNumero(ficha.lanzamiento) != null);
  const lista = deTienda.length ? deTienda : [actual, extra].filter((ficha) => anioNumero(ficha.lanzamiento) != null);
  if (!lista.length) return actual.lanzamiento || extra.lanzamiento || '';
  return lista.reduce((mejor, ficha) => (anioNumero(ficha.lanzamiento) < anioNumero(mejor.lanzamiento) ? ficha : mejor)).lanzamiento;
}

function describir(actual, extra) {
  const rango = (origen) => (origen === 'steam' ? 3 : origen === 'wiki' ? 2 : 1);
  if (rango(actual.origenDescripcion) !== rango(extra.origenDescripcion)) {
    return rango(actual.origenDescripcion) > rango(extra.origenDescripcion) ? actual : extra;
  }
  return (extra.descripcion || '').length > (actual.descripcion || '').length ? extra : actual;
}

function desarrolladorElegido(actual, extra) {
  if (extra.desarrolladorFuente === 'steam' && extra.desarrollador) return extra;
  if (actual.desarrolladorFuente === 'steam' && actual.desarrollador) return actual;
  return actual.desarrollador ? actual : extra;
}

function ordenar(etiquetas, orden) {
  const unicas = [...new Set((etiquetas || []).filter(Boolean))];
  const conocidas = orden.filter((etiqueta) => unicas.includes(etiqueta));
  const resto = unicas.filter((etiqueta) => !orden.includes(etiqueta));
  return [...conocidas, ...resto];
}

function separarEdicion(titulo) {
  const limpio = String(titulo || '').replace(/[®™]/g, '').replace(/\s+/g, ' ').trim();
  if (/\b(upgrade|soundtrack|demo|dlc|add-on|addon|teaser|trial|marketplace|skin|texture|mash-?up|resource pack|map pack)\b/i.test(limpio)) {
    return { base: '', edicion: '', descartar: true };
  }
  const match = limpio.match(/\s*[-:]?\s*((?:digital\s+deluxe|deluxe|ultimate|gold|complete|goty|game of the year)\s+edition|digital\s+deluxe)\s*$/i);
  if (/\bpack\b/i.test(limpio) && !/\b(party|starter) pack\b/i.test(limpio)) {
    return { base: '', edicion: '', descartar: true };
  }
  if (!match) return { base: limpio, edicion: '', descartar: false };
  const base = limpio.slice(0, match.index).replace(/[\s:-]+$/, '').trim();
  const clave = match[1].toLowerCase().replace(/\s+edition$/, '').trim();
  const nombres = {
    'digital deluxe': 'Digital Deluxe',
    deluxe: 'Deluxe',
    ultimate: 'Ultimate',
    gold: 'Gold',
    complete: 'Complete',
    goty: 'GOTY',
    'game of the year': 'Game of the Year',
  };
  return { base, edicion: nombres[clave] || match[1], descartar: !base };
}

function fichaDe(parcial) {
  const separado = separarEdicion(parcial.titulo);
  if (separado.descartar || !separado.base) return null;
  const donde = ordenar(parcial.donde || parcial.plataformas || [], ORDEN_DONDE);
  const sistemas = ordenar(parcial.sistemas || [], ORDEN_SISTEMAS);
  return fichaVacia({
    ...parcial,
    titulo: separado.base,
    ediciones: separado.edicion ? [separado.edicion] : [],
    donde,
    sistemas,
    plataformas: donde,
  });
}

function etiquetaPlay(nombre) {
  const limpio = String(nombre || '').replace(/[®™]/g, '').trim();
  if (/^PS5/i.test(limpio)) return 'PS5';
  if (/^PS4/i.test(limpio)) return 'PS4';
  if (/^PS3/i.test(limpio)) return 'PS3';
  if (/^PS2/i.test(limpio)) return 'PS2';
  if (/vita/i.test(limpio)) return 'PS Vita';
  if (/^PSP/i.test(limpio)) return 'PSP';
  return limpio;
}

function etiquetaNintendo(nombre) {
  const texto = String(nombre || '').toLowerCase();
  if (texto.includes('switch 2')) return 'Switch 2';
  if (texto.includes('switch')) return 'Switch';
  if (texto.includes('wii u')) return 'Wii U';
  if (texto === 'wii' || texto.endsWith(' wii')) return 'Wii';
  if (texto.includes('new nintendo 3ds') || texto.includes('new 3ds')) return 'New 3DS';
  if (texto.includes('3ds')) return '3DS';
  if (texto.includes('nintendo ds') || texto === 'ds') return 'DS';
  if (texto.includes('gamecube')) return 'GameCube';
  if (texto.includes('64')) return 'N64';
  if (texto.includes('super nintendo') || texto.includes('snes')) return 'SNES';
  if (texto.includes('entertainment system') || texto.includes('nes')) return 'NES';
  if (texto.includes('game boy advance') || texto.includes('gameboy advance')) return 'Game Boy Advance';
  if (texto.includes('game boy color')) return 'Game Boy Color';
  if (texto.includes('game boy')) return 'Game Boy';
  return String(nombre || '').replace(/^Nintendo\s+/i, '').trim();
}

function separarMicrosoft(texto) {
  const origen = String(texto || '');
  const donde = [];
  const sistemas = [];
  if (/series/i.test(origen)) donde.push('Xbox Series X|S');
  if (/xbox one/i.test(origen)) donde.push('Xbox One');
  if (/360/i.test(origen)) donde.push('Xbox 360');
  if (/xbox/i.test(origen) && donde.length === 0) donde.push('Xbox');
  if (donde.some((etiqueta) => String(etiqueta).startsWith('Xbox'))) sistemas.push('Xbox');
  if (/\bpc\b|windows/i.test(origen)) {
    donde.push('Microsoft Store');
    sistemas.push('Windows');
  }
  return { donde, sistemas };
}

function puntajePortada(url) {
  const s = String(url || '');
  if (/library_600x900/.test(s)) return 6;
  if (/nintendo\.com/.test(s) && s.includes('/05_packshots/')) return 5;
  if (/nintendo\.com/.test(s) && /\/migration\/.*\/portrait\//.test(s) && !/default/i.test(s)) return 4;
  if (/store-images\.s-microsoft\.com/.test(s)) return 4;
  if (/playstation\.(net|com)/.test(s)) return 3;
  if (/mzstatic\.com/.test(s) && !/100x100|artworkUrl100/i.test(s)) return 2;
  if (/steamstatic\.com/.test(s)) return 2;
  if (/wikimedia\.org/.test(s)) return 1;
  return 0;
}

function elegirPortadaFicha(actual, extra) {
  // No pisar packshot Nintendo con caja Steam de otro producto/consola
  const origenA = /nintendo\.com/i.test(actual.portada || '') ? 'nintendo' : '';
  const origenE = /nintendo\.com/i.test(extra.portada || '') ? 'nintendo' : '';
  if (origenA === 'nintendo' && origenE !== 'nintendo' && actual.portadaVertical) return actual;
  if (origenE === 'nintendo' && origenA !== 'nintendo' && extra.portadaVertical) return extra;
  if (extra.portada && extra.portadaVertical && !actual.portadaVertical) return extra;
  if (actual.portada && actual.portadaVertical && !extra.portadaVertical) return actual;
  if (!actual.portada) return extra;
  if (!extra.portada) return actual;
  return puntajePortada(extra.portada) > puntajePortada(actual.portada) ? extra : actual;
}

function puntajeCercania(titulo, consulta, tiendas) {
  const nombre = normalizar(titulo);
  const q = normalizar(consulta);
  let puntos = 40;
  if (nombre === q) puntos = 100;
  else if (nombre.startsWith(`${q} `)) puntos = 80;
  else if (nombre.startsWith(q)) puntos = 70;
  if ((tiendas || []).length >= 2) puntos += 15;
  return puntos;
}

function unir(actual, extra) {
  const donde = ordenar([...(actual.donde || actual.plataformas || []), ...(extra.donde || extra.plataformas || [])], ORDEN_DONDE);
  const sistemas = ordenar([...(actual.sistemas || []), ...(extra.sistemas || [])], ORDEN_SISTEMAS);
  const plataformas = donde;
  const tiendas = [...new Set([...actual.tiendas, ...extra.tiendas])];
  const ediciones = [...new Set([...(actual.ediciones || []), ...(extra.ediciones || [])])];
  const generos = [...new Set([...actual.generos, ...extra.generos])].slice(0, 6);
  const portadaFicha = elegirPortadaFicha(actual, extra);
  const texto = describir(actual, extra);
  const estudio = desarrolladorElegido(actual, extra);
  const id = actual.steamAppId || extra.steamAppId
    ? `steam:${actual.steamAppId || extra.steamAppId}`
    : (puntajePortada(actual.portada) >= puntajePortada(extra.portada) ? actual.id : extra.id);
  return fichaVacia({
    ...actual,
    id,
    titulo: actual.titulo.length <= extra.titulo.length ? actual.titulo : extra.titulo,
    portada: portadaFicha.portada || '',
    portadaVertical: Boolean(portadaFicha.portada && portadaFicha.portadaVertical),
    descripcion: texto.descripcion || '',
    origenDescripcion: texto.origenDescripcion || 'tienda',
    plataformas,
    donde,
    sistemas,
    generos,
    ediciones,
    lanzamiento: lanzamientoElegido(actual, extra),
    anioFuente: [actual, extra].some((ficha) => ficha.anioFuente !== 'wiki' && anioNumero(ficha.lanzamiento) != null) ? 'tienda' : (actual.anioFuente || extra.anioFuente),
    metacritic: actual.metacritic || extra.metacritic,
    desarrollador: estudio.desarrollador || '',
    desarrolladorFuente: estudio.desarrolladorFuente || '',
    editor: actual.editor || extra.editor,
    tiendas,
    steamAppId: actual.steamAppId || extra.steamAppId,
    orden: Math.min(actual.orden ?? 50, extra.orden ?? 50),
    enriquecida: false,
  });
}

async function buscarSteam(q, tope, sinCercania = false) {
  const [tienda, comunidad] = await Promise.all([
    leerJson(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=us`),
    leerJson(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(q)}`),
  ]);
  const porId = new Map();
  for (const item of tienda?.items || []) {
    if (item.type === 'app') porId.set(String(item.id), { id: item.id, name: item.name, metascore: item.metascore });
  }
  for (const item of Array.isArray(comunidad) ? comunidad : []) {
    const id = String(item.appid || '');
    if (id && !porId.has(id)) porId.set(id, { id, name: item.name, metascore: null });
  }
  const items = [...porId.values()].filter((item) => sinCercania || cercania(item.name, q) <= 2).slice(0, tope);
  const fichas = await Promise.all(items.map(async (item, index) => {
    const portada = await caratulaSteam(item.id);
    return fichaDe({
      id: `steam:${item.id}`,
      titulo: item.name,
      portada,
      portadaVertical: Boolean(portada),
      donde: ['Steam'],
      metacritic: nota(item.metascore),
      tiendas: ['Steam'],
      steamAppId: String(item.id),
      orden: index,
    });
  }));
  return fichas.filter(Boolean);
}

/** IDs de tags Steam Store (browse topsellers, no coincidencia de título). */
const TAG_STEAM = {
  indie: 492,
  action: 19,
  adventure: 21,
  rpg: 122,
  strategy: 9,
  simulation: 599,
  casual: 597,
  racing: 699,
  sports: 701,
  platformer: 1625,
  metroidvania: 1628,
  horror: 1667,
  multiplayer: 3859,
};

async function buscarSteamPorTag(etiqueta, tope) {
  const clave = normalizar(etiqueta).replace(/\s+/g, '');
  const tagId = TAG_STEAM[clave] || TAG_STEAM[normalizar(etiqueta).split(' ')[0]];
  if (!tagId) return buscarSteam(etiqueta, tope, true);
  const url = `https://store.steampowered.com/search/results/?query=&start=0&count=${Math.min(tope * 2, 40)}&tags=${tagId}&filter=globaltopsellers&category1=998&infinite=1`;
  const datos = await leerJson(url).catch(() => null);
  const html = String(datos?.results_html || '');
  const vistos = new Set();
  const items = [];
  for (const match of html.matchAll(/data-ds-appid="(\d+)"[^>]*>[\s\S]*?class="title">([^<]+)/g)) {
    const id = match[1];
    if (vistos.has(id)) continue;
    vistos.add(id);
    items.push({ id, name: match[2].trim() });
    if (items.length >= tope) break;
  }
  if (items.length === 0) {
    // Fallback: ids sueltos si el HTML cambia de forma
    for (const match of html.matchAll(/data-ds-appid="(\d+)"/g)) {
      const id = match[1];
      if (vistos.has(id)) continue;
      vistos.add(id);
      items.push({ id, name: '' });
      if (items.length >= tope) break;
    }
  }
  const fichas = await Promise.all(items.map(async (item, index) => {
    const portada = await caratulaSteam(item.id);
    let titulo = item.name;
    if (!titulo) {
      const detalle = await detalleSteam(item.id).catch(() => null);
      if (!detalle) return null;
      return { ...detalle, orden: index };
    }
    return fichaDe({
      id: `steam:${item.id}`,
      titulo,
      portada,
      portadaVertical: Boolean(portada),
      donde: ['Steam'],
      tiendas: ['Steam'],
      steamAppId: String(item.id),
      orden: index,
    });
  }));
  return fichas.filter(Boolean);
}

async function buscarMicrosoft(q, tope) {
  const datos = await leerJson(`https://storeedgefd.dsx.mp.microsoft.com/v9.0/pages/searchResults?market=US&locale=en-US&deviceFamily=Windows.Desktop&query=${encodeURIComponent(q)}&mediaType=games`);
  const payload = (Array.isArray(datos) ? datos : []).map((item) => item.Payload).find((item) => Array.isArray(item?.SearchResults));
  const juegos = (payload?.SearchResults || []).filter((item) => cercania(item.Title, q) <= 2).slice(0, tope);
  return juegos.map((item, index) => {
    const poster = (item.Images || []).find((img) => img.ImageType === 'Poster');
    const imagen = poster || (item.Images || []).find((img) => img.ImageType === 'BoxArt');
    const portada = imagen?.Url ? (imagen.Url.startsWith('http') ? imagen.Url : `https:${imagen.Url}`) : '';
    if (!/store-images\.s-microsoft\.com/.test(portada)) return null;
    const dispositivos = `${item.AvailableDevicesNarratorText || ''} ${item.AvailableDevicesDisplayText || ''}`;
    const { donde, sistemas } = separarMicrosoft(dispositivos);
    if (donde.length === 0) return null;
    const tiendas = [];
    if (sistemas.includes('Xbox')) tiendas.push('Xbox');
    if (sistemas.includes('Windows')) tiendas.push('Microsoft Store');
    return fichaDe({
      id: `ms:${item.ProductId}`,
      titulo: item.Title,
      portada,
      portadaVertical: Boolean(poster),
      descripcion: textoPlano(item.LongDescription).slice(0, 1200),
      donde,
      sistemas,
      lanzamiento: String(item.ReleaseDate || '').slice(0, 10),
      desarrollador: item.PublisherName || '',
      tiendas,
      orden: index,
    });
  }).filter(Boolean);
}

async function buscarNintendo(q, tope, sinCercania = false) {
  const datos = await leerJson(`https://searching.nintendo-europe.com/en/select?q=${encodeURIComponent(q)}&fq=type:GAME&rows=${Math.max(tope, 20)}&wt=json`);
  return (datos?.response?.docs || [])
    .filter((doc) => sinCercania || cercania(doc.title, q) <= 2)
    .slice(0, tope)
    .map((doc, index) => fichaNintendoDeDoc(doc, index))
    .filter(Boolean);
}

const SISTEMA_NINTENDO_FQ = {
  'Switch 2': 'Nintendo Switch 2',
  Switch: 'Nintendo Switch',
  'Wii U': 'Wii U',
  Wii: 'Wii',
  'New 3DS': 'New Nintendo 3DS',
  '3DS': 'Nintendo 3DS',
  DS: 'Nintendo DS',
  GameCube: 'Nintendo GameCube',
  N64: 'Nintendo 64',
  SNES: 'Super Nintendo Entertainment System',
  NES: 'NES',
  'Game Boy Advance': 'Game Boy Advance',
  'Game Boy Color': 'Game Boy Color',
  'Game Boy': 'Game Boy',
};

function portadaNintendoOk(url) {
  const img = String(url || '');
  if (!img.startsWith('https://www.nintendo.com/')) return false;
  if (/\/03_teaser_module|\/TM_/i.test(img)) return false; // teasers cuadrados / borrosos al ampliar
  if (img.includes('/05_packshots/')) return true;
  if (img.includes('/migration/games_7/packshot/') && img.includes('/portrait/') && !/default/i.test(img)) return true;
  return false;
}

/** Hint de consola en la URL del packshot Nintendo (evita caja Switch en fila GameCube). */
export function consolaEnUrlNintendo(url) {
  const u = String(url || '').toLowerCase();
  if (/switch[_2]|switch2|nsw/.test(u)) return 'Switch';
  if (/wii[_]?u|wiiu/.test(u)) return 'Wii U';
  if (/\/wii_|_wii_|\/wii\//.test(u) && !/wii[_]?u/.test(u)) return 'Wii';
  if (/new[_]?3ds|n3ds/.test(u)) return 'New 3DS';
  if (/3ds/.test(u)) return '3DS';
  if (/\/nds_|_nds_|nintendo[_]?ds|\bds_/.test(u)) return 'DS';
  if (/gamecube|\/gcn_|_gcn_|\/gc_/.test(u)) return 'GameCube';
  if (/n64|nintendo[_]?64/.test(u)) return 'N64';
  if (/snes|super[_]?nintendo/.test(u)) return 'SNES';
  if (/\bnes\b|\/nes_/.test(u)) return 'NES';
  if (/game[_]?boy[_]?advance|\/gba_/.test(u)) return 'Game Boy Advance';
  if (/game[_]?boy[_]?color|\/gbc_/.test(u)) return 'Game Boy Color';
  if (/game[_]?boy|\/gb_/.test(u)) return 'Game Boy';
  return '';
}

function fichaNintendoDeDoc(doc, index = 50) {
  const portada = String(doc.image_url || '');
  if (!portadaNintendoOk(portada)) return null;
  const consolas = (Array.isArray(doc.system_names_txt) ? doc.system_names_txt : [doc.system_names_txt])
    .map(etiquetaNintendo)
    .filter(Boolean);
  if (consolas.length === 0) return null;
  return fichaDe({
    id: `nintendo:${doc.fs_id}`,
    titulo: doc.title,
    portada,
    portadaVertical: true,
    donde: consolas,
    sistemas: ['Nintendo'],
    lanzamiento: String(doc.dates_released_dts?.[0] || '').slice(0, 10),
    tiendas: ['Nintendo'],
    orden: index,
  });
}

/** Catálogo Nintendo filtrado por consola concreta (Switch ≠ GameCube ≠ N64…). */
export async function buscarNintendoPorConsola(consola, tope = 25) {
  const sistema = SISTEMA_NINTENDO_FQ[consola];
  if (!sistema) return [];
  const fq = `type:GAME AND system_names_txt:"${sistema}"`;
  const url = `https://searching.nintendo-europe.com/en/select?q=*:*&fq=${encodeURIComponent(fq)}&rows=${Math.min(tope, 40)}&wt=json`;
  const datos = await leerJson(url);
  return (datos?.response?.docs || [])
    .map((doc, index) => fichaNintendoDeDoc(doc, index))
    .filter(Boolean)
    .slice(0, tope);
}

async function buscarPlayStation(q, tope) {
  const datos = await leerJson(`https://store.playstation.com/store/api/chihiro/00_09_000/tumbler/US/en/999/${encodeURIComponent(q)}?size=${tope}`);
  return (datos?.links || [])
    .filter((link) => cercania(link.name, q) <= 1 && esJuegoPlayStation(link))
    .map((link, index) => {
      const imagen = (link.images || []).find((img) => img.type === 10 && img.url);
      if (!imagen || !/playstation\.(net|com)/.test(imagen.url)) return null;
      const consolas = (link.playable_platform || []).map(etiquetaPlay).filter(Boolean);
      if (consolas.length === 0) return null;
      return fichaDe({
        id: `ps:${link.id}`,
        titulo: link.name,
        portada: ampliarPortada(imagen.url),
        donde: consolas,
        sistemas: ['PlayStation'],
        lanzamiento: String(link.release_date || '').slice(0, 10),
        tiendas: ['PlayStation'],
        orden: index,
      });
    })
    .filter(Boolean);
}

function esJuegoPlayStation(link) {
  const tipos = (link.gameContentTypesList || []).map((item) => item.key);
  if (link.game_contentType === 'Full Game' || tipos.includes('FULL_GAME')) return true;
  if (link.top_category === 'add_on') return false;
  const separado = separarEdicion(link.name);
  return Boolean(separado.edicion) && (link.game_contentType === 'Bundle' || tipos.includes('BUNDLE'));
}

async function buscarEpic(q, tope) {
  const datos = await leerJson(`https://www.cheapshark.com/api/1.0/deals?title=${encodeURIComponent(q)}&storeID=25&pageSize=${tope}`);
  const vistos = new Set();
  const candidatos = (Array.isArray(datos) ? datos : []).filter((deal) => {
    if (!deal?.title || cercania(deal.title, q) > 2 || vistos.has(deal.title)) return false;
    vistos.add(deal.title);
    return Boolean(deal.steamAppID);
  }).slice(0, tope);
  const fichas = await Promise.all(candidatos.map(async (deal, index) => {
    const portada = await caratulaSteam(deal.steamAppID);
    return fichaDe({
      id: `steam:${deal.steamAppID}`,
      titulo: deal.title,
      portada,
      portadaVertical: Boolean(portada),
      donde: ['Epic Games'],
      sistemas: ['Windows'],
      metacritic: nota(deal.metacriticScore),
      tiendas: ['Epic Games'],
      steamAppId: String(deal.steamAppID),
      orden: index,
    });
  }));
  return fichas.filter(Boolean);
}

function clasificarTexto(texto) {
  const origen = String(texto || '');
  const donde = [];
  const sistemas = [];
  const poner = (lista, condicion, nombre) => {
    if (condicion && !lista.includes(nombre)) lista.push(nombre);
  };
  poner(donde, /\bps5\b/i.test(origen), 'PS5');
  poner(donde, /\bps4\b/i.test(origen), 'PS4');
  poner(donde, /\bps3\b/i.test(origen), 'PS3');
  poner(donde, /vita/i.test(origen), 'PS Vita');
  poner(donde, /\bpsp\b/i.test(origen), 'PSP');
  poner(donde, /xbox series/i.test(origen), 'Xbox Series X|S');
  poner(donde, /xbox one/i.test(origen), 'Xbox One');
  poner(donde, /xbox 360/i.test(origen), 'Xbox 360');
  poner(donde, /switch/i.test(origen), 'Switch');
  poner(donde, /wii u/i.test(origen), 'Wii U');
  poner(donde, /\bwii\b/i.test(origen) && !/wii u/i.test(origen), 'Wii');
  poner(donde, /\b3ds\b/i.test(origen), '3DS');
  poner(donde, /gamecube/i.test(origen), 'GameCube');
  poner(donde, /\bn64\b|nintendo 64/i.test(origen), 'N64');
  poner(donde, /\bsnes\b|super nintendo/i.test(origen), 'SNES');
  poner(donde, /\bnes\b|nintendo entertainment system/i.test(origen), 'NES');
  poner(donde, /game boy advance/i.test(origen), 'Game Boy Advance');
  poner(donde, /game boy/i.test(origen) && !/advance/i.test(origen), 'Game Boy');
  poner(donde, /\bsteam\b/i.test(origen), 'Steam');
  poner(donde, /\bepic games\b/i.test(origen), 'Epic Games');
  if (donde.some((etiqueta) => etiqueta.startsWith('PS') || etiqueta === 'PS Vita')) sistemas.push('PlayStation');
  else poner(sistemas, /playstation/i.test(origen), 'PlayStation');
  if (donde.some((etiqueta) => etiqueta.startsWith('Xbox'))) sistemas.push('Xbox');
  else poner(sistemas, /xbox/i.test(origen), 'Xbox');
  const consolaNintendo = ['Switch', 'Wii U', 'Wii', '3DS', 'GameCube', 'N64', 'SNES', 'NES', 'Game Boy Advance', 'Game Boy'];
  if (donde.some((etiqueta) => consolaNintendo.includes(etiqueta))) sistemas.push('Nintendo');
  else poner(sistemas, /nintendo/i.test(origen), 'Nintendo');
  poner(sistemas, /android/i.test(origen), 'Android');
  poner(sistemas, /\bios\b|iphone|ipad/i.test(origen), 'iOS');
  if (/\bmobile\b/i.test(origen) && !sistemas.includes('Android') && !sistemas.includes('iOS')) {
    sistemas.push('Android', 'iOS');
  }
  poner(sistemas, /linux/i.test(origen), 'Linux');
  poner(sistemas, /\bmac\b|macos|os x/i.test(origen), 'Mac');
  poner(sistemas, /\bwindows\b|\bpc\b/i.test(origen), 'Windows');
  return { donde, sistemas };
}

async function buscarWikipedia(q, tope) {
  const datos = await leerJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${q} video game`)}&srlimit=${Math.min(tope, 20)}&srnamespace=0&format=json&origin=*`);
  const titulos = (datos?.query?.search || []).map((item) => item.title);
  const fichas = await Promise.all(titulos.map(async (titulo, index) => {
    if (cercania(titulo, q) > 2) return null;
    const resumen = await leerJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo)}`);
    if (!resumen || resumen.type === 'disambiguation') return null;
    const fichaCorta = resumen.description || '';
    if (!/\bgame\b/i.test(fichaCorta) || /character|film|movie|series|person|company|soundtrack|album|list of/i.test(fichaCorta)) return null;
    const texto = `${fichaCorta} ${resumen.extract || ''}`;
    const thumb = resumen.thumbnail || {};
    const portada = ampliarPortada(thumb.source || '');
    if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(portada)) return null;
    const cajaVertical = Number(thumb.height) > Number(thumb.width) * 1.05 && !/screenshot|gameplay|logo|icon|banner/i.test(portada);
    const { donde, sistemas } = clasificarTexto(texto);
    if (donde.length === 0 && sistemas.length === 0) return null;
    const anio = texto.match(/\b(19|20)\d{2}\b/);
    return fichaDe({
      id: `wiki:${Buffer.from(titulo).toString('base64url')}`,
      titulo: (resumen.title || titulo).replace(/ \(video game\)$/i, ''),
      portada,
      portadaVertical: cajaVertical,
      descripcion: textoPlano(resumen.extract).slice(0, 1200),
      origenDescripcion: 'wiki',
      anioFuente: 'wiki',
      donde,
      sistemas,
      lanzamiento: anio ? anio[0] : '',
      orden: index,
    });
  }));
  return fichas.filter(Boolean);
}

function guardar(ficha) {
  cacheFichas.set(ficha.id, ficha);
  return ficha;
}

function agrupar(fichas) {
  const porTitulo = new Map();
  for (const ficha of fichas) {
    const clave = normalizar(ficha.titulo);
    const previa = porTitulo.get(clave);
    porTitulo.set(clave, previa ? unir(previa, ficha) : ficha);
  }
  const porSteam = new Map();
  const sueltos = [];
  for (const ficha of porTitulo.values()) {
    if (!ficha.steamAppId) {
      sueltos.push(ficha);
      continue;
    }
    const previa = porSteam.get(ficha.steamAppId);
    porSteam.set(ficha.steamAppId, previa ? unir(previa, ficha) : ficha);
  }
  return [...porSteam.values(), ...sueltos];
}

async function enLotes(items, tamano, tarea) {
  for (let indice = 0; indice < items.length; indice += tamano) {
    await Promise.all(items.slice(indice, indice + tamano).map(tarea));
  }
}

async function completarPortadas(fichas) {
  await enLotes(fichas.filter((ficha) => !ficha.portadaVertical), 4, async (ficha) => {
    try {
      // No sustituir packshot oficial de tienda Nintendo/PS/Xbox/Apple por otra fuente
      const url = ficha.portada || '';
      if (/nintendo\.com|playstation\.(net|com)|store-images\.s-microsoft|mzstatic\.com/i.test(url)) return;
      const vertical = await buscarCaratulaVertical({ titulo: ficha.titulo, steamAppId: ficha.steamAppId });
      if (vertical) {
        ficha.portada = vertical;
        ficha.portadaVertical = true;
      }
    } catch {
      // Sin caja vertical: se conserva la imagen oficial que ya traía la tienda.
    }
  });
  return fichas.filter((ficha) => ficha.portada);
}

const FUENTES = {
  steam: buscarSteam,
  microsoft: buscarMicrosoft,
  nintendo: buscarNintendo,
  playstation: buscarPlayStation,
  epic: buscarEpic,
  apple: buscarApple,
  wikipedia: buscarWikipedia,
};

export async function buscarFichas(q, limite, fuente, opciones = {}) {
  const tope = limite == null ? 40 : Math.min(Number(limite) || 8, 30);
  const porEtiqueta = Boolean(opciones.porEtiqueta);
  const tareas = FUENTES[fuente]
    ? [FUENTES[fuente]]
    : limite == null
      ? Object.values(FUENTES)
      : [buscarSteam, buscarMicrosoft, buscarNintendo, buscarApple];
  const listas = await Promise.all(tareas.map(async (tarea) => {
    try {
      if (porEtiqueta && (tarea === buscarSteam || fuente === 'steam')) {
        return await buscarSteamPorTag(q, tope);
      }
      if (tarea === buscarSteam || fuente === 'steam') return await buscarSteam(q, tope, porEtiqueta);
      if (porEtiqueta && tarea === buscarApple) return await buscarApple(q, tope, true);
      if (porEtiqueta && tarea === buscarNintendo) return await buscarNintendo(q, tope, true);
      return await tarea(q, tope);
    } catch {
      return [];
    }
  }));
  const completas = await completarPortadas(agrupar(listas.flat()));
  const fichas = completas
    .filter((ficha) => porEtiqueta || cercania(ficha.titulo, q) <= 2)
    .sort((a, b) => (porEtiqueta ? 0 : puntajeCercania(b.titulo, q, b.tiendas) - puntajeCercania(a.titulo, q, a.tiendas)) || a.orden - b.orden || a.titulo.localeCompare(b.titulo))
    .map(guardar);
  return limite == null ? fichas : fichas.slice(0, limite);
}

async function resumenWikipedia(titulo) {
  const datos = await leerJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo.replace(/ /g, '_'))}`);
  const extracto = textoPlano(datos?.extract);
  if (!extracto || datos?.type === 'disambiguation') return '';
  return extracto.slice(0, 1200);
}

async function detalleSteam(appId) {
  const datos = await leerJson(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`);
  const juego = datos?.[appId]?.data;
  if (!juego || juego.type === 'dlc' || (juego.type && juego.type !== 'game')) return null;
  const portada = await caratulaSteam(appId);
  const sistemas = [];
  if (juego.platforms?.windows) sistemas.push('Windows');
  if (juego.platforms?.mac) sistemas.push('Mac');
  if (juego.platforms?.linux) sistemas.push('Linux');
  const ficha = fichaDe({
    id: `steam:${appId}`,
    titulo: juego.name,
    portada,
    portadaVertical: Boolean(portada),
    descripcion: textoPlano(juego.short_description).slice(0, 1200),
    origenDescripcion: 'steam',
    desarrolladorFuente: 'steam',
    donde: ['Steam'],
    sistemas,
    generos: (juego.genres || []).map((item) => item.description).filter(Boolean).slice(0, 6),
    lanzamiento: String(juego.release_date?.date || ''),
    metacritic: nota(juego.metacritic?.score),
    desarrollador: (juego.developers || []).slice(0, 3).join(', '),
    editor: (juego.publishers || []).slice(0, 3).join(', '),
    tiendas: ['Steam'],
    steamAppId: String(appId),
  });
  return ficha ? guardar(ficha) : null;
}

async function enriquecer(ficha) {
  if (ficha.enriquecida) return ficha;
  let actual = { ...ficha };
  const faltaSteam = actual.steamAppId && (actual.origenDescripcion !== 'steam' || !actual.desarrollador || (actual.sistemas || []).length === 0);
  if (faltaSteam) {
    const steam = await detalleSteam(actual.steamAppId).catch(() => null);
    if (steam) actual = unir(actual, steam);
  }
  if (!actual.descripcion) {
    const texto = await resumenWikipedia(actual.titulo).catch(() => '');
    if (texto) {
      actual.descripcion = texto;
      if (actual.origenDescripcion !== 'steam') actual.origenDescripcion = 'wiki';
    }
  }
  if (!actual.portadaVertical) {
    const vertical = await buscarCaratulaVertical({ titulo: actual.titulo, steamAppId: actual.steamAppId }).catch(() => '');
    if (vertical) {
      actual.portada = vertical;
      actual.portadaVertical = true;
    }
  }
  actual.enriquecida = true;
  guardar(actual);
  if (ficha.id && ficha.id !== actual.id) cacheFichas.set(ficha.id, actual);
  return actual;
}

export async function detalleFicha(id) {
  const guardada = cacheFichas.get(id);
  if (guardada?.enriquecida) return guardada;
  if (guardada) return enriquecer(guardada);
  if (id.startsWith('steam:')) {
    const steam = await detalleSteam(id.slice(6));
    return steam ? enriquecer(steam) : null;
  }
  if (id.startsWith('wiki:')) {
    const titulo = Buffer.from(id.slice(5), 'base64url').toString('utf8');
    const resumen = await leerJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo)}`).catch(() => null);
    if (!resumen?.title || !/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(resumen.thumbnail?.source || '')) return null;
    const texto = `${resumen.description || ''} ${resumen.extract || ''}`;
    const { donde, sistemas } = clasificarTexto(texto);
    const ficha = fichaDe({
      id,
      titulo: resumen.title.replace(/ \(video game\)$/i, ''),
      portada: ampliarPortada(resumen.thumbnail.source),
      portadaVertical: Number(resumen.thumbnail.height) > Number(resumen.thumbnail.width) * 1.05 && !/screenshot|gameplay|logo|icon|banner/i.test(resumen.thumbnail.source),
      descripcion: textoPlano(resumen.extract).slice(0, 1200),
      origenDescripcion: 'wiki',
      anioFuente: 'wiki',
      donde,
      sistemas,
      lanzamiento: (texto.match(/\b(19|20)\d{2}\b/) || [''])[0],
    });
    return ficha ? enriquecer(ficha) : null;
  }
  if (id.startsWith('apple:')) {
    const apple = await detalleApple(id.slice(6));
    return apple ? enriquecer(apple) : null;
  }
  return null;
}

function sistemasApple(item) {
  const dispositivos = (item.supportedDevices || []).join(' ');
  if (/iPhone|iPad|iPod/i.test(dispositivos)) return ['iOS'];
  return ['iOS'];
}

function ampliarPortada(url) {
  const texto = String(url || '');
  if (/mzstatic\.com/.test(texto)) return texto.replace(/\d+x\d+(bb|w)?/, '600x600bb');
  if (/\/\d+px-/.test(texto) && /wikimedia\.org/.test(texto)) return texto.replace(/\/\d+px-/, '/600px-');
  if (/playstation\.(net|com)/.test(texto)) {
    const absoluta = texto.startsWith('//') ? `https:${texto}` : texto;
    try {
      const parsed = new URL(absoluta);
      if (parsed.searchParams.has('w')) parsed.searchParams.set('w', '720');
      if (parsed.searchParams.has('h')) parsed.searchParams.set('h', '720');
      return parsed.href;
    } catch {
      return absoluta;
    }
  }
  return texto;
}

function fichaApple(item, index = 50) {
  const portada = ampliarPortada(item.artworkUrl512 || item.artworkUrl100 || '');
  if (!/mzstatic\.com/.test(portada) || item.primaryGenreName !== 'Games') return null;
  return fichaDe({
    id: `apple:${item.trackId}`,
    titulo: item.trackName,
    portada,
    descripcion: textoPlano(item.description).slice(0, 1200),
    donde: ['App Store'],
    sistemas: sistemasApple(item),
    lanzamiento: String(item.releaseDate || '').slice(0, 10),
    desarrollador: item.artistName || '',
    tiendas: ['App Store'],
    orden: index,
  });
}

async function buscarApple(q, tope, sinCercania = false) {
  const datos = await leerJson(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=software&limit=${Math.max(tope, 12)}&country=us`);
  return (datos?.results || [])
    .filter((item) => item.primaryGenreName === 'Games' && (sinCercania || cercania(item.trackName, q) <= 2))
    .slice(0, tope)
    .map((item, index) => fichaApple(item, index))
    .filter(Boolean);
}

async function detalleApple(trackId) {
  const datos = await leerJson(`https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}`);
  const item = datos?.results?.find((entrada) => String(entrada.trackId) === String(trackId));
  const ficha = item ? fichaApple(item) : null;
  return ficha ? guardar(ficha) : null;
}
