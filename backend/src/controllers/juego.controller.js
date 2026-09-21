// Controlador con las operaciones CRUD basicas para enviar la peticion a al base de datos
import { prisma } from '../lib/prisma.js';

// 1. Obtener todos los juegos de un usuario (HU01.4)
export const obtenerJuegos = async (req, res) => {
  const { idUsuario } = req.params;

  try {
    const juegos = await prisma.juegoUsuario.findMany({
      where: { idUsuario },
      orderBy: { creadoEn: 'desc' },
    });
    res.json(juegos);
  } catch (error) {
    console.error('Error en GET /api/juegos:', error); // Muestra el fallo exacto en la terminal
    res.status(500).json({ error: 'Error al obtener la lista de juegos' });
  }
};

// 2. Registrar un nuevo juego en la biblioteca (HU01.1)
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
    // P2002 indica violación de restricción única (juego duplicado)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El juego ya se encuentra en tu biblioteca' });
    }
    res.status(500).json({ error: 'Error al registrar el juego' });
  }
};

// 3. Cambiar el estado de avance de un juego (HU01.2)
export const actualizarEstadoJuego = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const juegoActualizado = await prisma.juegoUsuario.update({
      where: { id },
      data: { estado },
    });
    res.json(juegoActualizado);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el estado del juego' });
  }
};

// 4. Eliminar un juego de la biblioteca (HU01.3)
export const eliminarJuego = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.juegoUsuario.delete({
      where: { id },
    });
    res.json({ message: 'Juego eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el juego' });
  }
};