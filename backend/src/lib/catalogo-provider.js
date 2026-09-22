import { prisma } from './prisma.js';
import { buscarFichas, detalleFicha } from './fuentes.js';
import { resolverMejorPortada, esPortadaVerticalOptima, esCaptura } from './caratulas.js';

function tituloRelacionado(titulo, consulta) {
  const limpia = (texto) => String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const t = limpia(titulo);
  const base = limpia(consulta);
  if (!t || !base) return false;
  if (t === base) return true;
  if (!t.startsWith(`${base} `)) return false;
  const resto = t.slice(base.length + 1);
  if (/^(ii|iii|iv|v|\d+|silksong|nightreign|remastered|remake|definitive|goty|part \d+)\b/.test(resto)) return true;
  // Sagas largas ("the legend of zelda …"): permitir otras entregas
  return base.split(' ').length >= 3 && resto.split(' ').length <= 8 && !/hentai|puzzle 18|wallpaper|soundtrack|demo\b/.test(resto);
}

function conPortadaOficial(ficha) {
  const url = ficha.portada || ficha.urlPortada || '';
  return Boolean(url) && (ficha.portadaVertical || esPortadaVerticalOptima(url));
}

async function enriquecerConMejorPortada(juegos = []) {
  const enriquecidos = await Promise.all(
    juegos.map(async (juego) => {
      const actual = juego.urlPortada || juego.portada || '';
      if (esPortadaVerticalOptima(actual)) {
        return { ...juego, urlPortada: actual, portada: actual, portadaVertical: true };
      }
      try {
        const mejor = await resolverMejorPortada({
          titulo: juego.titulo,
          tiendas: juego.enlacesTienda || {},
          urlActual: actual,
        });
        if (mejor && esPortadaVerticalOptima(mejor)) {
          return { ...juego, urlPortada: mejor, portada: mejor, portadaVertical: true, banner: esCaptura(actual) ? null : actual };
        }
      } catch {
        // Sin carátula oficial vertical.
      }
      return { ...juego, urlPortada: null, portada: null, portadaVertical: false };
    }),
  );
  return enriquecidos.filter((juego) => juego.urlPortada && esPortadaVerticalOptima(juego.urlPortada));
}

async function obtenerTokenTwitch(clientId, clientSecret) {
  const cacheKey = `${clientId}:${clientSecret}`;
  const enCache = twitchTokens.get(cacheKey);
  if (enCache && enCache.expira > Date.now()) {
    return enCache.token;
  }

  try {
    const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
    const resp = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    twitchTokens.set(cacheKey, {
      token: data.access_token,
      expira: Date.now() + (data.expires_in - 300) * 1000,
    });
    return data.access_token;
  } catch (error) {
    console.error('Error al autenticar con Twitch/IGDB:', error.message);
    return null;
  }
}

// Normalización de tiendas desde RAWG
function parsearTiendasRawg(stores) {
  const tiendas = {};
  if (!Array.isArray(stores)) return tiendas;
  for (const item of stores) {
    const store = item.store || {};
    const nombre = (store.name || '').toLowerCase();
    const url = item.url || '';
    if (!url) continue;

    if (nombre.includes('steam')) tiendas.steam = url;
    else if (nombre.includes('playstation')) tiendas.playstation = url;
    else if (nombre.includes('xbox')) tiendas.xbox = url;
    else if (nombre.includes('nintendo')) tiendas.nintendo = url;
    else if (nombre.includes('epic')) tiendas.epic = url;
    else if (nombre.includes('gog')) tiendas.gog = url;
  }
  return tiendas;
}

// Helper para extraer credenciales prioritarias (cabeceras del usuario > servidor)
function obtenerCredenciales(headers = {}) {
  const rawgKey = headers['x-rawg-key'] || process.env.RAWG_API_KEY || null;
  const igdbClientId = headers['x-igdb-client-id'] || process.env.TWITCH_CLIENT_ID || null;
  const igdbClientSecret = headers['x-igdb-client-secret'] || process.env.TWITCH_CLIENT_SECRET || null;
  return { rawgKey, igdbClientId, igdbClientSecret };
}

