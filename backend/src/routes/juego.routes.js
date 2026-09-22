import { Router } from 'express';
import {
  obtenerJuegos,
  crearJuego,
  actualizarJuego,
  eliminarJuego,
} from '../controllers/juego.controller.js';
import { requerirAuth } from '../middleware/auth.js';

const router = Router();

router.get('/juegos', requerirAuth, obtenerJuegos);
router.post('/juegos', requerirAuth, crearJuego);
router.patch('/juegos/:id', requerirAuth, actualizarJuego);
router.delete('/juegos/:id', requerirAuth, eliminarJuego);

export default router;
