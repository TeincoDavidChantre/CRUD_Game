import { Router } from 'express';
import {
  buscarUsuarios,
  eliminarAmistad,
  enviarSolicitudAmistad,
  obtenerAmigosYSolicitudes,
  obtenerPerfilPublico,
  obtenerResenasComunidad,
  responderSolicitudAmistad,
} from '../controllers/social.controller.js';
import { requerirAuth } from '../middleware/auth.js';

const router = Router();

// Perfiles y búsqueda de jugadores
router.get('/usuarios/buscar', requerirAuth, buscarUsuarios);
router.get('/usuarios/:username', requerirAuth, obtenerPerfilPublico);

// Sistema de amigos y solicitudes
router.get('/social/amigos', requerirAuth, obtenerAmigosYSolicitudes);
router.post('/social/solicitar/:idUsuario', requerirAuth, enviarSolicitudAmistad);
router.patch('/social/solicitudes/:idAmistad', requerirAuth, responderSolicitudAmistad);
router.delete('/social/amigos/:idAmistad', requerirAuth, eliminarAmistad);

// Calificación comunitaria y reseñas
router.get('/social/comunidad/juego', requerirAuth, obtenerResenasComunidad);

export default router;
