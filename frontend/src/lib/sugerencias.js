import { normalizar, partir } from './fichas';

const GENEROS_GENERICOS = new Set(['action', 'adventure', 'indie', 'casual', 'rpg', 'strategy', 'simulation', 'sports', 'racing', 'shooter', 'arcade']);

export function marcasDe(juego) {
  return [...partir(juego.plataformas), ...partir(juego.sistemas)];
}

export function pesoJuego(juego) {
  if (juego.estado === 'ABANDONADO') return 0;
  if (juego.estado === 'JUGANDO') return 2;
  if (juego.estado === 'COMPLETADO') {
    const nota = Number(juego.calificacion) || 0;
    if (nota >= 4) return 3;
    if (nota >= 1) return 1;
    return 0;
  }
  if (juego.estado === 'PENDIENTE') return 0.35;
  return 0;
}

export function fuenteDe(marca) {
  const texto = String(marca || '').toLowerCase();
  if (texto.startsWith('ps') || texto.includes('playstation')) return 'playstation';
  if (/switch|wii|nintendo|3ds|gamecube|game boy|\bnes\b|snes|n64/.test(texto)) return 'nintendo';
  if (texto.includes('xbox') || texto.includes('microsoft')) return 'microsoft';
  if (texto.includes('ios') || texto.includes('android') || texto.includes('app store')) return 'apple';
  if (texto.includes('epic')) return 'epic';
  return 'steam';
}

export function fuentesDeJuego(juego) {
  const fuentes = [];
  for (const marca of marcasDe(juego)) {
    const fuente = fuenteDe(marca);
    if (!fuentes.includes(fuente)) fuentes.push(fuente);
  }
  return fuentes.slice(0, 2);
}

export function familia(marca) {
  const texto = String(marca || '').toLowerCase();
  if (texto.startsWith('ps') || texto.includes('playstation') || texto.includes('vita') || texto === 'psp') return 'playstation';
  if (/switch|wii|nintendo|3ds|gamecube|game boy|\bnes\b|snes|n64/.test(texto)) return 'nintendo';
  if (texto.includes('xbox')) return 'xbox';
  if (texto.includes('ios') || texto.includes('android') || texto.includes('app store')) return 'movil';
  if (/steam|epic|windows|linux|\bmac\b|\bpc\b|microsoft/.test(texto)) return 'pc';
  return texto;
}

export function compartePlataforma(marcasItem, marcasUsuario) {
  if (marcasUsuario.length === 0 || marcasItem.length === 0) return true;
  const suyas = new Set(marcasUsuario.map(familia));
  return marcasItem.some((marca) => suyas.has(familia(marca)));
}

