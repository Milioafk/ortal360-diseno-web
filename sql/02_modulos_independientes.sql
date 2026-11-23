-- Ejecutar en la base portal360 ya existente (Neon). No destruye tablas ni registros.
CREATE TABLE IF NOT EXISTS portal_modulo_items (
 id BIGSERIAL PRIMARY KEY,
 modulo VARCHAR(20) NOT NULL CHECK (modulo IN ('sat','metrobus','crm','agua')),
 usuario_id BIGINT NOT NULL REFERENCES portal_usuarios(id),
 codigo VARCHAR(32) NOT NULL UNIQUE,
 datos JSONB NOT NULL CHECK (jsonb_typeof(datos) = 'object'),
 estado VARCHAR(24) NOT NULL DEFAULT 'registrado',
 creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_modulo_items_modulo_usuario ON portal_modulo_items(modulo,usuario_id,id DESC);
