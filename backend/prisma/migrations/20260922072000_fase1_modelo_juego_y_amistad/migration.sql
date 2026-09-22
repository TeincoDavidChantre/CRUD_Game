-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoAmistad') THEN
        CREATE TYPE "EstadoAmistad" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA');
    END IF;
END $$;

-- AlterTable Usuario
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "avatar" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "biografia" TEXT NOT NULL DEFAULT '';

-- CreateTable Juego
CREATE TABLE IF NOT EXISTS "Juego" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "slug" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "urlPortada" TEXT,
    "plataformas" TEXT NOT NULL DEFAULT '',
    "sistemas" TEXT NOT NULL DEFAULT '',
    "generos" TEXT NOT NULL DEFAULT '',
    "metacritic" INTEGER,
    "desarrollador" TEXT NOT NULL DEFAULT '',
    "anoLanzamiento" INTEGER,
    "enlacesTienda" TEXT NOT NULL DEFAULT '{}',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Juego_pkey" PRIMARY KEY ("id")
);

-- AlterTable JuegoUsuario
ALTER TABLE "JuegoUsuario" ADD COLUMN IF NOT EXISTS "idJuego" TEXT;

-- CreateTable Amistad
CREATE TABLE IF NOT EXISTS "Amistad" (
    "id" TEXT NOT NULL,
    "idSolicitante" TEXT NOT NULL,
    "idReceptor" TEXT NOT NULL,
    "estado" "EstadoAmistad" NOT NULL DEFAULT 'PENDIENTE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Amistad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Juego_externalId_key" ON "Juego"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Amistad_idSolicitante_idReceptor_key" ON "Amistad"("idSolicitante", "idReceptor");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JuegoUsuario_idJuego_fkey') THEN
        ALTER TABLE "JuegoUsuario" ADD CONSTRAINT "JuegoUsuario_idJuego_fkey" FOREIGN KEY ("idJuego") REFERENCES "Juego"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Amistad_idSolicitante_fkey') THEN
        ALTER TABLE "Amistad" ADD CONSTRAINT "Amistad_idSolicitante_fkey" FOREIGN KEY ("idSolicitante") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Amistad_idReceptor_fkey') THEN
        ALTER TABLE "Amistad" ADD CONSTRAINT "Amistad_idReceptor_fkey" FOREIGN KEY ("idReceptor") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
