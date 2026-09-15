// Modulo que conecta la base de datos
import prismaPkg from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const { PrismaClient } = prismaPkg;

// Configuración del pool de conexiones con PostgreSQL
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// Instancia global exportada
export const prisma = new PrismaClient({ adapter });