import 'dotenv/config';
import express from 'express';
import cors from 'cors';
// se importa las rutas creadas para la API
import authRoutes from './src/routes/auth.routes.js';
import juegoRoutes from './src/routes/juego.routes.js';
import catalogoRoutes from './src/routes/catalogo.routes.js';
import socialRoutes from './src/routes/social.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas de la API
app.use('/api', authRoutes);
app.use('/api', catalogoRoutes);
app.use('/api', juegoRoutes);
app.use('/api', socialRoutes);

// Ruta de prueba (Healthcheck)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando correctamente' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});