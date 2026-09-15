import prismaPkg from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const { PrismaClient } = prismaPkg;

// 1. Crear el pool de conexiones nativo de PostgreSQL usando la variable del .env
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// 2. Envolver el pool en el adaptador de Prisma 7
const adapter = new PrismaPg(pool);

// 3. Inicializar PrismaClient pasándole el adaptador
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    console.log('Conectando a la base de datos PostgreSQL...');
    await prisma.$connect();
    console.log('¡Conexión establecida con éxito!');
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();