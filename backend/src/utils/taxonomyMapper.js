/**
 * Motor de Normalización de Taxonomía (GameTracker).
 * Unifica géneros/tags de Steam, RAWG, IGDB (EN/ES) en listas canónicas.
 *
 * Géneros = mecánicas de juego
 * Temáticas = ambientación / tono
 */

/** Mecánicas canónicas (orden de UI / filtros). */
export const GENEROS_CANONICOS = Object.freeze([
  'Acción',
  'Shooter',
  'RPG',
  'Plataformas',
  'Estrategia',
  'Puzle',
  'Conducción',
  'Deportes',
  'Lucha',
  'Supervivencia',
]);

/** Ambientaciones canónicas. */
export const TEMATICAS_CANONICAS = Object.freeze([
  'Ciencia Ficción',
  'Fantasía',
  'Cyberpunk',
  'Terror',
  'Histórico',
  'Post-apocalíptico',
]);

const SET_GENEROS = new Set(GENEROS_CANONICOS);
const SET_TEMATICAS = new Set(TEMATICAS_CANONICAS);

/**
 * Clave normalizada → canónico (género o temática).
 * Acepta inglés/español y variantes frecuentes de Steam/RAWG/IGDB.
 */
const MAPA = Object.freeze({
  // —— Géneros (mecánicas) ——
  action: 'Acción',
  accion: 'Acción',
  'acción': 'Acción',
  adventure: 'Acción',
  aventura: 'Acción',
  'action adventure': 'Acción',
  'accion aventura': 'Acción',
  'acción aventura': 'Acción',
  'hack and slash': 'Acción',
  'beat em up': 'Acción',
  arcade: 'Acción',

  shooter: 'Shooter',
  shooters: 'Shooter',
  fps: 'Shooter',
  tps: 'Shooter',
  'first person shooter': 'Shooter',
  'third person shooter': 'Shooter',
  'shoot em up': 'Shooter',
  shmup: 'Shooter',
  'twin stick shooter': 'Shooter',
  'bullet hell': 'Shooter',

  rpg: 'RPG',
  'role playing': 'RPG',
  'role playing game': 'RPG',
  'role playing rpg': 'RPG',
  'role-playing': 'RPG',
  'role-playing (rpg)': 'RPG',
  'role playing (rpg)': 'RPG',
  jrpg: 'RPG',
  'japanese role playing': 'RPG',
  'action rpg': 'RPG',
  'action-rpg': 'RPG',
  arpg: 'RPG',
  crpg: 'RPG',
  'western rpg': 'RPG',
  'turn based rpg': 'RPG',
  'tactical rpg': 'RPG',
  trpg: 'RPG',
  'rogue like': 'RPG',
  roguelike: 'RPG',
  roguelite: 'RPG',
  'juego de rol': 'RPG',
  rol: 'RPG',

  platformer: 'Plataformas',
  platform: 'Plataformas',
  platforms: 'Plataformas',
  plataformas: 'Plataformas',
  '2d platformer': 'Plataformas',
  '3d platformer': 'Plataformas',
  metroidvania: 'Plataformas',
  platforming: 'Plataformas',

  strategy: 'Estrategia',
  estrategia: 'Estrategia',
  rts: 'Estrategia',
  'real time strategy': 'Estrategia',
  'turn based strategy': 'Estrategia',
  'turn-based strategy': 'Estrategia',
  tbs: 'Estrategia',
  '4x': 'Estrategia',
  'grand strategy': 'Estrategia',
  'tower defense': 'Estrategia',
  'tower defence': 'Estrategia',
  moba: 'Estrategia',
  tactics: 'Estrategia',
  tactica: 'Estrategia',
  táctica: 'Estrategia',

  puzzle: 'Puzle',
  puzzles: 'Puzle',
  puzle: 'Puzle',
  puzles: 'Puzle',
  'puzzle game': 'Puzle',
  match3: 'Puzle',
  'match 3': 'Puzle',
  'point and click': 'Puzle',
  'hidden object': 'Puzle',

  racing: 'Conducción',
  race: 'Conducción',
  driving: 'Conducción',
  conduccion: 'Conducción',
  conducción: 'Conducción',
  carreras: 'Conducción',
  'vehicular combat': 'Conducción',
  simracing: 'Conducción',
  'sim racing': 'Conducción',

  sports: 'Deportes',
  sport: 'Deportes',
  deportes: 'Deportes',
  deporte: 'Deportes',
  football: 'Deportes',
  soccer: 'Deportes',
  basketball: 'Deportes',
  baseball: 'Deportes',
  hockey: 'Deportes',
  golf: 'Deportes',
  tennis: 'Deportes',
  fifa: 'Deportes',
  nba: 'Deportes',
  'american football': 'Deportes',

  fighting: 'Lucha',
  fight: 'Lucha',
  lucha: 'Lucha',
  'versus fighting': 'Lucha',
  '2d fighter': 'Lucha',
  '3d fighter': 'Lucha',
  brawler: 'Lucha',

  survival: 'Supervivencia',
  supervivencia: 'Supervivencia',
  'survival craft': 'Supervivencia',
  'open world survival craft': 'Supervivencia',
  crafting: 'Supervivencia',
  'battle royale': 'Supervivencia',

  // —— Temáticas (ambientación) ——
  'science fiction': 'Ciencia Ficción',
  'sci fi': 'Ciencia Ficción',
  scifi: 'Ciencia Ficción',
  'sci-fi': 'Ciencia Ficción',
  'ciencia ficcion': 'Ciencia Ficción',
  'ciencia ficción': 'Ciencia Ficción',
  futuristic: 'Ciencia Ficción',
  futuro: 'Ciencia Ficción',
  space: 'Ciencia Ficción',
  espacio: 'Ciencia Ficción',
  aliens: 'Ciencia Ficción',

  fantasy: 'Fantasía',
  fantasia: 'Fantasía',
  fantasía: 'Fantasía',
  magic: 'Fantasía',
  magia: 'Fantasía',
  medieval: 'Fantasía',
  'high fantasy': 'Fantasía',
  'dark fantasy': 'Fantasía',

  cyberpunk: 'Cyberpunk',
  'cyber punk': 'Cyberpunk',
  dystopian: 'Cyberpunk',

  horror: 'Terror',
  terror: 'Terror',
  'survival horror': 'Terror',
  'psychological horror': 'Terror',
  spooky: 'Terror',
  zombie: 'Terror',
  zombies: 'Terror',

  historical: 'Histórico',
  historic: 'Histórico',
  history: 'Histórico',
  historico: 'Histórico',
  histórico: 'Histórico',
  ww1: 'Histórico',
  ww2: 'Histórico',
  'world war': 'Histórico',
  war: 'Histórico',
  guerra: 'Histórico',
  western: 'Histórico',
  pirate: 'Histórico',
  viking: 'Histórico',

  'post apocalyptic': 'Post-apocalíptico',
  'post-apocalyptic': 'Post-apocalíptico',
  postapocalyptic: 'Post-apocalíptico',
  'post apocaliptico': 'Post-apocalíptico',
  'post-apocaliptico': 'Post-apocalíptico',
  'post apocalíptico': 'Post-apocalíptico',
  'post-apocalíptico': 'Post-apocalíptico',
  apocalypse: 'Post-apocalíptico',
  apocaliptico: 'Post-apocalíptico',
  wasteland: 'Post-apocalíptico',
});

