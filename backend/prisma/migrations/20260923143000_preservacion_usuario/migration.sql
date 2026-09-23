-- Documentos de preservación añadidos por el usuario (JSON array).
ALTER TABLE "JuegoUsuario" ADD COLUMN IF NOT EXISTS "preservacionUsuarioJson" TEXT NOT NULL DEFAULT '[]';
