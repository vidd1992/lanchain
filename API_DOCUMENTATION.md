# 📡 API REST - RAG Agent CEC-EPN

API REST para el agente conversacional RAG (Retrieval-Augmented Generation) del Centro de Educación Continua de la EPN.

## 🚀 Inicio Rápido

### Instalación

```bash
npm install
```

### Configuración

Asegúrate de tener las siguientes variables en tu archivo `.env`:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Pinecone
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=...

# Supabase
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=...

# Perplexity (opcional para fallback)
PERPLEXITY_API_KEY=pplx-...

# Puerto del servidor (opcional, default: 3001)
PORT=3001
```

### Iniciar el Servidor

```bash
npm run start-api
```

El servidor estará disponible en: `http://localhost:3001`

---

## 📌 Endpoints Disponibles

### 1️⃣ Health Check

**Verificar el estado del servidor**

```http
GET /api/health
```

#### Respuesta

```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2025-11-03T21:08:43.641Z",
  "activeAgents": 0
}
```

---

### 2️⃣ Chat con el Agente

**Realizar una consulta al agente RAG**

```http
POST /api/chat
```

#### Body (JSON)

```json
{
  "sessionId": "session-001",
  "idEmpresa": "empresa-demo",
  "query": "¿Qué cursos de Excel ofrecen?"
}
```

#### Parámetros

| Campo       | Tipo   | Requerido | Descripción                           |
| ----------- | ------ | --------- | ------------------------------------- |
| `sessionId` | string | ✅        | ID único de la sesión de conversación |
| `idEmpresa` | string | ✅        | ID de la empresa (multi-tenant)       |
| `query`     | string | ✅        | Pregunta del usuario                  |

#### Respuesta Exitosa

```json
{
  "success": true,
  "data": {
    "sessionId": "session-001",
    "idEmpresa": "empresa-demo",
    "query": "¿Qué cursos de Excel ofrecen?",
    "answer": "El Centro de Educación Continua ofrece...",
    "source": "rag",
    "ragResults": [
      {
        "content": "Excel 1: Fundamentos...",
        "metadata": {
          "filename": "excel_cursos.txt",
          "category": "tecnologicos"
        },
        "score": 0.89
      }
    ],
    "citations": ["https://www.cec-epn.edu.ec/cursos/excel-1"],
    "timestamp": "2025-11-03T21:09:07.748Z"
  }
}
```

#### Posibles Valores de `source`

- `rag`: Respuesta generada desde la base de conocimiento local
- `perplexity`: Respuesta generada por Perplexity (fallback cuando no hay resultados en RAG)

---

### 3️⃣ Obtener Historial de Conversación

**Recuperar el historial de mensajes de una sesión**

```http
GET /api/history/:sessionId?idEmpresa=<ID>&limit=<LIMIT>
```

#### Parámetros

| Parámetro   | Tipo           | Requerido | Descripción                             |
| ----------- | -------------- | --------- | --------------------------------------- |
| `sessionId` | string (path)  | ✅        | ID de la sesión                         |
| `idEmpresa` | string (query) | ✅        | ID de la empresa                        |
| `limit`     | number (query) | ❌        | Número máximo de mensajes (default: 50) |

#### Ejemplo

```bash
curl "http://localhost:3001/api/history/session-001?idEmpresa=empresa-demo&limit=20"
```

#### Respuesta

```json
{
  "success": true,
  "data": {
    "sessionId": "session-001",
    "idEmpresa": "empresa-demo",
    "messages": [
      {
        "id": "76f74031-3d27-4714-8b6f-38cc0dcf99f9",
        "session_id": "session-001",
        "id_empresa": "empresa-demo",
        "role": "assistant",
        "content": "El Centro de Educación Continua...",
        "created_at": "2025-11-03T21:09:08.104662+00:00",
        "metadata": {}
      },
      {
        "id": "aa6ebf13-1544-402b-a4f3-656e9d7e0d7d",
        "session_id": "session-001",
        "id_empresa": "empresa-demo",
        "role": "user",
        "content": "¿Qué cursos de Excel ofrecen?",
        "created_at": "2025-11-03T21:09:08.225562+00:00",
        "metadata": {}
      }
    ],
    "count": 2
  }
}
```

---

### 4️⃣ Listar Sesiones de una Empresa

**Obtener todas las sesiones de conversación de una empresa**

```http
GET /api/sessions/:idEmpresa
```

#### Ejemplo

```bash
curl "http://localhost:3001/api/sessions/empresa-demo"
```

#### Respuesta

```json
{
  "success": true,
  "data": {
    "idEmpresa": "empresa-demo",
    "sessions": [
      {
        "id": "9f999d16-f18a-4326-afd6-3e7494c763c5",
        "session_id": "session-001",
        "id_empresa": "empresa-demo",
        "user_id": null,
        "summary": null,
        "created_at": "2025-11-03T21:09:07.903431+00:00",
        "last_activity": "2025-11-03T21:09:08.225562+00:00",
        "metadata": {}
      }
    ],
    "count": 1
  }
}
```

---

### 5️⃣ Estadísticas de Empresa

**Obtener métricas agregadas de una empresa**

```http
GET /api/stats/:idEmpresa
```

#### Ejemplo

```bash
curl "http://localhost:3001/api/stats/empresa-demo"
```

