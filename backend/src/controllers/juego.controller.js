// Controlador con las operaciones CRUD basicas para enviar la peticion a al base de datos
import { prisma } from '../lib/prisma.js';

// Obtener todos los juegos de un usuario
export const obtenerJuegos = async (req, res) => {
  const { idUsuario } = req.params;
  try {
    const juegos = await prisma.juegoUsuario.findMany({
      where: { idUsuario },
      orderBy: { creadoEn: 'desc' },
    });
    res.json(juegos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la lista de juegos' });
  }
};

// Agregar un nuevo juego a la biblioteca
export const crearJuego = async (req, res) => {
  const { idUsuario, tituloJuego, urlPortada, estado } = req.body;
  try {
    const nuevoJuego = await prisma.juegoUsuario.create({
      data: {
        idUsuario,
        tituloJuego,
        urlPortada,
        estado,
      },
    });
    res.status(201).json(nuevoJuego);
  } catch (error) {
    // P2002 es el código de error de Prisma cuando se viola una restricción única
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El juego ya se encuentra registrado en tu biblioteca' });
    }
    res.status(500).json({ error: 'Error al registrar el juego' });
  }
};