/**
 * Filtro defensivo de sinopsis en el cliente (espejo ligero del backend).
 * Evita mostrar textos de banda/película ya cacheados.
 */
const PROHIBIDO = [
  /\bes una banda\b/i,
  /\bbanda\s+(?:\w+\s+){0,6}(?:indie|folk|rock|pop|metal|punk)\b/i,
  /\bfolk\s+rock\b/i,
  /\bconciertos?\b/i,
  /\bcantante\b/i,
  /\balbum\b/i,
  /\bdiscograf/i,
  /\bgrupo\s+estuvo\s+activo\b/i,
  /\bpel[ií]cula\s+dirigida\s+por\b/i,
  /\bfilm\s+directed\s+by\b/i,
];

const SENALES_JUEGO = [
  /\bvideo\s*juego/i,
  /\bvideo\s*game/i,
  /\bdesarrollad/i,
  /\bjugabilidad\b/i,
  /\bgameplay\b/i,
  /\bplataforma/i,
  /\bconsola/i,
  /\bsteam\b/i,
  /\baventura\b/i,
  /\bjuego\b/i,
];

function plano(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function esSinopsisSegura(texto) {
  const t = plano(texto);
  if (!t || t.length < 40) return false;
  if (PROHIBIDO.some((re) => re.test(t))) return false;
  const tieneOtro = /\bbanda\b|\bconcierto|\balbum\b|\bcantante\b/i.test(t);
  const tieneJuego = SENALES_JUEGO.some((re) => re.test(t));
  if (tieneOtro && !tieneJuego) return false;
  return true;
}

export function sinopsisParaMostrar(texto) {
  return esSinopsisSegura(texto) ? String(texto).trim() : '';
}
