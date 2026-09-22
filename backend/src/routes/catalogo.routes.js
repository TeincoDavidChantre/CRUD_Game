import { Router } from 'express';
import {
  buscarJuegos,
  detalleJuego,
  obtenerRecomendaciones,
  obtenerSugerenciasInicio,
  obtenerTendencias,
} from '../controllers/catalogo.controller.js';
import { requerirAuth } from '../middleware/auth.js';

const router = Router();

router.get('/catalogo/sugerencias', requerirAuth, obtenerSugerenciasInicio);
router.get('/catalogo/tendencias', requerirAuth, obtenerTendencias);
router.get('/catalogo/recomendaciones', requerirAuth, obtenerRecomendaciones);
router.get('/catalogo/buscar', requerirAuth, buscarJuegos);
router.get('/catalogo/juegos/:idFuente', requerirAuth, detalleJuego);

export default router;
