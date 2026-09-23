import { esMatchTituloEstricto, similitudTitulo } from '../tituloMatch.js';

const tokens = new Map();

const MODOS = {
  'single player': 'Un jugador',
  multiplayer: 'Multijugador',
  'co-operative': 'Cooperativo',
  cooperative: 'Cooperativo',
  'split screen': 'Pantalla compartida',
  'massively multiplayer online': 'Multijugador masivo en línea',
  'massively multiplayer': 'Multijugador masivo en línea',
  mmo: 'Multijugador masivo en línea',
  'battle royale': 'Battle royale',
};

/** Una sola query: todo lo de fase 1 (sinopsis, fecha, taxonomía, cover, tráiler…). */
const FIELDS = [
  'name',
  'slug',
  'summary',
  'first_release_date',
  'total_rating',
  'total_rating_count',
  'game_modes.name',
  'genres.name',
  'themes.name',
  'platforms.name',
  'cover.image_id',
  'videos.video_id',
  'videos.name',
  'websites.category',
  'websites.url',
  'involved_companies.company.name',
  'involved_companies.developer',
  'involved_companies.publisher',
].join(',');

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function vacioMeta() {
  return {
    igdbId: null,
    slug: null,
    summary: null,
    anoLanzamiento: null,
    igdbRating: null,
    igdbRatingCount: null,
    jugadores: null,
    requiereInternet: null,
    trailerYoutubeId: null,
    desarrollador: null,
    editor: null,
    generos: [],
    tematicas: [],
    plataformas: [],
    coverUrl: null,
    websites: [],
  };
}

