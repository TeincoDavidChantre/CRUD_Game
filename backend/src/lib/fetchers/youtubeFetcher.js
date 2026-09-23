/**
 * YouTube Data API v3 — última opción de tráilers del Santuario
 * (solo si IGDB/caché no aportan vídeo).
 * Requiere YOUTUBE_API_KEY o opciones.apiKey / header x-youtube-key.
 */
import { elegirPorTituloEstricto, esMatchTituloEstricto, normalizarTitulo } from '../tituloMatch.js';

function sinAcentos(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** Rechaza vídeos que claramente no son tráilers de juego. */
function esVideoSospechoso(tituloVideo, canal = '') {
  const t = sinAcentos(`${tituloVideo} ${canal}`);
  if (/\b(lyrics|official audio|full album|music video|mv\b|ost\b|soundtrack only)\b/.test(t)) return true;
  if (/\b(banda|folk rock|concert|live session)\b/.test(t) && !/\b(game|juego|trailer|gameplay)\b/.test(t)) {
    return true;
  }
  if (/\b(review|walkthrough|let'?s play|gameplay only|no commentary)\b/.test(t)
    && !/\b(official\s+)?trailer\b/.test(t)
    && !/\btrailer\s+oficial\b/.test(t)) {
    return true;
  }
  return false;
}

function tituloPareceTrailerJuego(tituloVideo, tituloJuego) {
  const t = sinAcentos(tituloVideo);
  const juego = normalizarTitulo(tituloJuego);
  if (!juego) return false;
  // El título del vídeo debe contener el juego (match estricto o substring fuerte)
  if (esMatchTituloEstricto(tituloJuego, tituloVideo)) return true;
  if (t.includes(juego) && /\b(trailer|teaser|launch|cinematic|anuncio|official)\b/.test(t)) {
    return true;
  }
  // "Hollow Knight: Silksong - Official Trailer"
  const base = juego.split(' ').filter((p) => p.length > 2);
  if (base.length >= 2 && base.every((p) => t.includes(p)) && /\btrailer\b/.test(t)) {
    return true;
  }
  return false;
}

/**
 * @param {string} nombre — título del videojuego
 * @param {{ apiKey?: string }} [opciones]
 * @returns {Promise<{ trailerYoutubeId: string }|null>}
 */
export async function fetchYoutubeTrailer(nombre, opciones = {}) {
  const titulo = String(nombre || '').trim();
  const apiKey = String(opciones.apiKey || process.env.YOUTUBE_API_KEY || '').trim();
  if (!titulo || !apiKey) return null;

  const consultas = [
    `${titulo} official trailer`,
    `${titulo} trailer oficial videojuego`,
    `${titulo} game trailer`,
  ];

  try {
    for (const q of consultas) {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('type', 'video');
      url.searchParams.set('maxResults', '8');
      url.searchParams.set('q', q);
      url.searchParams.set('key', apiKey);

      const resp = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        if (resp.status === 403 || resp.status === 400) return null;
        continue;
      }

      const data = await resp.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      if (!items.length) continue;

      const candidatos = items
        .map((item) => ({
          id: item?.id?.videoId ? String(item.id.videoId) : '',
          title: item?.snippet?.title || '',
          channel: item?.snippet?.channelTitle || '',
        }))
        .filter((v) => v.id && v.title)
        .filter((v) => !esVideoSospechoso(v.title, v.channel))
        .filter((v) => tituloPareceTrailerJuego(v.title, titulo));

      if (!candidatos.length) continue;

      // Preferir los que digan "official trailer" / "trailer oficial"
      const oficial = candidatos.find((v) =>
        /\b(official\s+trailer|trailer\s+oficial|launch\s+trailer)\b/i.test(v.title),
      );
      const elegido = oficial || candidatos[0];

      // Doble check: no aceptar si el canal/título es solo música
      if (esVideoSospechoso(elegido.title, elegido.channel)) continue;

      return { trailerYoutubeId: elegido.id };
    }

    // Último recurso: match estricto del título del vídeo contra el juego (sin exigir "trailer" en query 1)
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '5');
    url.searchParams.set('q', `${titulo} trailer`);
    url.searchParams.set('key', apiKey);
    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const lista = (data.items || []).map((item) => ({
      id: item?.id?.videoId,
      name: item?.snippet?.title,
      channel: item?.snippet?.channelTitle || '',
    })).filter((v) => v.id && v.name);

    const hit = elegirPorTituloEstricto(
      lista.filter((v) => !esVideoSospechoso(v.name, v.channel) && /\btrailer\b/i.test(v.name)),
      titulo,
      (v) => v.name,
    );
    if (hit?.id) return { trailerYoutubeId: String(hit.id) };
    return null;
  } catch {
    return null;
  }
}
