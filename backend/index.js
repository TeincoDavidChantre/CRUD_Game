import 'dotenv/config';
import express from 'express';
import cors from 'cors';
// se importa las rutas creadas para la API
import juegoRoutes from './src/routes/juego.routes.js';
import usuarioRoutes from './src/routes/usuario.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas de la API
app.use('/api', usuarioRoutes);
app.use('/api', juegoRoutes);

// Ruta de prueba (Healthcheck)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando correctamente' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});