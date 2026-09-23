-- Taxonomía: temáticas separadas de géneros (mecánicas)
ALTER TABLE "Juego" ADD COLUMN IF NOT EXISTS "tematicas" TEXT NOT NULL DEFAULT '';
ALTER TABLE "JuegoUsuario" ADD COLUMN IF NOT EXISTS "tematicas" TEXT NOT NULL DEFAULT '';
