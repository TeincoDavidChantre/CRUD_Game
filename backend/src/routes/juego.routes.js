// Archivo de rutas para las peticiones a la base de datos  
import { Router } from 'express';
import { 
  obtenerJuegos, 
  crearJuego, 
  actualizarEstadoJuego, 
  eliminarJuego 
} from '../controllers/juego.controller.js';

const router = Router();

router.get('/juegos/:idUsuario', obtenerJuegos);
router.post('/juegos', crearJuego);
router.patch('/juegos/:id', actualizarEstadoJuego);
router.delete('/juegos/:id', eliminarJuego);

export default router;