// Diccionario de traducción de géneros inglés -> español
const DICCIONARIO_GENEROS = {
  action: 'Acción',
  adventure: 'Aventura',
  shooter: 'Disparos',
  'role-playing-games-rpg': 'Rol (RPG)',
  rpg: 'Rol (RPG)',
  'role-playing': 'Rol (RPG)',
  indie: 'Indie',
  strategy: 'Estrategia',
  casual: 'Casual',
  simulation: 'Simulación',
  arcade: 'Arcade',
  puzzle: 'Puzles',
  platformer: 'Plataformas',
  racing: 'Carreras',
  sports: 'Deportes',
  fighting: 'Lucha',
  family: 'Familiar',
  'board-games': 'Juegos de mesa',
  card: 'Cartas',
  educational: 'Educativo',
  'massively-multiplayer': 'Multijugador masivo',
};

export function traducirGenero(genero) {
  if (!genero) return '';
  const clave = String(genero).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return DICCIONARIO_GENEROS[clave] || genero;
}

// Consulta de sinopsis oficial en español mediante Wikipedia ES
export async function descripcionWikipediaEspanol(titulo) {
  if (!titulo) return '';
  const sinAnio = String(titulo).replace(/\s*\(\d{4}\)$/, '').trim();
  const limpiar = (t) => String(t || '').replace(/—|-|–|:/g, ' ').replace(/\b(complete edition|game of the year|goty|definitive edition|remastered|deluxe edition)\b/gi, '').replace(/\s+/g, '_').trim();
  const paginas = [
    encodeURIComponent(String(sinAnio).replace(/ /g, '_')),
    encodeURIComponent(`${limpiar(sinAnio)}_(videojuego)`),
    encodeURIComponent(limpiar(sinAnio)),
    encodeURIComponent(String(titulo).replace(/ /g, '_')),
  ];

  for (const pag of paginas) {
    try {
      const resp = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${pag}`, {
        headers: { 'User-Agent': 'GameTracker/1.0 (catalogo-videojuegos; personal)' },
        signal: AbortSignal.timeout(4000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.extract && data.extract.length > 40 && data.type !== 'disambiguation') {
          return data.extract;
        }
      }
    } catch {
      // Probar siguiente
    }
  }
  return '';
}

// Mapear resultado de RAWG a formato unificado
function mapearJuegoRawg(game) {
  const anio = game.released ? new Date(game.released).getFullYear() : null;
  const plataformas = (game.platforms || []).map((p) => p.platform?.name).filter(Boolean);
  const generos = (game.genres || []).map((g) => traducirGenero(g.name)).filter(Boolean);
  const desarrollador = (game.developers || []).map((d) => d.name).join(', ') || '';

  return {
    id: `rawg:${game.id}`,
    titulo: game.name,
    slug: game.slug,
    urlPortada: game.background_image || null,
    descripcion: game.description_raw || game.description || '',
    plataformas: plataformas.join(', '),
    sistemas: plataformas.slice(0, 5).join(', '),
    generos: generos.join(', '),
    metacritic: game.metacritic || null,
    desarrollador,
    anoLanzamiento: anio,
    enlacesTienda: parsearTiendasRawg(game.stores),
    fuente: 'rawg',
  };
}

// Guardar o actualizar juego en caché local PostgreSQL (tabla Juego)
export async function cachearJuegoEnBD(ficha) {
  if (!ficha || !ficha.id || !ficha.titulo) return ficha;
  try {
    const data = {
      externalId: ficha.id,
      slug: ficha.slug || null,
      titulo: ficha.titulo,
      descripcion: ficha.descripcion || '',
      urlPortada: ficha.urlPortada || null,
      plataformas: Array.isArray(ficha.plataformas) ? ficha.plataformas.join(', ') : String(ficha.plataformas || ''),
      sistemas: Array.isArray(ficha.sistemas) ? ficha.sistemas.join(', ') : String(ficha.sistemas || ''),
      generos: Array.isArray(ficha.generos) ? ficha.generos.join(', ') : String(ficha.generos || ''),
      metacritic: ficha.metacritic ? Number(ficha.metacritic) : null,
      desarrollador: ficha.desarrollador || '',
      anoLanzamiento: ficha.anoLanzamiento ? Number(ficha.anoLanzamiento) : null,
      enlacesTienda: JSON.stringify(ficha.enlacesTienda || {}),
    };

    const guardado = await prisma.juego.upsert({
      where: { externalId: ficha.id },
      update: data,
      create: data,
    });

    return {
      ...ficha,
      dbId: guardado.id,
    };
  } catch (err) {
    console.error('Error al guardar en caché local:', err.message);
    return ficha;
  }
}

// 1. OBTENER TENDENCIAS / JUEGOS MÁS POPULARES
export async function obtenerTendenciasCatalogo(headers = {}) {
  const { rawgKey, igdbClientId, igdbClientSecret } = obtenerCredenciales(headers);

  // A) Si hay RAWG Key: consultar lo más jugado del año actual y pasado
  if (rawgKey) {
    try {
      const hoy = new Date();
      const anioActual = hoy.getFullYear();
      const anioAnterior = anioActual - 1;
      const url = `https://api.rawg.io/api/games?key=${rawgKey}&dates=${anioAnterior}-01-01,${anioActual}-12-31&ordering=-added&page_size=30`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        const listaCruda = (data.results || []).map(mapearJuegoRawg);
        const lista = await enriquecerConMejorPortada(listaCruda);
        // Cachear en paralelo en PostgreSQL
        Promise.all(lista.map(cachearJuegoEnBD)).catch(() => {});
        return lista;
      }
    } catch (e) {
      console.warn('Fallo al obtener tendencias de RAWG:', e.message);
    }
  }

  // B) Si hay IGDB: consultar los más valorados/populares
  if (igdbClientId && igdbClientSecret) {
    const token = await obtenerTokenTwitch(igdbClientId, igdbClientSecret);
    if (token) {
      try {
        const body = `
          fields name, slug, cover.url, summary, platforms.name, genres.name, total_rating, first_release_date, websites.url, websites.category;
          where total_rating_count > 50 & first_release_date > 1640995200;
          sort total_rating_count desc;
          limit 30;
        `;
        const resp = await fetch('https://api.igdb.com/v4/games', {
          method: 'POST',
          headers: {
            'Client-ID': igdbClientId,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const games = await resp.json();
          const lista = games.map((g) => {
            const portada = g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : null;
            const anio = g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null;
            return {
              id: `igdb:${g.id}`,
              titulo: g.name,
              slug: g.slug,
              urlPortada: portada,
              descripcion: g.summary || '',
              plataformas: (g.platforms || []).map((p) => p.name).join(', '),
              generos: (g.genres || []).map((gen) => gen.name).join(', '),
              metacritic: g.total_rating ? Math.round(g.total_rating) : null,
              anoLanzamiento: anio,
              enlacesTienda: {},
              fuente: 'igdb',
            };
          });
          Promise.all(lista.map(cachearJuegoEnBD)).catch(() => {});
          return lista;
        }
      } catch (e) {
        console.warn('Fallo al obtener tendencias de IGDB:', e.message);
      }
    }
  }

  // C/D) Sin claves: rotar semillas conocidas según la hora (cambia a lo largo del día)
  const banco = [
    'Elden Ring', 'Hades', 'Celeste', "Baldur's Gate 3", 'Stardew Valley', 'Hollow Knight',
    'Disco Elysium', 'Outer Wilds', 'Hades II', 'Slay the Spire', 'Dead Cells', 'Ori and the Blind Forest',
    'Cuphead', 'Undertale', 'Persona 5', 'The Witcher 3', 'Red Dead Redemption 2', 'God of War',
    'It Takes Two', 'Hades', 'Sekiro', 'Monster Hunter Wilds', 'Black Myth Wukong', 'Palworld',
    'Terraria', 'Risk of Rain 2', 'Blasphemous', 'Katana ZERO', 'Dave the Diver', 'Balatro',
    'Clair Obscur', 'Silksong', 'Metroid Dread', 'Zelda Tears of the Kingdom', 'Animal Crossing',
  ];
  const offset = Math.floor(Date.now() / (1000 * 60 * 30)) % banco.length;
  const semillasTendencia = [...banco.slice(offset), ...banco.slice(0, offset)].slice(0, 18);
  const salida = [];
  const vistos = new Set();
  for (const q of semillasTendencia) {
    try {
      const fichas = (await buscarFichas(q, null, 'steam')).filter((f) => conPortadaOficial(f) && tituloRelacionado(f.titulo, q));
      for (const ficha of fichas.slice(0, 3)) {
        const clave = String(ficha.titulo || '').toLowerCase().trim();
        if (!clave || vistos.has(clave)) continue;
        vistos.add(clave);
        salida.push({ ...ficha, urlPortada: ficha.portada, portadaVertical: true, fuente: 'catalogo' });
      }
    } catch {
      // Semilla sin resultados
    }
    if (salida.length >= 32) break;
  }
  // Relleno con topsellers Steam por tag si aún faltan
  if (salida.length < 28) {
    for (const tag of ['indie', 'action', 'adventure', 'rpg']) {
      try {
        const extra = await buscarFichas(tag, 12, 'steam', { porEtiqueta: true });
        for (const ficha of extra) {
          if (!conPortadaOficial(ficha)) continue;
          const clave = String(ficha.titulo || '').toLowerCase().trim();
          if (!clave || vistos.has(clave)) continue;
          vistos.add(clave);
          salida.push({ ...ficha, urlPortada: ficha.portada, portadaVertical: true, fuente: 'catalogo' });
          if (salida.length >= 32) break;
        }
      } catch {
        // tag sin resultados
      }
      if (salida.length >= 28) break;
    }
  }
  return salida;
}

// 2. BUSCAR JUEGOS
export async function buscarJuegosCatalogo(query, headers = {}, limite = 12) {
  const { rawgKey, igdbClientId, igdbClientSecret } = obtenerCredenciales(headers);
  const q = String(query || '').trim();

  // A) Búsqueda en RAWG
  if (rawgKey) {
    try {
      const url = `https://api.rawg.io/api/games?key=${rawgKey}&search=${encodeURIComponent(q)}&page_size=${limite}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        const listaCruda = (data.results || []).map(mapearJuegoRawg);
        const lista = await enriquecerConMejorPortada(listaCruda);
        Promise.all(lista.map(cachearJuegoEnBD)).catch(() => {});
        return lista;
      }
    } catch (e) {
      console.warn('Error en búsqueda RAWG, probando alternativa:', e.message);
    }
  }

  // B) Búsqueda en IGDB
  if (igdbClientId && igdbClientSecret) {
    const token = await obtenerTokenTwitch(igdbClientId, igdbClientSecret);
    if (token) {
      try {
        const body = `
          search "${q.replace(/"/g, '')}";
          fields name, slug, cover.url, summary, platforms.name, genres.name, total_rating, first_release_date;
          limit ${limite};
        `;
        const resp = await fetch('https://api.igdb.com/v4/games', {
          method: 'POST',
          headers: {
            'Client-ID': igdbClientId,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const games = await resp.json();
          const lista = games.map((g) => {
            const portada = g.cover?.url ? `https:${g.cover.url.replace('t_thumb', 't_cover_big')}` : null;
            return {
              id: `igdb:${g.id}`,
              titulo: g.name,
              slug: g.slug,
              urlPortada: portada,
              descripcion: g.summary || '',
              plataformas: (g.platforms || []).map((p) => p.name).join(', '),
              generos: (g.genres || []).map((gen) => gen.name).join(', '),
              metacritic: g.total_rating ? Math.round(g.total_rating) : null,
              anoLanzamiento: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
              enlacesTienda: {},
              fuente: 'igdb',
            };
          });
          Promise.all(lista.map(cachearJuegoEnBD)).catch(() => {});
          return lista;
        }
      } catch (e) {
        console.warn('Error en búsqueda IGDB, recurriendo a local:', e.message);
      }
    }
  }

  // C) Respaldo local en PostgreSQL
  const coincidentes = await prisma.juego.findMany({
    where: {
      titulo: { contains: q, mode: 'insensitive' },
    },
    take: limite,
  });

  if (coincidentes.length > 0) {
    return coincidentes.map((j) => ({
      id: j.externalId || j.id,
      titulo: j.titulo,
      slug: j.slug,
      urlPortada: j.urlPortada,
      descripcion: j.descripcion,
      plataformas: j.plataformas,
      sistemas: j.sistemas,
      generos: j.generos,
      metacritic: j.metacritic,
      desarrollador: j.desarrollador,
      anoLanzamiento: j.anoLanzamiento,
      enlacesTienda: JSON.parse(j.enlacesTienda || '{}'),
      fuente: 'db',
    }));
  }

  // D) Fallback a tiendas públicas tradicionales
  return buscarFichas(q, limite);
}

// 3. DETALLE DE JUEGO
export async function detalleJuegoCatalogo(idFuente, headers = {}) {
  const { rawgKey } = obtenerCredenciales(headers);

  // Si ya está cacheado en BD local, devolverlo
  const enBD = await prisma.juego.findFirst({
    where: { externalId: idFuente },
  });

  if (enBD && enBD.descripcion && enBD.enlacesTienda && enBD.enlacesTienda !== '{}') {
    let urlPortada = enBD.urlPortada;
    if (!esPortadaVerticalOptima(urlPortada)) {
      try {
        const tiendas = JSON.parse(enBD.enlacesTienda || '{}');
        const mejor = await resolverMejorPortada({
          titulo: enBD.titulo,
          tiendas,
          urlActual: urlPortada || '',
        });
        if (mejor && mejor !== urlPortada) {
          urlPortada = mejor;
          prisma.juego.update({ where: { id: enBD.id }, data: { urlPortada: mejor } }).catch(() => {});
        }
      } catch {
        // Fallback
      }
    }

    if (enBD.descripcion && /\b(is an?|by the|the player|developed by|takes place in|set in|as a young|in which the|released in|action-adventure game)\b/i.test(enBD.descripcion)) {
      try {
        const descEs = await descripcionWikipediaEspanol(enBD.titulo);
        if (descEs) {
          enBD.descripcion = descEs;
          prisma.juego.update({ where: { id: enBD.id }, data: { descripcion: descEs } }).catch(() => {});
        }
      } catch {
        // Fallback
      }
    }

    return {
      id: enBD.externalId,
      titulo: enBD.titulo,
      slug: enBD.slug,
      urlPortada,
      portada: urlPortada,
      descripcion: enBD.descripcion,
      plataformas: enBD.plataformas ? enBD.plataformas.split(', ') : [],
      sistemas: enBD.sistemas ? enBD.sistemas.split(', ') : [],
      generos: enBD.generos ? enBD.generos.split(', ') : [],
      metacritic: enBD.metacritic,
      desarrollador: enBD.desarrollador,
      anoLanzamiento: enBD.anoLanzamiento,
      lanzamiento: enBD.anoLanzamiento ? `${enBD.anoLanzamiento}-01-01` : null,
      enlacesTienda: JSON.parse(enBD.enlacesTienda || '{}'),
      fuente: 'db',
    };
  }

  // Si es ID de RAWG (ej: rawg:1234)
  if (idFuente.startsWith('rawg:') && rawgKey) {
    try {
      const rawgId = idFuente.replace('rawg:', '');
      const [resDetalle, resTiendas] = await Promise.all([
        fetch(`https://api.rawg.io/api/games/${rawgId}?key=${rawgKey}`, { signal: AbortSignal.timeout(8000) }),
        fetch(`https://api.rawg.io/api/games/${rawgId}/stores?key=${rawgKey}`, { signal: AbortSignal.timeout(8000) }),
      ]);

      if (resDetalle.ok) {
        const game = await resDetalle.json();
        const tiendasData = resTiendas.ok ? await resTiendas.json() : { results: [] };
        
        // Mapear URLs directas de tiendas
        const enlacesTienda = {};
        for (const t of tiendasData.results || []) {
          const storeId = t.store_id;
          const url = t.url;
          if (!url) continue;
          if (storeId === 1) enlacesTienda.steam = url;
          else if (storeId === 3) enlacesTienda.playstation = url;
          else if (storeId === 2) enlacesTienda.xbox = url;
          else if (storeId === 6) enlacesTienda.nintendo = url;
          else if (storeId === 11) enlacesTienda.epic = url;
          else if (storeId === 5) enlacesTienda.gog = url;
        }

        const [mejorPortada, descripcionEs] = await Promise.all([
          resolverMejorPortada({
            titulo: game.name,
            tiendas: enlacesTienda,
            urlActual: game.background_image || null,
          }),
          descripcionWikipediaEspanol(game.name),
        ]);

        const ficha = {
          id: idFuente,
          titulo: game.name,
          slug: game.slug,
          urlPortada: mejorPortada || null,
          portada: mejorPortada || null,
          banner: game.background_image || null,
          descripcion: descripcionEs || game.description_raw || game.description || '',
          plataformas: (game.platforms || []).map((p) => p.platform?.name).filter(Boolean),
          sistemas: (game.parent_platforms || []).map((p) => p.platform?.name).filter(Boolean),
          generos: (game.genres || []).map((g) => traducirGenero(g.name)).filter(Boolean),
          metacritic: game.metacritic || null,
          desarrollador: (game.developers || []).map((d) => d.name).join(', ') || '',
          anoLanzamiento: game.released ? new Date(game.released).getFullYear() : null,
          lanzamiento: game.released || null,
          enlacesTienda,
          fuente: 'rawg',
        };

        await cachearJuegoEnBD(ficha);
        return ficha;
      }
    } catch (e) {
      console.warn('Error al obtener detalle de RAWG:', e.message);
    }
  }

  // Fallback a detalle tradicional
  return detalleFicha(idFuente);
}

