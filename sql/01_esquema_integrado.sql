-- Esquema NO destructivo: una sola base de datos, cuatro módulos, usuarios compartidos.
-- Ejecutar con Neon SQL Editor; no ejecuta TRUNCATE ni elimina tablas existentes.
CREATE TABLE IF NOT EXISTS portal_usuarios (
 id BIGSERIAL PRIMARY KEY,
 nombre VARCHAR(120) NOT NULL,
 correo VARCHAR(180) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 rol VARCHAR(20) NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente','operador','administrador')),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS portal_registros (
 id BIGSERIAL PRIMARY KEY,
 modulo VARCHAR(20) NOT NULL CHECK (modulo IN ('sat','metrobus','crm','agua')),
 usuario_id BIGINT NOT NULL REFERENCES portal_usuarios(id),
 titulo VARCHAR(160) NOT NULL,
 detalle TEXT NOT NULL,
 estado VARCHAR(24) NOT NULL DEFAULT 'registrado' CHECK (estado IN ('registrado','en_revision','atendido')),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portal_registros_modulo_fecha ON portal_registros (modulo, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_portal_registros_usuario ON portal_registros (usuario_id);
