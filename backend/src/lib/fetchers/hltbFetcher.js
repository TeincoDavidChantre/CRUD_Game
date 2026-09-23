/**
 * Tiempos HowLongToBeat (historia / main+extra / completista / coop).
 * Usa `howlongtobeat-ts`. Sin keys. Match estricto.
 */
import { HowLongToBeatService, toHours } from 'howlongtobeat-ts';
import { elegirPorTituloEstricto } from '../tituloMatch.js';
import { crearTtlCache } from '../ttlCache.js';

const servicio = new HowLongToBeatService();
const cache = crearTtlCache({ max: 200 });
const TTL_MS = 24 * 60 * 60 * 1000;

function horasDe(valor) {
  if (valor == null) return null;
  const h = typeof toHours === 'function' ? toHours(valor) : Number(valor) / 3600;
  const n = Number(h);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

function listaDeRespuesta(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (res.success && Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

export async function fetchHowLongToBeat(nombre) {
  const titulo = String(nombre || '').trim();
  if (!titulo) return null;

  const cacheKey = `hltb:${titulo.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;

  try {
    const res = await servicio.search(titulo);
    const lista = listaDeRespuesta(res).filter((g) => !g?.type || g.type === 'game');
    const juego = elegirPorTituloEstricto(lista, titulo, (g) => g?.name || g?.alias || '');
    if (!juego) {
      cache.set(cacheKey, null, TTL_MS);
      return null;
    }

    const main = horasDe(juego.mainTime ?? juego.gameplayMain);
    const mainExtra = horasDe(juego.mainExtraTime ?? juego.gameplayMainExtra ?? juego.gameplayExtended);
    const completionist = horasDe(juego.completionistTime ?? juego.gameplayCompletionist);
    const coop = horasDe(juego.coopTime);
    const multiplayer = horasDe(juego.multiplayerTime);

    if (main == null && mainExtra == null && completionist == null && coop == null && multiplayer == null) {
      cache.set(cacheKey, null, TTL_MS);
      return null;
    }

    const out = {
      hltbMain: main,
      hltbMainExtra: mainExtra,
      hltbCompletionist: completionist,
      hltbCoop: coop,
      hltbMultiplayer: multiplayer,
      hltbId: juego.id != null ? Number(juego.id) : undefined,
      hltbNombre: juego.name || undefined,
    };
    cache.set(cacheKey, out, TTL_MS);
    return out;
  } catch {
    return null;
  }
}