// 4. OBTENER RECOMENDACIONES BASADAS EN GUSTOS
export async function obtenerRecomendacionesCatalogo(generosTop = [], titulosExcluidos = new Set(), headers = {}, limite = 12, semillas = []) {
  const { rawgKey } = obtenerCredenciales(headers);
  const generoSlug = (generosTop[0] || '').toLowerCase().replace(/\s+/g, '-');
  const genericos = new Set(['action', 'adventure', 'indie', 'casual', 'rpg', 'strategy', 'simulation', 'sports', 'racing', 'shooter', 'arcade', 'accion', 'aventura']);

  // A) RAWG solo con género concreto (no genéricos) y carátula oficial
  if (rawgKey && generoSlug && !genericos.has(generoSlug)) {
    try {
      const url = `https://api.rawg.io/api/games?key=${rawgKey}&genres=${encodeURIComponent(generoSlug)}&ordering=-added&page_size=${limite + 15}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (resp.ok) {
        const data = await resp.json();
        const listaCruda = (data.results || [])
          .filter((g) => (g.added > 30 || g.ratings_count > 10 || (g.metacritic && g.metacritic > 60)) && g.background_image)
          .map(mapearJuegoRawg)
          .filter((j) => !titulosExcluidos.has(j.titulo.toLowerCase().trim()))
          .slice(0, limite + 8);
        const lista = await enriquecerConMejorPortada(listaCruda);
        Promise.all(lista.map(cachearJuegoEnBD)).catch(() => {});
        if (lista.length > 0) return lista.slice(0, limite);
      }
    } catch (e) {
      console.warn('Error en recomendaciones RAWG:', e.message);
    }
  }

  // B) Semillas por título (misma lógica que el inicio: saga, no género)
  const consultas = (semillas.length ? semillas : []).slice(0, 3);
  if (consultas.length > 0) {
    const listas = await Promise.all(consultas.map(async (q) => {
      try {
        return (await buscarFichas(q, null, 'steam')).filter((f) => conPortadaOficial(f) && tituloRelacionado(f.titulo, q));
      } catch {
        return [];
      }
    }));
    const vistos = new Set();
    const salida = [];
    for (const ficha of listas.flat()) {
      const clave = String(ficha.titulo || '').toLowerCase().trim();
      if (!clave || vistos.has(clave) || titulosExcluidos.has(clave)) continue;
      vistos.add(clave);
      salida.push({
        ...ficha,
        urlPortada: ficha.portada,
        portadaVertical: true,
        fuente: 'catalogo',
      });
      if (salida.length >= limite) break;
    }
    if (salida.length > 0) return salida;
  }

  // C) Tendencias ya filtradas
  const fallback = await obtenerTendenciasCatalogo(headers);
  return fallback.filter((j) => !titulosExcluidos.has(String(j.titulo || '').toLowerCase().trim())).slice(0, limite);
}