/** Etiquetas que aportan más de un canónico (mecánica + tema). */
const MAPA_COMPUESTO = Object.freeze({
  'survival horror': ['Supervivencia', 'Terror'],
  'action rpg': ['Acción', 'RPG'],
  'action-rpg': ['Acción', 'RPG'],
  arpg: ['Acción', 'RPG'],
  'sci fi horror': ['Ciencia Ficción', 'Terror'],
  'science fiction horror': ['Ciencia Ficción', 'Terror'],
});

function claveEtiqueta(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[|/·•]+/g, ' ')
    .replace(/[^a-z0-9áéíóúüñ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function partirCrudo(entrada) {
  if (entrada == null) return [];
  if (Array.isArray(entrada)) {
    return entrada.flatMap((item) => {
      if (item == null) return [];
      if (typeof item === 'string') return partirCrudo(item);
      return [item.name || item.description || item.slug || String(item)];
    });
  }
  return String(entrada)
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Normaliza un array/string crudo de APIs a { generos, tematicas } canónicos sin duplicados.
 */
export function normalizarTaxonomia(etiquetasCrudas) {
  const generos = new Set();
  const tematicas = new Set();

  for (const cruda of partirCrudo(etiquetasCrudas)) {
    const clave = claveEtiqueta(cruda);
    if (!clave) continue;

    const compuestos = MAPA_COMPUESTO[clave];
    if (compuestos) {
      for (const c of compuestos) {
        if (SET_GENEROS.has(c)) generos.add(c);
        else if (SET_TEMATICAS.has(c)) tematicas.add(c);
      }
      continue;
    }

    // Match directo
    let canonico = MAPA[clave];

    // Variantes con paréntesis: "Role-playing (RPG)" → probar "rpg" y frase completa
    if (!canonico) {
      const sinParentesis = clave.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
      const soloParentesis = (clave.match(/\(([^)]+)\)/) || [])[1];
      canonico = MAPA[sinParentesis] || (soloParentesis ? MAPA[claveEtiqueta(soloParentesis)] : null);
    }

    // Ya es canónico
    if (!canonico) {
      if (SET_GENEROS.has(cruda.trim())) canonico = cruda.trim();
      else if (SET_TEMATICAS.has(cruda.trim())) canonico = cruda.trim();
    }

    if (!canonico) continue;

    if (SET_GENEROS.has(canonico)) generos.add(canonico);
    else if (SET_TEMATICAS.has(canonico)) tematicas.add(canonico);
  }

  return {
    generos: GENEROS_CANONICOS.filter((g) => generos.has(g)),
    tematicas: TEMATICAS_CANONICAS.filter((t) => tematicas.has(t)),
  };
}

/** Serializa para columnas String de Prisma (`"Acción, RPG"`). */
export function taxonomiaATexto(tax) {
  const t = tax && typeof tax === 'object' ? tax : normalizarTaxonomia(tax);
  return {
    generos: (t.generos || []).join(', '),
    tematicas: (t.tematicas || []).join(', '),
  };
}

/**
 * Interceptor listo para Prisma: a partir de géneros crudos (y temáticas opcionales)
 * devuelve strings limpios para `Juego.generos` / `Juego.tematicas`.
 */
export function prepararTaxonomiaParaPrisma(generosCrudos, tematicasCrudas = []) {
  const mezcla = [...partirCrudo(generosCrudos), ...partirCrudo(tematicasCrudas)];
  return taxonomiaATexto(normalizarTaxonomia(mezcla));
}

/** Compat: una sola etiqueta → canónico de género o '' (ignora temáticas sueltas). */
export function mapearGeneroCanonico(etiqueta) {
  const { generos } = normalizarTaxonomia([etiqueta]);
  return generos[0] || '';
}
