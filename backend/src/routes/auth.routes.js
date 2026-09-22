import { Router } from 'express';
import { actualizarPerfil, login, registro, yo } from '../controllers/auth.controller.js';
import { requerirAuth } from '../middleware/auth.js';

const router = Router();

router.post('/auth/registro', registro);
router.post('/auth/login', login);
router.get('/auth/yo', requerirAuth, yo);
router.patch('/auth/perfil', requerirAuth, actualizarPerfil);

export default router;
