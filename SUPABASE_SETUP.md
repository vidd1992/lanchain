# 🚀 Configuración de Supabase para Historial Conversacional

## 📋 Pasos para configurar

### 1️⃣ Crear cuenta en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Crea una cuenta gratuita
3. Crea un nuevo proyecto

### 2️⃣ Obtener credenciales

1. En tu proyecto, ve a **Settings** → **API**
2. Copia:
   - **Project URL** (ej: `https://xxxxx.supabase.co`)
   - **anon/public key** (la key `anon public`)

### 3️⃣ Configurar variables de entorno

Edita tu archivo `.env`:

```bash
# Supabase Configuration
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### 4️⃣ Crear tablas en Supabase

1. En Supabase, ve a **SQL Editor**
2. Copia y pega todo el contenido de `supabase_schema.sql`
3. Ejecuta el script (botón **Run**)
4. Verifica que las tablas se crearon en **Table Editor**

### 5️⃣ Verificar instalación

Ejecuta el script de prueba:

```bash
node examples/test_supabase.js
```

## 📊 Estructura de las tablas

### `conversation_sessions`

Almacena información de cada sesión de conversación.

| Campo           | Tipo      | Descripción                   |
| --------------- | --------- | ----------------------------- |
| `id`            | UUID      | ID único (auto-generado)      |
| `session_id`    | TEXT      | ID de la sesión del usuario   |
| `id_empresa`    | TEXT      | ID de la empresa/organización |
| `user_id`       | TEXT      | ID del usuario (opcional)     |
| `summary`       | TEXT      | Resumen de la conversación    |
| `created_at`    | TIMESTAMP | Fecha de creación             |
| `last_activity` | TIMESTAMP | Última actividad              |
| `metadata`      | JSONB     | Metadata adicional            |

### `conversation_messages`

Almacena cada mensaje de las conversaciones.

| Campo        | Tipo      | Descripción                    |
| ------------ | --------- | ------------------------------ |
| `id`         | UUID      | ID único (auto-generado)       |
| `session_id` | TEXT      | Referencia a la sesión         |
| `id_empresa` | TEXT      | ID de la empresa               |
| `role`       | TEXT      | 'user' o 'assistant'           |
| `content`    | TEXT      | Contenido del mensaje          |
| `created_at` | TIMESTAMP | Fecha de creación              |
| `metadata`   | JSONB     | Metadata (source, score, etc.) |

## 🔐 Seguridad (Row Level Security)

Por defecto, las tablas tienen RLS habilitado con políticas permisivas (`USING (true)`).

**⚠️ IMPORTANTE:** Antes de producción, debes cambiar las políticas para restringir acceso:

```sql
-- Ejemplo: Solo permitir acceso a datos de la propia empresa
CREATE POLICY "Empresas ven solo sus datos"
  ON conversation_messages
  FOR ALL
  USING (id_empresa = auth.jwt() ->> 'id_empresa');
```

## 📈 Queries útiles

### Ver todas las sesiones de una empresa

```sql
SELECT * FROM conversation_sessions
WHERE id_empresa = 'tu-empresa-id'
ORDER BY last_activity DESC;
```

### Ver mensajes de una sesión

```sql
SELECT * FROM conversation_messages
WHERE session_id = 'session-123'
  AND id_empresa = 'tu-empresa-id'
ORDER BY created_at ASC;
```

### Estadísticas por empresa

```sql
SELECT
  id_empresa,
  COUNT(DISTINCT session_id) as total_sesiones,
  COUNT(*) as total_mensajes
FROM conversation_messages
GROUP BY id_empresa;
```

## 🎯 Uso en tu código

### Crear agente con idEmpresa

```javascript
import { RAGAgent } from './src/index.js';

// Crear agente para empresa específica
const agent = new RAGAgent(
  'user-session-123', // sessionId
  false, // useLangChainChains
  'empresa-001' // idEmpresa ✨ NUEVO
);

await agent.initialize();
await agent.query('¿Qué cursos ofrecen?');
```

### Ver historial desde Supabase

```javascript
// El historial se carga automáticamente desde Supabase
// si no está en caché en memoria
const history = await agent.historyManager.getHistory('user-session-123');
console.log(`Total mensajes: ${history.length}`);
```

## 🔧 Troubleshooting

### Error: "relation conversation_sessions does not exist"

- Las tablas no se crearon correctamente
- Ve a SQL Editor y ejecuta `supabase_schema.sql`

### Error: "invalid authentication token"

- Verifica que `SUPABASE_ANON_KEY` es correcta
- Debe ser la clave `anon/public`, no la `service_role`

### Los mensajes no se guardan

- Verifica que `SUPABASE_URL` y `SUPABASE_ANON_KEY` están en `.env`
- Revisa la consola para ver errores de Supabase

### RLS bloqueando queries

- Las políticas de RLS podrían estar muy restrictivas
- Para testing, puedes deshabilitarlas temporalmente:
  ```sql
  ALTER TABLE conversation_sessions DISABLE ROW LEVEL SECURITY;
  ALTER TABLE conversation_messages DISABLE ROW LEVEL SECURITY;
  ```

## 💡 Ventajas de esta implementación

✅ **Caché en memoria**: Respuestas instantáneas (1-2ms)
✅ **Persistencia en Supabase**: Los datos nunca se pierden
✅ **Multi-empresa**: Cada empresa tiene sus propios datos
✅ **Escalable**: Soporta millones de mensajes
✅ **Async writes**: No bloquea las respuestas del usuario
✅ **Backup automático**: Supabase hace backups diarios
✅ **Real-time**: Puedes agregar subscriptions después

## 📚 Recursos

- [Documentación de Supabase](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
