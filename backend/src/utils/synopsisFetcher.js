/**
 * Servicio de sinopsis con filtrado anti-ambigüedad.
 * Prioridad: Steam / RAWG / IGDB → Wikipedia solo como respaldo validado.
 */

const UA = { 'User-Agent': 'GameTracker/1.0 (catalogo-videojuegos; personal)' };

function sinAcentos(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Señales de que el texto habla de un videojuego (tras normalizar acentos). */
const SENALES_JUEGO = [
  /\bvideo\s*juego/i,
  /\bvideo\s*game/i,
  /\bjeu\s*video/i,
  /\bdesarrollad/i,
  /\bdeveloper\b/i,
  /\bpublisher\b/i,
  /\beditor(?:a|es)?\b/i,
  /\bplataforma/i,
  /\bplatform(s)?\b/i,
  /\bconsola/i,
  /\bconsole\b/i,
  /\bjugabilidad\b/i,
  /\bgameplay\b/i,
  /\bjugador(?:es)?\b/i,
  /\bplayer(?:s)?\b/i,
  /\bsteam\b/i,
  /\bplaystation\b/i,
  /\bxbox\b/i,
  /\bnintendo\b/i,
  /\bpc\b/i,
  /\bmultiplayer\b/i,
  /\bmultijugador\b/i,
  /\bindie\s+game\b/i,
  /\bgame\s+studio\b/i,
  /\bestudio\s+de\s+(?:desarrollo|videojuegos)\b/i,
  /\baction[- ]adventure\s+game\b/i,
  /\brole[- ]playing\s+game\b/i,
  /\baventura\b/i,
  /\badventure\b/i,
  /\bjuego\b/i,
  /\bgame\b/i,
];

const DESC_JUEGO = [
  /\bvideo\s*juego/i,
  /\bvideo\s*game/i,
  /\bjeu\s*video/i,
  /\bcomputer\s+game/i,
];

const PROHIBIDO = [
  // Música / bandas (cubre "banda estadounidense de indie y folk rock")
  /\bes una banda\b/i,
  /\bbanda\s+(?:\w+\s+){0,6}(?:indie|folk|rock|pop|metal|punk|jazz|hip[\s-]?hop)\b/i,
  /\bbanda\s+(?:musical|de\s+(?:rock|musica|indie|folk))\b/i,
  /\bfolk\s+rock\b/i,
  /\bindie\s+y\s+folk\b/i,
  /\brock\s+band\b/i,
  /\bmusic(?:al)?\s+band\b/i,
  /\bconciertos?\b/i,
  /\bcantante\b/i,
  /\bvocalista\b/i,
  /\bguitarrista\b/i,
  /\bbaterista\b/i,
  /\bsinger[- ]songwriter\b/i,
  /\balbum\b/i,
  /\bdiscograf/i,
  /\bgrupo\s+estuvo\s+activo\b/i,
  /\breembolsarse\b/i,
  /\brefundarse\b/i,
  /\breencontrarse?\b/i,
  // Cine / TV / libros / personas
  /\bpelicula\s+dirigida\s+por\b/i,
  /\bfilm\s+directed\s+by\b/i,
  /\bfeature\s+film\b/i,
  /\btelevision\s+series\b/i,
  /\bserie\s+de\s+television\b/i,
  /\bact(?:or|riz)\b/i,
  /\bnovel(?:a|ist)\b/i,
  /\blibro\s+escrito\b/i,
  /\bpodcast\b/i,
  /\byoutuber\b/i,
  /\bpolitic[oa]\b/i,
  /\bfootball(?:er)?\b/i,
  /\bfutbolista\b/i,
];

/** Señales fuertes de otro medio (aunque no coincida un patrón exacto). */
const SENALES_OTRO_MEDIO = [
  /\bbanda\b/i,
  /\bconcierto/i,
  /\balbum\b/i,
  /\bdiscograf/i,
  /\bcantante\b/i,
  /\bfolk\s+rock\b/i,
  /\brock\b/i,
  /\bpelicula\b/i,
  /\bfilm\b/i,
  /\bactor\b/i,
];


function claveTitulo(texto) {
  return sinAcentos(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function textoPlanoSinopsis(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function esSinopsisOtroMedio(texto, description = '') {
  const blob = sinAcentos(`${description} ${texto}`);
  return PROHIBIDO.some((re) => re.test(blob));
}

export function pareceContextoVideojuego(texto, description = '') {
  const blob = sinAcentos(`${description} ${texto}`);
  const descNorm = sinAcentos(description || '');
  if (DESC_JUEGO.some((re) => re.test(descNorm))) return true;
  if (/(?:video\s*game|video\s*juego|jeu\s*video)/i.test(descNorm)) return true;
  return SENALES_JUEGO.some((re) => re.test(blob));
}

function pareceOtroMedioSinJuego(texto) {
  const blob = sinAcentos(texto);
  if (pareceContextoVideojuego(blob)) return false;
  const hits = SENALES_OTRO_MEDIO.filter((re) => re.test(blob)).length;
  return hits >= 1;
}

/**
 * Sanitiza antes de renderizar / guardar.
 * Rechaza siempre textos de banda/película, aunque vengan de caché o tienda mal fusionada.
 */
export function sanitizarSinopsis(texto, { exigirContextoLudico = false } = {}) {
  const plano = textoPlanoSinopsis(texto);
  if (!plano || plano.length < 40) return '';
  if (esSinopsisOtroMedio(plano)) return '';
  if (pareceOtroMedioSinJuego(plano)) return '';
  if (exigirContextoLudico && !pareceContextoVideojuego(plano)) return '';
  return plano.slice(0, 2000);
}

function tituloPaginaValido(pageTitle, tituloBuscado) {
  const t = String(pageTitle || '');
  const base = sinAcentos(t)
    .replace(/\s*\((?:video\s*game|videojuego|jeu\s*video)\)\s*$/i, '')
    .trim();
  const q = claveTitulo(tituloBuscado);
  const b = claveTitulo(base);
  if (!q || !b) return false;
  if (b === q) return true;
  if (b.startsWith(q) || q.startsWith(b)) {
    const largo = Math.max(b.length, q.length);
    const corto = Math.min(b.length, q.length);
    return corto / largo >= 0.75;
  }
  return false;
}

function resumenPareceJuego(data) {
  if (!data || data.type === 'disambiguation') return false;
  const description = String(data.description || '');
  const extract = String(data.extract || '');
  if (esSinopsisOtroMedio(extract, description)) return false;
  const descNorm = sinAcentos(description);
  if (/\b(?:band|singer|album|film|actor|actress|novel|politician|footballer)\b/i.test(descNorm)
    && !DESC_JUEGO.some((re) => re.test(descNorm))) {
    return false;
  }
  return pareceContextoVideojuego(extract, description);
}

async function summaryWiki(lang, pageTitle) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
  const resp = await fetch(url, { headers: UA, signal: AbortSignal.timeout(5000) });
  if (!resp.ok) return null;
  return resp.json();
}

async function buscarTitulosWiki(lang, query) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=8&srnamespace=0&format=json&origin=*`;
  const resp = await fetch(url, { headers: UA, signal: AbortSignal.timeout(5000) });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data?.query?.search || []).map((s) => s.title).filter(Boolean);
}

/**
 * Wikipedia solo con paginas de videojuego.
 * Orden: sufijo (videojuego) -> busqueda contextual -> nunca banda/pelicula.
 */
export async function fetchWikipediaVideojuego(titulo) {
  const limpio = String(titulo || '').replace(/\s*\(\d{4}\)$/, '').trim();
  if (!limpio) return '';

  const slug = limpio.replace(/ /g, '_');
  const slugLimpio = limpio
    .replace(/—|-|–|:/g, ' ')
    .replace(/\b(complete edition|game of the year|goty|definitive edition|remastered|deluxe edition)\b/gi, '')
    .replace(/\s+/g, '_')
    .trim();

  const candidatos = [
    { lang: 'es', page: `${slugLimpio}_(videojuego)` },
    { lang: 'es', page: `${slug}_(videojuego)` },
    { lang: 'en', page: `${slugLimpio}_(video_game)` },
    { lang: 'en', page: `${slug}_(video_game)` },
    { lang: 'fr', page: `${slugLimpio}_(jeu_video)` },
  ];

  for (const { lang, page } of candidatos) {
    try {
      const data = await summaryWiki(lang, page);
      if (!data?.extract) continue;
      if (!resumenPareceJuego(data)) continue;
      if (!tituloPaginaValido(data.title || page, limpio)) continue;
      const ok = sanitizarSinopsis(data.extract, { exigirContextoLudico: true });
      if (ok) return ok;
    } catch {
      // siguiente
    }
  }

  const busquedas = [
    { lang: 'es', q: `${limpio} videojuego` },
    { lang: 'en', q: `${limpio} video game` },
    { lang: 'fr', q: `${limpio} jeu video` },
  ];

  for (const { lang, q } of busquedas) {
    try {
      const titulos = await buscarTitulosWiki(lang, q);
      for (const pageTitle of titulos) {
        const pageNorm = sinAcentos(pageTitle);
        if (!tituloPaginaValido(pageTitle, limpio)
          && !/\((?:video\s*game|videojuego|jeu\s*video)\)/i.test(pageNorm)) {
          continue;
        }
        const data = await summaryWiki(lang, pageTitle);
        if (!data?.extract || !resumenPareceJuego(data)) continue;
        const ok = sanitizarSinopsis(data.extract, { exigirContextoLudico: true });
        if (ok) return ok;
      }
    } catch {
      // siguiente idioma
    }
  }

  return '';
}

/**
 * Elige la mejor sinopsis: tiendas primero, Wikipedia al final.
 */
export function elegirSinopsis({ steam = '', rawg = '', igdb = '', wikipedia = '' } = {}) {
  const candidatos = [
    { origen: 'steam', texto: sanitizarSinopsis(steam, { exigirContextoLudico: false }) },
    { origen: 'rawg', texto: sanitizarSinopsis(rawg, { exigirContextoLudico: false }) },
    { origen: 'igdb', texto: sanitizarSinopsis(igdb, { exigirContextoLudico: false }) },
    { origen: 'wikipedia', texto: sanitizarSinopsis(wikipedia, { exigirContextoLudico: true }) },
  ];
  for (const c of candidatos) {
    if (c.texto) return c;
  }
  return { texto: '', origen: '' };
}

export async function fetchSteamSynopsis(appId) {
  const id = String(appId || '').trim();
  if (!/^\d+$/.test(id)) return '';
  try {
    const resp = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${id}&l=english`,
      { headers: UA, signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return '';
    const datos = await resp.json();
    const juego = datos?.[id]?.data;
    if (!juego || (juego.type && juego.type !== 'game')) return '';
    return sanitizarSinopsis(juego.short_description || '', { exigirContextoLudico: false });
  } catch {
    return '';
  }
}

export async function resolverSinopsis({
  titulo,
  steamAppId = null,
  rawg = '',
  igdb = '',
  steam = '',
} = {}) {
  let steamTxt = sanitizarSinopsis(steam, { exigirContextoLudico: false });
  if (!steamTxt && steamAppId) {
    steamTxt = await fetchSteamSynopsis(steamAppId);
  }
  const rawgTxt = sanitizarSinopsis(rawg, { exigirContextoLudico: false });
  const igdbTxt = sanitizarSinopsis(igdb, { exigirContextoLudico: false });

  const previa = elegirSinopsis({ steam: steamTxt, rawg: rawgTxt, igdb: igdbTxt, wikipedia: '' });
  if (previa.texto) return previa;

  const wiki = await fetchWikipediaVideojuego(titulo);
  return elegirSinopsis({ wikipedia: wiki });
}

/** Compat: solo Wikipedia filtrada (respaldo). */
export async function descripcionWikipediaEspanol(titulo) {
  return fetchWikipediaVideojuego(titulo);
}