function serieDe(titulo) {
  return String(titulo || '')
    .replace(/\b(part|parte)\s+[ivx0-9]+\b/gi, '')
    .replace(/\b(remastered|remaster|remake|definitive(?:\s+edition)?|digital deluxe|deluxe edition|goty)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Solo se busca por título o saga: un género suelto devuelve juegos de relleno.
export function consultaDe(juego) {
  return serieDe(juego.tituloJuego || juego.titulo || '');
}

const NOMBRE_FAMILIA = {
  playstation: 'PlayStation',
  xbox: 'Xbox',
  nintendo: 'Nintendo',
  pc: 'PC',
  movil: 'Móvil',
};

const FUENTE_FAMILIA = {
  playstation: 'playstation',
  xbox: 'microsoft',
  nintendo: 'nintendo',
  pc: 'steam',
  movil: 'apple',
};

export function familiasFrecuentes(juegos, limite = 3) {
  const cuenta = new Map();
  for (const juego of juegos) {
    const peso = Math.max(pesoJuego(juego), 0.2);
    for (const clave of new Set(marcasDe(juego).map(familia))) {
      if (!NOMBRE_FAMILIA[clave]) continue;
      cuenta.set(clave, (cuenta.get(clave) || 0) + peso);
    }
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite).map(([clave]) => clave);
}

// Cada familia consulta su propia tienda con sus propias semillas, para que las filas no se repitan.
export function planPorFamilia(juegos, limite = 3) {
  return familiasFrecuentes(juegos, limite).map((clave) => {
    const semillas = juegos
      .filter((juego) => pesoJuego(juego) > 0 && marcasDe(juego).some((marca) => familia(marca) === clave))
      .sort((a, b) => pesoJuego(b) - pesoJuego(a))
      .slice(0, 2);
    const fuente = FUENTE_FAMILIA[clave] || 'steam';
    const vistas = new Set();
    const consultas = [];
    for (const juego of semillas) {
      const q = consultaDe(juego);
      const id = normalizar(q);
      if (q.length < 2 || vistas.has(id)) continue;
      vistas.add(id);
      consultas.push({ q, fuente, peso: Math.max(pesoJuego(juego), 1) });
    }
    return { familia: clave, nombre: NOMBRE_FAMILIA[clave], semillas, consultas };
  }).filter((grupo) => grupo.consultas.length > 0);
}

export function generoUtil(juegos) {
  const cuenta = new Map();
  for (const juego of juegos) {
    const peso = pesoJuego(juego);
    if (peso < 1) continue;
    for (const genero of partir(juego.generos)) {
      if (GENEROS_GENERICOS.has(normalizar(genero))) continue;
      cuenta.set(genero, (cuenta.get(genero) || 0) + peso);
    }
  }
  const mejor = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
  return mejor ? mejor[0] : '';
}

export function plataformasFrecuentes(juegos, limite = 3) {
  const cuenta = new Map();
  for (const juego of juegos) {
    const peso = Math.max(pesoJuego(juego), 0.2);
    for (const marca of marcasDe(juego)) cuenta.set(marca, (cuenta.get(marca) || 0) + peso);
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite).map(([marca]) => marca);
}

export function estudioFrecuente(juegos) {
  const grupos = new Map();
  for (const juego of juegos) {
    const nombre = String(juego.desarrollador || '').trim();
    if (!nombre || pesoJuego(juego) === 0) continue;
    grupos.set(nombre, [...(grupos.get(nombre) || []), juego]);
  }
  const mejor = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (!mejor || mejor[1].length < 2) return null;
  return { nombre: mejor[0], juegos: mejor[1] };
}

export function esEdicionDeUnoPropio(titulo, propios) {
  const nombre = normalizar(titulo);
  for (const propio of propios) {
    if (nombre === propio) return true;
    const corto = nombre.length < propio.length ? nombre : propio;
    const largo = nombre.length < propio.length ? propio : nombre;
    if (largo.startsWith(`${corto} `) && /remaster|remake|definitiv|deluxe|edition|goty/.test(largo)) return true;
  }
  return false;
}

export function ordenarSugerencias(candidatos, semillas, marcasUsuario) {
  const propios = semillas.length
    ? new Set(semillas.map((juego) => normalizar(juego.tituloJuego)))
    : new Set();
  const vistos = new Set();
  const usuario = marcasUsuario;
  const puntuados = [];
  for (const item of candidatos) {
    const clave = normalizar(item.titulo);
    if (!clave || vistos.has(clave) || esEdicionDeUnoPropio(item.titulo, propios)) continue;
    const marcas = [...(item.donde || []), ...(item.sistemas || []), ...(item.plataformas || [])];
    if (!compartePlataforma(marcas, usuario)) continue;
    let puntos = item._base || 0;
    const estudio = normalizar(item.desarrollador);
    const generos = new Set((item.generos || []).map(normalizar));
    for (const semilla of semillas) {
      const peso = pesoJuego(semilla);
      if (!peso) continue;
      if (estudio && estudio === normalizar(semilla.desarrollador)) puntos += 4 * peso;
      for (const genero of partir(semilla.generos)) {
        if (generos.has(normalizar(genero))) puntos += 2 * peso;
      }
    }
    if (puntos <= 0) continue;
    vistos.add(clave);
    puntuados.push({ ...item, _puntos: puntos });
  }
  return puntuados.sort((a, b) => b._puntos - a._puntos);
}

export function planDeConsultas(juegos) {
  const semillas = [...juegos].filter((juego) => pesoJuego(juego) >= 2).sort((a, b) => pesoJuego(b) - pesoJuego(a)).slice(0, 3);
  const respaldo = semillas.length > 0
    ? semillas
    : ([...juegos].filter((juego) => pesoJuego(juego) > 0).slice(0, 2).concat(juegos)).filter((juego, index, lista) => lista.indexOf(juego) === index).slice(0, 2);
  const consultas = [];
  const vistas = new Set();
  function agregar(q, fuente, peso) {
    const texto = String(q || '').trim();
    if (texto.length < 2 || consultas.length >= 6) return;
    const clave = `${fuente}:${normalizar(texto)}`;
    if (vistas.has(clave)) return;
    vistas.add(clave);
    consultas.push({ q: texto, fuente, peso });
  }
  for (const juego of respaldo) {
    const q = consultaDe(juego);
    const fuentes = fuentesDeJuego(juego);
    const lista = fuentes.length > 0 ? fuentes : ['steam'];
    for (const fuente of lista) agregar(q, fuente, Math.max(pesoJuego(juego), 1));
  }
  return { semillas: respaldo, consultas };
}
