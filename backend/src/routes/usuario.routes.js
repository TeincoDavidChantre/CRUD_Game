import { Router } from 'express';
import { obtenerUsuarioPrueba } from '../controllers/usuario.controller.js';

const router = Router();

router.get('/usuarios/prueba', obtenerUsuarioPrueba);

export default router;
