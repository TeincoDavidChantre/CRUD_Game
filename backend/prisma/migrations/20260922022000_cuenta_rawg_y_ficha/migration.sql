-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "username" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "rawgApiKey" TEXT;

UPDATE "Usuario"
SET "username" = split_part("email", '@', 1) || '-' || substr("id", 1, 8)
WHERE "username" IS NULL;

ALTER TABLE "Usuario" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- AlterTable
ALTER TABLE "JuegoUsuario" ADD COLUMN "descripcion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "JuegoUsuario" ADD COLUMN "plataformas" TEXT NOT NULL DEFAULT '';
ALTER TABLE "JuegoUsuario" ADD COLUMN "generos" TEXT NOT NULL DEFAULT '';
ALTER TABLE "JuegoUsuario" ADD COLUMN "idRawg" INTEGER;
ALTER TABLE "JuegoUsuario" ADD COLUMN "etiquetas" TEXT NOT NULL DEFAULT '';
ALTER TABLE "JuegoUsuario" ADD COLUMN "comentario" TEXT NOT NULL DEFAULT '';
ALTER TABLE "JuegoUsuario" ADD COLUMN "calificacion" INTEGER;
