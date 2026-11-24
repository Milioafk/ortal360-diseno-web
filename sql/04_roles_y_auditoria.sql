-- Portal360 · Añadidos NO destructivos para permisos por rol.
-- Esquema para ejecutar en la BASE portal360 de Neon.
-- Las contraseñas y los datos de acceso están SOLO en el Excel privado.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE portal_usuarios ADD COLUMN IF NOT EXISTS es_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE portal_usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE portal_usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS portal_staff_modulos (
  usuario_id BIGINT NOT NULL REFERENCES portal_usuarios(id) ON DELETE CASCADE,
  modulo VARCHAR(20) NOT NULL CHECK(modulo IN ('sat','metrobus','crm','agua')),
  PRIMARY KEY (usuario_id,modulo)
);
ALTER TABLE portal_modulo_items ADD COLUMN IF NOT EXISTS asignado_a BIGINT REFERENCES portal_usuarios(id) ON DELETE SET NULL;
ALTER TABLE portal_modulo_items ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TABLE IF NOT EXISTS portal_auditoria (
 id BIGSERIAL PRIMARY KEY,
 actor_id BIGINT REFERENCES portal_usuarios(id) ON DELETE SET NULL,
 accion VARCHAR(72) NOT NULL,
 modulo VARCHAR(20),
 entidad_id BIGINT,
 detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_staff_modulos_modulo ON portal_staff_modulos(modulo);
CREATE INDEX IF NOT EXISTS idx_portal_auditoria_fecha ON portal_auditoria(creado_en DESC);
