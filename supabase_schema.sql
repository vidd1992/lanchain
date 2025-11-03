-- ================================================
-- SCRIPT SQL PARA SUPABASE
-- Tablas de historial conversacional con idEmpresa
-- ================================================

-- 1. Crear tabla de sesiones de conversación
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  user_id TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Constraint único por sesión y empresa
  CONSTRAINT unique_session_empresa UNIQUE (session_id, id_empresa)
);

-- 2. Crear tabla de mensajes de conversación
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Foreign key a sessions
  CONSTRAINT fk_session
    FOREIGN KEY (session_id, id_empresa)
    REFERENCES conversation_sessions(session_id, id_empresa)
    ON DELETE CASCADE
);

-- 3. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_sessions_empresa
  ON conversation_sessions(id_empresa, last_activity DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_last_activity
  ON conversation_sessions(last_activity DESC);

CREATE INDEX IF NOT EXISTS idx_messages_session
  ON conversation_messages(session_id, id_empresa, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_empresa
  ON conversation_messages(id_empresa, created_at DESC);

-- 4. Crear función para actualizar last_activity automáticamente
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation_sessions
  SET last_activity = NOW()
  WHERE session_id = NEW.session_id
    AND id_empresa = NEW.id_empresa;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Crear trigger para actualizar last_activity cuando se inserta un mensaje
DROP TRIGGER IF EXISTS trigger_update_session_activity ON conversation_messages;
CREATE TRIGGER trigger_update_session_activity
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- 6. Habilitar Row Level Security (RLS) - IMPORTANTE para seguridad
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- 7. Crear políticas de seguridad (ajustar según tu caso)
-- Permitir acceso completo a usuarios autenticados (ajustar según necesidad)
CREATE POLICY "Permitir acceso a sesiones por empresa"
  ON conversation_sessions
  FOR ALL
  USING (true); -- Cambiar por: id_empresa = auth.jwt() ->> 'id_empresa'

CREATE POLICY "Permitir acceso a mensajes por empresa"
  ON conversation_messages
  FOR ALL
  USING (true); -- Cambiar por: id_empresa = auth.jwt() ->> 'id_empresa'

-- ================================================
-- QUERIES ÚTILES PARA VERIFICAR
-- ================================================

-- Ver todas las tablas creadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'conversation%';

-- Ver índices creados
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename LIKE 'conversation%';

-- Verificar triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table LIKE 'conversation%';

-- ================================================
-- QUERIES DE EJEMPLO PARA TESTING
-- ================================================

-- Insertar sesión de prueba
INSERT INTO conversation_sessions (session_id, id_empresa, user_id)
VALUES ('test-session-1', 'empresa-001', 'user-123')
ON CONFLICT (session_id, id_empresa)
DO UPDATE SET last_activity = NOW();

-- Insertar mensaje de prueba
INSERT INTO conversation_messages (session_id, id_empresa, role, content, metadata)
VALUES (
  'test-session-1',
  'empresa-001',
  'user',
  '¿Qué cursos ofrecen?',
  '{"source": "web"}'::jsonb
);

-- Ver sesiones de una empresa
SELECT * FROM conversation_sessions
WHERE id_empresa = 'empresa-001'
ORDER BY last_activity DESC
LIMIT 10;

-- Ver mensajes de una sesión
SELECT * FROM conversation_messages
WHERE session_id = 'test-session-1'
  AND id_empresa = 'empresa-001'
ORDER BY created_at DESC
LIMIT 20;

-- Contar mensajes por empresa
SELECT
  id_empresa,
  COUNT(*) as total_mensajes,
  COUNT(DISTINCT session_id) as total_sesiones
FROM conversation_messages
GROUP BY id_empresa;

-- ================================================
-- LIMPIEZA (solo si necesitas borrar todo)
-- ================================================

-- DROP TRIGGER IF EXISTS trigger_update_session_activity ON conversation_messages;
-- DROP FUNCTION IF EXISTS update_session_activity();
-- DROP TABLE IF EXISTS conversation_messages CASCADE;
-- DROP TABLE IF EXISTS conversation_sessions CASCADE;
