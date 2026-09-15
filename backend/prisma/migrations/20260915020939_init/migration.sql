-- CreateEnum
CREATE TYPE "EstadoJuego" AS ENUM ('PENDIENTE', 'JUGANDO', 'COMPLETADO', 'ABANDONADO');

-- CreateTable
CREATE TABLE "JuegoUsuario" (
    "id" TEXT NOT NULL,
    "idUsuario" TEXT NOT NULL,
    "tituloJuego" TEXT NOT NULL,
    "urlPortada" TEXT,
    "estado" "EstadoJuego" NOT NULL DEFAULT 'PENDIENTE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JuegoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JuegoUsuario_idUsuario_tituloJuego_key" ON "JuegoUsuario"("idUsuario", "tituloJuego");
