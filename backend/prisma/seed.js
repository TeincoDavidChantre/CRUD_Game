import 'dotenv/config'; // <--- OBLIGATORIO: Carga el archivo .env
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando carga de datos de prueba...');

  // 1. Crear o recuperar el usuario de prueba
  const usuario = await prisma.usuario.upsert({
    where: { email: 'gamer@prueba.com' },
    update: {},
    create: {
      nombre: 'Jugador Pruebas',
      email: 'gamer@prueba.com',
      password: 'password123',
    },
  });

  console.log(`👤 Usuario de prueba listo con ID: ${usuario.id}`);

  // 2. Lista de juegos de prueba
  const juegosIniciales = [
    {
      tituloJuego: 'The Legend of Zelda: Tears of the Kingdom',
      urlPortada: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co5vmg.jpg',
      estado: 'COMPLETADO',
    },
    {
      tituloJuego: 'Elden Ring',
      urlPortada: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg',
      estado: 'JUGANDO',
    },
    {
      tituloJuego: 'Cyberpunk 2077',
      urlPortada: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg',
      estado: 'PENDIENTE',
    },
  ];

  // 3. Insertar juegos asociados al usuario
  for (const juego of juegosIniciales) {
    await prisma.juegoUsuario.upsert({
      where: {
        idUsuario_tituloJuego: {
          idUsuario: usuario.id,
          tituloJuego: juego.tituloJuego,
        },
      },
      update: {},
      create: {
        idUsuario: usuario.id,
        tituloJuego: juego.tituloJuego,
        urlPortada: juego.urlPortada,
        estado: juego.estado,
      },
    });
  }

  console.log('✅ Carga de datos iniciales completada con éxito.');
  console.log(`💡 Guarda este ID para probar tus endpoints: ${usuario.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Error al cargar datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });