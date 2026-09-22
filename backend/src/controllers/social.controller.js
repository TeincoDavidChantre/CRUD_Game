import { prisma } from '../lib/prisma.js';

// 1. BUSCAR USUARIOS
export const buscarUsuarios = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    res.status(400).json({ error: 'Escribe al menos 2 letras para buscar usuarios' });
    return;
  }

  try {
    const usuarios = await prisma.usuario.findMany({
      where: {
        AND: [
          { id: { not: req.usuario.id } },
          {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { nombre: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        nombre: true,
        username: true,
        avatar: true,
        biografia: true,
        creadoEn: true,
        _count: { select: { juegos: true } },
      },
      take: 20,
    });

    res.json(usuarios);
  } catch (error) {
    console.error('Error en buscarUsuarios:', error);
    res.status(500).json({ error: 'Error al buscar usuarios' });
  }
};

// 2. PERFIL PÚBLICO DE USUARIO
export const obtenerPerfilPublico = async (req, res) => {
  const username = String(req.params.username || '').trim();

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { username },
      select: {
        id: true,
        nombre: true,
        username: true,
        avatar: true,
        biografia: true,
        creadoEn: true,
      },
    });

    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Obtener su biblioteca
    const juegos = await prisma.juegoUsuario.findMany({
      where: { idUsuario: usuario.id },
      orderBy: { creadoEn: 'desc' },
      select: {
        id: true,
        tituloJuego: true,
        urlPortada: true,
        descripcion: true,
        plataformas: true,
        sistemas: true,
        generos: true,
        metacritic: true,
        desarrollador: true,
        calificacion: true,
        comentario: true,
        estado: true,
        actualizadoEn: true,
      },
    });

    // Verificar relación de amistad si el usuario está autenticado y no es él mismo
    let relacionAmistad = null;
    if (req.usuario && req.usuario.id !== usuario.id) {
      const amistad = await prisma.amistad.findFirst({
        where: {
          OR: [
            { idSolicitante: req.usuario.id, idReceptor: usuario.id },
            { idSolicitante: usuario.id, idReceptor: req.usuario.id },
          ],
        },
      });

      if (amistad) {
        relacionAmistad = {
          id: amistad.id,
          estado: amistad.estado,
          esEmisor: amistad.idSolicitante === req.usuario.id,
        };
      }
    }

    res.json({
      usuario,
      juegos,
      esMio: req.usuario?.id === usuario.id,
      relacionAmistad,
    });
  } catch (error) {
    console.error('Error en obtenerPerfilPublico:', error);
    res.status(500).json({ error: 'Error al cargar el perfil' });
  }
};

// 3. AMISTADES Y SOLICITUDES
export const obtenerAmigosYSolicitudes = async (req, res) => {
  const miId = req.usuario.id;

  try {
    const amistades = await prisma.amistad.findMany({
      where: {
        OR: [{ idSolicitante: miId }, { idReceptor: miId }],
      },
      include: {
        solicitante: {
          select: { id: true, nombre: true, username: true, avatar: true, biografia: true },
        },
        receptor: {
          select: { id: true, nombre: true, username: true, avatar: true, biografia: true },
        },
      },
      orderBy: { actualizadoEn: 'desc' },
    });

    const amigos = [];
    const solicitudesRecibidas = [];
    const solicitudesEnviadas = [];

    for (const rel of amistades) {
      if (rel.estado === 'ACEPTADA') {
        const amigo = rel.idSolicitante === miId ? rel.receptor : rel.solicitante;
        amigos.push({ idAmistad: rel.id, amigo, desde: rel.actualizadoEn });
      } else if (rel.estado === 'PENDIENTE') {
        if (rel.idReceptor === miId) {
          solicitudesRecibidas.push({
            idAmistad: rel.id,
            solicitante: rel.solicitante,
            fecha: rel.creadoEn,
          });
        } else {
          solicitudesEnviadas.push({
            idAmistad: rel.id,
            receptor: rel.receptor,
            fecha: rel.creadoEn,
          });
        }
      }
    }

    res.json({ amigos, solicitudesRecibidas, solicitudesEnviadas });
  } catch (error) {
    console.error('Error en obtenerAmigosYSolicitudes:', error);
    res.status(500).json({ error: 'Error al obtener la lista de amigos' });
  }
};

