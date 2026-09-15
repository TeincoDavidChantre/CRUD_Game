// Archivo de rutas para las peticiones a la base de datos
import { Router } from 'express';
import { obtenerJuegos, crearJuego } from '../controllers/juego.controller.js';

const router = Router();

router.get('/juegos/:idUsuario', obtenerJuegos);
router.post('/juegos', crearJuego);

export default router;