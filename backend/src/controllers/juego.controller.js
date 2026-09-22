import { esPortadaVerticalOptima, resolverMejorPortada } from '../lib/caratulas.js';
import { prisma } from '../lib/prisma.js';

const ESTADOS = ['PENDIENTE', 'JUGANDO', 'COMPLETADO', 'ABANDONADO'];

function texto(valor, max) {
  return String(valor || '').trim().slice(0, max);
}

function lista(valor, max) {
  const partes = Array.isArray(valor) ? valor : String(valor || '').split(',');
  return partes
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(', ')
    .slice(0, max);
}

function validarCalificacion(estado, valor, obligatoria) {
  if (estado !== 'COMPLETADO') return null;
  if (valor == null || valor === '') {
    if (!obligatoria) return undefined;
    const error = new Error('Indica una calificación del 1 al 5 para marcarlo como completado');
    error.status = 400;
    throw error;
  }
  const nota = Number(valor);
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    const error = new Error('La calificación debe ser un número del 1 al 5');
    error.status = 400;
    throw error;
  }
  return nota;
}

function plataformasDe(valor) {
  const textoPlano = Array.isArray(valor) ? valor.join(',') : String(valor || '');
  return textoPlano.split(',').map((item) => item.trim()).filter(Boolean);
}

function portadaPermitida(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname;
    const oficial = host.endsWith('steamstatic.com')
      || host === 'store-images.s-microsoft.com'
      || host.endsWith('.playstation.net')
      || host.endsWith('.playstation.com')
      || host.endsWith('nintendo.com')
      || host.endsWith('.wikimedia.org')
      || host.endsWith('.mzstatic.com')
      || host.endsWith('igdb.com')
      || host.endsWith('rawg.io')
      || host.endsWith('steamgriddb.com');
    return oficial ? parsed.href : '';
  } catch {
    return '';
  }
}

function notaMetacritic(valor) {
  if (valor == null || valor === '') return null;
  const nota = Number(valor);
  if (!Number.isInteger(nota) || nota < 1 || nota > 100) return null;
  return nota;
}

function validarEstado(estado) {
  if (!ESTADOS.includes(estado)) {
    const error = new Error('El estado no es válido');
    error.status = 400;
    throw error;
  }
  return estado;
}

export const obtenerJuegos = async (req, res) => {
  try {
    const juegos = await prisma.juegoUsuario.findMany({
      where: { idUsuario: req.usuario.id },
      orderBy: { creadoEn: 'desc' },
    });

    const salida = await Promise.all(
      juegos.map(async (juego) => {
        if (esPortadaVerticalOptima(juego.urlPortada)) {
          return juego;
        }

        try {
          const mejor = await resolverMejorPortada({
            titulo: juego.tituloJuego,
            urlActual: juego.urlPortada || '',
          });

          if (mejor && mejor !== juego.urlPortada) {
            await prisma.juegoUsuario.update({
              where: { id: juego.id },
              data: { urlPortada: mejor },
            });
            return { ...juego, urlPortada: mejor };
          }
        } catch {
          // Mantener juego tal cual si la resolución externa no responde
        }
        return juego;
      })
    );

    res.json(salida);
  } catch (error) {
    console.error('Error en GET /api/juegos:', error);
    res.status(500).json({ error: 'Error al obtener la lista de juegos' });
  }
};

export const crearJuego = async (req, res) => {
  try {
    const tituloJuego = texto(req.body?.tituloJuego, 160);
    if (!tituloJuego) {
      res.status(400).json({ error: 'El título es obligatorio' });
      return;
    }
    const estado = validarEstado(req.body?.estado || 'PENDIENTE');
    const calificacion = validarCalificacion(estado, req.body?.calificacion, true);

    let urlPortada = portadaPermitida(req.body?.urlPortada) || null;
    if (!esPortadaVerticalOptima(urlPortada)) {
      try {
        const mejor = await resolverMejorPortada({
          titulo: tituloJuego,
          urlActual: urlPortada || '',
        });
        if (mejor) urlPortada = mejor;
      } catch {
        // En caso de fallo de red puntual, conservar portada previa
      }
    }

    const nuevoJuego = await prisma.juegoUsuario.create({
      data: {
        idUsuario: req.usuario.id,
        tituloJuego,
        urlPortada,
        descripcion: texto(req.body?.descripcion, 2000),
        plataformas: lista(req.body?.plataformas, 200),
        sistemas: lista(req.body?.sistemas, 200),
        generos: lista(req.body?.generos, 200),
        metacritic: notaMetacritic(req.body?.metacritic),
        desarrollador: texto(req.body?.desarrollador, 160),
        etiquetas: lista(req.body?.etiquetas, 200),
        comentario: texto(req.body?.comentario, 1000),
        calificacion,
        estado,
      },
    });
    res.status(201).json(nuevoJuego);
  } catch (error) {
    if (error.status === 400) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'El juego ya se encuentra en tu biblioteca' });
      return;
    }
    console.error('Error en POST /api/juegos:', error);
    res.status(500).json({ error: 'Error al registrar el juego' });
  }
};

export const actualizarJuego = async (req, res) => {
  try {
    const actual = await prisma.juegoUsuario.findFirst({
      where: { id: req.params.id, idUsuario: req.usuario.id },
    });
    if (!actual) {
      res.status(404).json({ error: 'No está en tu biblioteca' });
      return;
    }

    const estado = req.body?.estado ? validarEstado(req.body.estado) : actual.estado;
    const traeNota = Object.prototype.hasOwnProperty.call(req.body || {}, 'calificacion');
    const calificacion = traeNota || estado !== actual.estado
      ? validarCalificacion(estado, traeNota ? req.body.calificacion : actual.calificacion, estado === 'COMPLETADO')
      : actual.calificacion;

    const data = { estado, calificacion: calificacion ?? null };
    if (req.body?.plataformas != null) data.plataformas = lista(req.body.plataformas, 200);
    if (req.body?.sistemas != null) data.sistemas = lista(req.body.sistemas, 200);
    if (req.body?.etiquetas != null) data.etiquetas = lista(req.body.etiquetas, 200);
    if (req.body?.comentario != null) data.comentario = texto(req.body.comentario, 1000);

    const juegoActualizado = await prisma.juegoUsuario.update({
      where: { id: actual.id },
      data,
    });
    res.json(juegoActualizado);
  } catch (error) {
    if (error.status === 400) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Error en PATCH /api/juegos:', error);
    res.status(500).json({ error: 'Error al actualizar el juego' });
  }
};

export const eliminarJuego = async (req, res) => {
  try {
    const actual = await prisma.juegoUsuario.findFirst({
      where: { id: req.params.id, idUsuario: req.usuario.id },
    });
    if (!actual) {
      res.status(404).json({ error: 'No está en tu biblioteca' });
      return;
    }
    await prisma.juegoUsuario.delete({ where: { id: actual.id } });
    res.json({ message: 'Juego eliminado correctamente' });
  } catch (error) {
    console.error('Error en DELETE /api/juegos:', error);
    res.status(500).json({ error: 'Error al eliminar el juego' });
  }
};