// 4. ENVIAR SOLICITUD DE AMISTAD
export const enviarSolicitudAmistad = async (req, res) => {
  const miId = req.usuario.id;
  const idReceptor = req.params.idUsuario;

  if (miId === idReceptor) {
    res.status(400).json({ error: 'No puedes enviarte una solicitud a ti mismo' });
    return;
  }

  try {
    const receptor = await prisma.usuario.findUnique({ where: { id: idReceptor } });
    if (!receptor) {
      res.status(404).json({ error: 'El usuario destinatario no existe' });
      return;
    }

    // Comprobar si ya existe relación
    const existente = await prisma.amistad.findFirst({
      where: {
        OR: [
          { idSolicitante: miId, idReceptor },
          { idSolicitante: idReceptor, idReceptor: miId },
        ],
      },
    });

    if (existente) {
      if (existente.estado === 'ACEPTADA') {
        res.status(400).json({ error: 'Ya son amigos' });
        return;
      }
      if (existente.estado === 'PENDIENTE') {
        res.status(400).json({ error: 'Ya hay una solicitud de amistad pendiente' });
        return;
      }
      // Si fue rechazada, reactivarla
      const actualizada = await prisma.amistad.update({
        where: { id: existente.id },
        data: { idSolicitante: miId, idReceptor, estado: 'PENDIENTE' },
      });
      res.json(actualizada);
      return;
    }

    const nueva = await prisma.amistad.create({
      data: { idSolicitante: miId, idReceptor, estado: 'PENDIENTE' },
    });

    res.status(201).json(nueva);
  } catch (error) {
    console.error('Error en enviarSolicitudAmistad:', error);
    res.status(500).json({ error: 'Error al enviar solicitud' });
  }
};

// 5. RESPONDER SOLICITUD DE AMISTAD (ACEPTAR / RECHAZAR)
export const responderSolicitudAmistad = async (req, res) => {
  const miId = req.usuario.id;
  const { idAmistad } = req.params;
  const accion = String(req.body?.accion || '').toLowerCase(); // 'aceptar' o 'rechazar'

  if (!['aceptar', 'rechazar'].includes(accion)) {
    res.status(400).json({ error: 'Acción no válida (aceptar o rechazar)' });
    return;
  }

  try {
    const solicitud = await prisma.amistad.findUnique({ where: { id: idAmistad } });
    if (!solicitud || solicitud.idReceptor !== miId) {
      res.status(404).json({ error: 'Solicitud no encontrada o no te pertenece' });
      return;
    }

    if (accion === 'aceptar') {
      const aceptada = await prisma.amistad.update({
        where: { id: idAmistad },
        data: { estado: 'ACEPTADA' },
      });
      res.json({ message: 'Solicitud aceptada', amistad: aceptada });
    } else {
      await prisma.amistad.delete({ where: { id: idAmistad } });
      res.json({ message: 'Solicitud rechazada' });
    }
  } catch (error) {
    console.error('Error en responderSolicitudAmistad:', error);
    res.status(500).json({ error: 'Error al procesar solicitud' });
  }
};

// 6. ELIMINAR AMIGO O CANCELAR SOLICITUD
export const eliminarAmistad = async (req, res) => {
  const miId = req.usuario.id;
  const { idAmistad } = req.params;

  try {
    const relacion = await prisma.amistad.findFirst({
      where: {
        id: idAmistad,
        OR: [{ idSolicitante: miId }, { idReceptor: miId }],
      },
    });

    if (!relacion) {
      res.status(404).json({ error: 'Relación de amistad no encontrada' });
      return;
    }

    await prisma.amistad.delete({ where: { id: relacion.id } });
    res.json({ message: 'Amistad o solicitud eliminada con éxito' });
  } catch (error) {
    console.error('Error en eliminarAmistad:', error);
    res.status(500).json({ error: 'Error al eliminar amistad' });
  }
};

// 7. CALIFICACIÓN GLOBAL Y RESEÑAS COMUNITARIAS POR JUEGO
export const obtenerResenasComunidad = async (req, res) => {
  const titulo = String(req.query.titulo || '').trim();

  if (!titulo) {
    res.status(400).json({ error: 'El título del juego es requerido' });
    return;
  }

  try {
    const entradas = await prisma.juegoUsuario.findMany({
      where: {
        tituloJuego: { equals: titulo, mode: 'insensitive' },
        OR: [
          { calificacion: { not: null } },
          { comentario: { not: '' } },
        ],
      },
      include: {
        usuario: {
          select: { id: true, nombre: true, username: true, avatar: true },
        },
      },
      orderBy: { actualizadoEn: 'desc' },
      take: 50,
    });

    const notas = entradas.map((e) => e.calificacion).filter((n) => n != null && n > 0);
    const suma = notas.reduce((acc, curr) => acc + curr, 0);
    const promedio = notas.length > 0 ? (suma / notas.length).toFixed(1) : null;

    const resenas = entradas.map((e) => ({
      id: e.id,
      calificacion: e.calificacion,
      comentario: e.comentario,
      estado: e.estado,
      actualizadoEn: e.actualizadoEn,
      autor: e.usuario,
    }));

    res.json({
      promedio: promedio ? Number(promedio) : null,
      totalVotos: notas.length,
      resenas,
    });
  } catch (error) {
    console.error('Error en obtenerResenasComunidad:', error);
    res.status(500).json({ error: 'Error al consultar reseñas de la comunidad' });
  }
};