#### Respuesta

```json
{
  "success": true,
  "data": {
    "idEmpresa": "empresa-demo",
    "totalSessions": 1,
    "totalMessages": 2,
    "lastActivity": "2025-11-03T21:09:08.225562+00:00"
  }
}
```

---

### 6️⃣ Eliminar Sesión

**Limpiar el caché del agente para una sesión (no elimina datos de Supabase)**

```http
DELETE /api/session/:sessionId?idEmpresa=<ID>
```

#### Ejemplo

```bash
curl -X DELETE "http://localhost:3001/api/session/session-001?idEmpresa=empresa-demo"
```

#### Respuesta

```json
{
  "success": true,
  "message": "Sesión cerrada correctamente"
}
```

---

## 🔧 Códigos de Error

### 400 Bad Request

```json
{
  "success": false,
  "error": "Faltan parámetros requeridos: sessionId, idEmpresa, query"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "No se encontró historial para esta sesión"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Error al procesar la consulta",
  "details": "..."
}
```

---

## 🧪 Ejemplos de Uso

### Node.js (fetch)

```javascript
const response = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: 'user-123-session',
    idEmpresa: 'empresa-001',
    query: '¿Cuándo inicia el curso de Python?',
  }),
});

const data = await response.json();
console.log(data.data.answer);
```

### Python (requests)

```python
import requests

response = requests.post(
    'http://localhost:3001/api/chat',
    json={
        'sessionId': 'user-123-session',
        'idEmpresa': 'empresa-001',
        'query': '¿Cuándo inicia el curso de Python?'
    }
)

data = response.json()
print(data['data']['answer'])
```

### cURL

```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "sessionId": "user-123-session",
    "idEmpresa": "empresa-001",
    "query": "¿Cuándo inicia el curso de Python?"
  }'
```

---

## 🏗️ Arquitectura

### Multi-Tenancy

- Cada empresa tiene su propio `idEmpresa`
- Los datos se aíslan por empresa en Supabase
- Las sesiones son únicas por combinación de `(sessionId, idEmpresa)`

### Gestión de Agentes

- Los agentes se instancian bajo demanda
- Se mantienen en memoria (Map) por clave `${idEmpresa}-${sessionId}`
- Se reutilizan entre llamadas para mantener el contexto

### Persistencia

- **Memoria RAM**: Caché temporal para agentes activos
- **Supabase**: Persistencia permanente de conversaciones
- **Híbrido**: Se lee de memoria primero, fallback a Supabase

### Flujo de Búsqueda

1. Búsqueda semántica en Pinecone (vectores)
2. Si no hay resultados relevantes (score < 0.7), se consulta Perplexity
3. Se guarda el historial en Supabase de forma asíncrona

---

## 🔒 Seguridad

### Recomendaciones para Producción

1. **Autenticación**: Implementar JWT o API Keys
2. **Rate Limiting**: Usar `express-rate-limit`
3. **Validación**: Instalar `express-validator`
4. **CORS**: Configurar dominios permitidos específicos
5. **HTTPS**: Usar certificados SSL en producción
6. **Secrets**: Nunca exponer `.env` en repositorio

### Ejemplo de Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por IP
});

app.use('/api/', limiter);
```

---

## 📊 Monitoreo

### Logs del Servidor

El servidor emite logs en consola con emojis:

- ✅ Operaciones exitosas
- ⚠️ Advertencias (sin resultados en RAG)
- ❌ Errores críticos
- 🔍 Búsquedas en progreso
- 💾 Guardado de datos

### Métricas Internas

El agente RAG incluye un `MetricsTracker` que registra:

- Latencias de búsqueda
- Uso de LLM (tokens)
- Tasa de fallback a Perplexity
- Calidad de respuestas (scores)

---

## 🛠️ Troubleshooting

### El servidor no inicia

```bash
# Verificar que el puerto esté libre
lsof -i :3001

# Matar el proceso si está ocupado
kill -9 <PID>
```

### Error "Supabase not initialized"

1. Verificar credenciales en `.env`
2. Verificar que las tablas existan en Supabase
3. Ejecutar el script SQL: `supabase_schema.sql`

### Error "Pinecone index not found"

1. Verificar `PINECONE_INDEX_NAME` en `.env`
2. Crear el índice con: `npm run setup`

### Respuestas lentas

- Usar modo `Custom` (más rápido que `Chains`)
- Verificar latencia de red a Pinecone/OpenAI
- Considerar implementar caché (Sprint 3)

---

## 📚 Referencias

- [LangChain Documentation](https://js.langchain.com/docs/)
- [Pinecone Docs](https://docs.pinecone.io/)
- [Supabase Docs](https://supabase.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)

---

## 📝 Changelog

### v1.0.0 (2025-11-03)

- ✅ REST API completa con 6 endpoints
- ✅ Multi-tenancy con `idEmpresa`
- ✅ Persistencia en Supabase
- ✅ Memoria híbrida (RAM + DB)
- ✅ Detección de tipo de curso (programado/bajo demanda)
- ✅ Fallback a Perplexity
- ✅ Health check y estadísticas

---

## 👨‍💻 Soporte

Para dudas o problemas, contactar a:

- **Desarrollador**: David Mejía
- **Proyecto**: Coonverso - CEC-EPN
- **Fecha**: Noviembre 2025