async function tokenTwitch(clientId, clientSecret) {
  const clave = `${clientId}:${clientSecret}`;
  const guardado = tokens.get(clave);
  if (guardado && guardado.expira > Date.now()) return guardado.token;
  const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
  try {
    const resp = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(6000) });
    if (!resp.ok) {
      console.warn(`IGDB/Twitch token HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    if (!data.access_token) {
      console.warn('IGDB/Twitch token: respuesta sin access_token');
      return null;
    }
    tokens.set(clave, {
      token: data.access_token,
      expira: Date.now() + Math.max(60, (data.expires_in || 3600) - 300) * 1000,
    });
    return data.access_token;
  } catch (err) {
    console.warn('IGDB/Twitch token:', err.message);
    return null;
  }
}

/** Entre varios matches estrictos, prioriza la ficha con más datos (evita stubs). */
function riqueza(g) {
  const videos = Array.isArray(g?.videos) ? g.videos.length : 0;
  const rating = Number(g?.total_rating);
  const tieneNota = Number.isFinite(rating) && rating >= 1 ? 1 : 0;
  const empresas = Array.isArray(g?.involved_companies) ? g.involved_companies.length : 0;
  const summary = g?.summary ? 20 : 0;
  return videos * 100 + tieneNota * 50 + empresas * 5 + summary;
}

function elegir(lista, titulo) {
  if (!Array.isArray(lista) || !lista.length || !titulo) return null;
  const candidatos = lista.filter((g) => g?.name && esMatchTituloEstricto(titulo, g.name));
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => {
    const diff = riqueza(b) - riqueza(a);
    if (diff !== 0) return diff;
    return similitudTitulo(titulo, b.name) - similitudTitulo(titulo, a.name);
  });
  return candidatos[0];
}

function anoDeUnix(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  const y = new Date(n * 1000).getUTCFullYear();
  return y >= 1970 && y <= 2100 ? y : null;
}

function coverUrlDe(imageId) {
  const id = String(imageId || '').trim();
  if (!id) return null;
  return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${id}.jpg`;
}

/** Prefiere tráiler oficial frente al primer vídeo genérico. */
function elegirTrailerYoutube(videos) {
  const lista = Array.isArray(videos) ? videos.filter((v) => v?.video_id) : [];
  if (!lista.length) return null;
  const score = (v) => {
    const n = normalizar(v.name || '');
    let s = 0;
    if (/\b(official\s+)?trailer\b/.test(n) || /\btrailer\s+oficial\b/.test(n)) s += 50;
    if (/\blaunch\b/.test(n) || /\bcinematic\b/.test(n)) s += 20;
    if (/\bteaser\b/.test(n)) s += 10;
    if (/\b(gameplay|review|walkthrough|ost|soundtrack)\b/.test(n)) s -= 30;
    return s;
  };
  lista.sort((a, b) => score(b) - score(a));
  return String(lista[0].video_id);
}

function nombresDe(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((x) => (typeof x === 'string' ? x : x?.name))
    .filter(Boolean);
}

/**
 * Meta IGDB — fase 1 en UNA sola petición a /games.
 * Si hay igdbId → where id (sin search). Si no → search + match estricto.
 */
export async function metaIgdb(titulo, clientId, clientSecret, opciones = {}) {
  if (!clientId || !clientSecret) return null;
  const igdbId = opciones.igdbId && /^\d+$/.test(String(opciones.igdbId))
    ? String(opciones.igdbId)
    : null;
  if (!titulo && !igdbId) return null;

  try {
    const token = await tokenTwitch(clientId, clientSecret);
    if (!token) return null;

    let cuerpo;
    if (igdbId) {
      cuerpo = `fields ${FIELDS}; where id = ${igdbId}; limit 1;`;
    } else {
      const consulta = String(titulo).replace(/"/g, '').slice(0, 120);
      cuerpo = `search "${consulta}"; fields ${FIELDS}; limit 8;`;
    }

    const resp = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: cuerpo,
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      console.warn(`IGDB games HTTP ${resp.status}`);
      return null;
    }
    const lista = await resp.json();
    const juego = igdbId
      ? (Array.isArray(lista) ? lista[0] : null)
      : elegir(lista, titulo);
    if (!juego) return vacioMeta();

    // Si vino por ID pero el título no cuadra con lo pedido, no inventar
    if (igdbId && titulo && !elegir([juego], titulo)) return vacioMeta();

    const nota = Number(juego.total_rating);
    const igdbRating = Number.isFinite(nota) && nota >= 1 ? Math.round(nota) : null;
    const count = Number(juego.total_rating_count);
    const igdbRatingCount = Number.isFinite(count) && count > 0 ? Math.round(count) : null;

    const modos = [];
    let masivo = false;
    for (const modo of juego.game_modes || []) {
      const clave = normalizar(modo?.name);
      const etiqueta = MODOS[clave];
      if (!etiqueta || modos.includes(etiqueta)) continue;
      modos.push(etiqueta);
      if (clave.includes('massively') || clave === 'mmo') masivo = true;
    }

    const developers = (juego.involved_companies || [])
      .filter((c) => c.developer)
      .map((c) => c.company?.name)
      .filter(Boolean);
    const publishers = (juego.involved_companies || [])
      .filter((c) => c.publisher)
      .map((c) => c.company?.name)
      .filter(Boolean);

    const summary = String(juego.summary || '').trim() || null;

    return {
      igdbId: juego.id != null ? String(juego.id) : igdbId,
      slug: juego.slug || null,
      summary,
      anoLanzamiento: anoDeUnix(juego.first_release_date),
      igdbRating,
      igdbRatingCount,
      jugadores: modos.length ? modos.join(' · ') : null,
      requiereInternet: masivo ? true : null,
      trailerYoutubeId: elegirTrailerYoutube(juego.videos),
      desarrollador: developers[0] || null,
      editor: publishers[0] || null,
      generos: nombresDe(juego.genres),
      tematicas: nombresDe(juego.themes),
      plataformas: nombresDe(juego.platforms),
      coverUrl: coverUrlDe(juego.cover?.image_id),
      websites: (Array.isArray(juego.websites) ? juego.websites : [])
        .filter((w) => w?.url)
        .map((w) => ({
          url: String(w.url),
          category: Number.isInteger(w.category) ? w.category : null,
        })),
    };
  } catch (err) {
    console.warn('IGDB meta:', err.message);
    return null;
  }
}
