import {
  buscarJuegosCatalogo,
  detalleJuegoCatalogo,
  obtenerRecomendacionesCatalogo,
  obtenerTendenciasCatalogo,
} from '../lib/catalogo-provider.js';
import { armarSugerenciasInicio } from '../lib/sugerencias-inicio.js';
import { buscarFichas } from '../lib/fuentes.js';
import { prisma } from '../lib/prisma.js';

export const obtenerSugerenciasInicio = async (req, res) => {
  try {
    const juegos = await prisma.juegoUsuario.findMany({
      where: { idUsuario: req.usuario.id },
      orderBy: { actualizadoEn: 'desc' },
    });
    const seed = String(req.query.seed || '');
    const data = await armarSugerenciasInicio(juegos, req.headers, seed);
    res.json(data);
  } catch (error) {
    console.error('Error en GET /api/catalogo/sugerencias:', error.message);
    res.status(500).json({ error: 'No se pudieron armar las sugerencias' });
  }
};

export const obtenerTendencias = async (req, res) => {
  try {
    const tendencias = await obtenerTendenciasCatalogo(req.headers);
    res.json(tendencias);
  } catch (error) {
    console.error('Error en GET /api/catalogo/tendencias:', error.message);
    res.status(500).json({ error: 'No se pudieron obtener las tendencias' });
  }
};

export const obtenerRecomendaciones = async (req, res) => {
  const miId = req.usuario.id;

  try {
    // 1. Obtener juegos de la biblioteca del usuario
    const misJuegos = await prisma.juegoUsuario.findMany({
      where: { idUsuario: miId },
      select: { tituloJuego: true, generos: true, calificacion: true, estado: true },
    });

    const titulosExcluidos = new Set(misJuegos.map((j) => j.tituloJuego.toLowerCase().trim()));

    // 2. Extraer géneros favoritos
    const conteo = {};
    for (const j of misJuegos) {
      const peso = (j.calificacion && j.calificacion >= 4) ? 3 : (j.estado === 'JUGANDO' ? 2 : 1);
      const lista = (j.generos || '').split(',').map((g) => g.trim().toLowerCase()).filter(Boolean);
      for (const g of lista) {
        conteo[g] = (conteo[g] || 0) + peso;
      }
    }
    const generosTop = Object.entries(conteo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((e) => e[0]);

    // 3. Obtener juegos que sus amigos están jugando o completando
    const amistades = await prisma.amistad.findMany({
      where: {
        OR: [{ idSolicitante: miId }, { idReceptor: miId }],
        estado: 'ACEPTADA',
      },
    });

    const idsAmigos = amistades.map((a) => (a.idSolicitante === miId ? a.idReceptor : a.idSolicitante));

    let amigosJugando = [];
    if (idsAmigos.length > 0) {
      const actividades = await prisma.juegoUsuario.findMany({
        where: {
          idUsuario: { in: idsAmigos },
          estado: { in: ['JUGANDO', 'COMPLETADO'] },
        },
        include: {
          usuario: { select: { id: true, nombre: true, username: true, avatar: true } },
        },
        orderBy: { actualizadoEn: 'desc' },
        take: 12,
      });

      amigosJugando = actividades
        .filter((act) => !titulosExcluidos.has(act.tituloJuego.toLowerCase().trim()))
        .map((act) => ({
          id: act.id,
          titulo: act.tituloJuego,
          urlPortada: act.urlPortada,
          estado: act.estado,
          calificacion: act.calificacion,
          amigo: act.usuario,
        }));
    }

    const semillas = [...new Set(
      misJuegos
        .filter((j) => j.estado === 'JUGANDO' || (j.estado === 'COMPLETADO' && Number(j.calificacion) >= 4) || j.estado === 'PENDIENTE')
        .map((j) => String(j.tituloJuego || '').split(':')[0].trim())
        .filter((t) => t.length >= 3),
    )].slice(0, 4);

    const recomendados = await obtenerRecomendacionesCatalogo(generosTop, titulosExcluidos, req.headers, 10, semillas);

    res.json({
      generosTop,
      recomendados,
      amigosJugando,
    });
  } catch (error) {
    console.error('Error en GET /api/catalogo/recomendaciones:', error.message);
    res.status(500).json({ error: 'Error al obtener recomendaciones' });
  }
};

export const buscarJuegos = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    res.status(400).json({ error: 'Escribe al menos 2 letras para buscar' });
    return;
  }

  try {
    const fuente = String(req.query.fuente || '');
    const permitidas = ['steam', 'microsoft', 'nintendo', 'playstation', 'epic', 'apple', 'wikipedia'];
    if (fuente && !permitidas.includes(fuente)) {
      res.status(400).json({ error: 'La tienda no es válida' });
      return;
    }
    const limite = req.query.limite === 'sugerencias' ? 5 : 12;

    if (fuente) {
      const fichas = await buscarFichas(q, limite, fuente);
      res.json(fichas);
      return;
    }

    const fichas = await buscarJuegosCatalogo(q, req.headers, limite);
    res.json(fichas);
  } catch (error) {
    console.error('Error en GET /api/catalogo/buscar:', error.message);
    res.status(502).json({ error: 'No se pudo consultar el catálogo' });
  }
};

export const detalleJuego = async (req, res) => {
  const id = decodeURIComponent(String(req.params.idFuente || ''));
  if (!/^(rawg|igdb|steam|ms|nintendo|ps|wiki|apple):[A-Za-z0-9_-]+$/.test(id)) {
    res.status(400).json({ error: 'El juego del catálogo no es válido' });
    return;
  }

  try {
    const ficha = await detalleJuegoCatalogo(id, req.headers);
    if (!ficha) {
      res.status(404).json({ error: 'No está en las tiendas ni en las fuentes del catálogo' });
      return;
    }
    res.json(ficha);
  } catch (error) {
    console.error('Error en GET /api/catalogo/juegos:', error.message);
    res.status(502).json({ error: 'No se pudo cargar la ficha' });
  }
};
