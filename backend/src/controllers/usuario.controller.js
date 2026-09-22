import { prisma } from '../lib/prisma.js';

const EMAIL_PRUEBA = 'gamer@prueba.com';

export const obtenerUsuarioPrueba = async (_req, res) => {
  try {
    const usuario = await prisma.usuario.upsert({
      where: { email: EMAIL_PRUEBA },
      update: {},
      create: {
        nombre: 'Jugador Pruebas',
        email: EMAIL_PRUEBA,
        password: 'password123',
      },
      select: { id: true, nombre: true, email: true },
    });
    res.json(usuario);
  } catch (error) {
    console.error('Error en GET /api/usuarios/prueba:', error);
    res.status(503).json({ error: 'No hay conexión con la base de datos' });
  }
};
