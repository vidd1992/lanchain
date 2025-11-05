# 🚀 Guía de Despliegue del API REST

**Fecha:** 5 de noviembre, 2025  
**Status:** ✅ Production Ready

---

## ⚡ Quick Start

### **1. Iniciar el Servidor**

```bash
npm run start-api
```

**Servidor corriendo en:** `http://localhost:3001`

### **2. Verificar que funciona**

```bash
curl http://localhost:3001/api/health
```

**Respuesta esperada:**
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2025-11-05T05:00:00.000Z"
}
```

### **3. Ejecutar Tests Automáticos**

En otra terminal:

```bash
npm run test-api
```

---

## 📡 Endpoints del API

### **POST /api/chat** - Enviar mensaje

**Endpoint:** `POST http://localhost:3001/api/chat`

**Request Body:**
```json
{
  "sessionId": "session-unique-id",
  "idEmpresa": "empresa-id",
  "query": "¿Qué cursos de inglés tienen?"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answer": "<p>Tenemos varios cursos de inglés...</p>",
    "source": "rag",
    "sessionId": "session-unique-id",
    "idEmpresa": "empresa-id",
    "citations": [],
    "ragResults": [
      {
        "score": 0.85,
        "metadata": {
          "titulo": "IDIOMA INGLÉS",
          "categoria": "idiomas"
        }
      }
    ]
  }
}
```

---

### **GET /api/history/:sessionId** - Obtener historial

**Endpoint:** `GET http://localhost:3001/api/history/:sessionId?idEmpresa=xxx`

**Query Params:**
- `idEmpresa` (requerido)
- `limit` (opcional, default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-unique-id",
    "idEmpresa": "empresa-id",
    "messages": [
      {
        "role": "user",
        "content": "Hola",
        "timestamp": "2025-11-05T05:00:00Z"
      },
      {
        "role": "assistant",
        "content": "¡Hola! ¿En qué puedo ayudarte?",
        "timestamp": "2025-11-05T05:00:05Z"
      }
    ],
    "count": 2
  }
}
```

---

### **GET /api/sessions/:idEmpresa** - Listar sesiones

**Endpoint:** `GET http://localhost:3001/api/sessions/:idEmpresa?limit=50`

**Response:**
```json
{
  "success": true,
  "data": {
    "idEmpresa": "empresa-id",
    "sessions": [
      {
        "sessionId": "session-001",
        "lastMessage": "2025-11-05T05:00:00Z",
        "messageCount": 5
      }
    ]
  }
}
```

---

### **GET /api/stats/:idEmpresa** - Estadísticas

**Endpoint:** `GET http://localhost:3001/api/stats/:idEmpresa`

**Response:**
```json
{
  "success": true,
  "data": {
    "idEmpresa": "empresa-id",
    "totalSessions": 10,
    "totalMessages": 45,
    "avgMessagesPerSession": 4.5
  }
}
```

---

### **DELETE /api/session/:sessionId** - Cerrar sesión

**Endpoint:** `DELETE http://localhost:3001/api/session/:sessionId?idEmpresa=xxx`

**Response:**
```json
{
  "success": true,
  "message": "Sesión limpiada correctamente"
}
```

---

## 💻 Ejemplos de Integración

### **JavaScript/Node.js**

```javascript
const API_URL = 'http://localhost:3001';

async function sendMessage(sessionId, idEmpresa, query) {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId,
      idEmpresa,
      query
    })
  });
  
  const data = await response.json();
  return data;
}

// Usar
const result = await sendMessage(
  'user-123',
  'cec-epn',
  '¿Qué cursos de Python tienen?'
);

console.log(result.data.answer);
```

---

### **Python**

```python
import requests

API_URL = 'http://localhost:3001'

def send_message(session_id, id_empresa, query):
    response = requests.post(
        f'{API_URL}/api/chat',
        json={
            'sessionId': session_id,
            'idEmpresa': id_empresa,
            'query': query
        }
    )
    return response.json()

# Usar
result = send_message(
    'user-123',
    'cec-epn',
    '¿Qué cursos de Python tienen?'
)

print(result['data']['answer'])
```

---

### **React/Next.js**

```typescript
// hooks/useChatAPI.ts
import { useState } from 'react';

export function useChatAPI(sessionId: string, idEmpresa: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (query: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, idEmpresa, query })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }

      return data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, loading, error };
}

// Componente
function ChatWidget() {
  const { sendMessage, loading } = useChatAPI('user-123', 'cec-epn');
  const [messages, setMessages] = useState([]);

  const handleSend = async (query: string) => {
    const response = await sendMessage(query);
    
    setMessages(prev => [
      ...prev,
      { role: 'user', content: query },
      { role: 'assistant', content: response.answer }
    ]);
  };

  return (
    // Tu UI aquí
  );
}
```

---

### **cURL (Testing)**

```bash
# Enviar mensaje
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-123",
    "idEmpresa": "cec-epn",
    "query": "¿Qué cursos ofrecen?"
  }'

# Obtener historial
curl "http://localhost:3001/api/history/test-123?idEmpresa=cec-epn"

# Health check
curl http://localhost:3001/api/health
```

---

## 🔒 Consideraciones de Seguridad

### **1. CORS (Ya configurado)**

El servidor ya tiene CORS habilitado para desarrollo. Para producción, configura:

```javascript
// src/api/server.js
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));
```

Luego en `.env`:
```env
ALLOWED_ORIGINS=https://tu-frontend.com,https://otro-dominio.com
```

### **2. Rate Limiting (Recomendado)**

Instalar:
```bash
npm install express-rate-limit
```

Agregar al servidor:
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests por ventana
});

app.use('/api/', limiter);
```

### **3. Validación de Input (Recomendado)**

```bash
npm install zod
```

```javascript
import { z } from 'zod';

const ChatSchema = z.object({
  sessionId: z.string().min(1).max(100),
  idEmpresa: z.string().min(1).max(100),
  query: z.string().min(1).max(2000)
});

// En el endpoint
const validatedData = ChatSchema.parse(req.body);
```

---

## 🐳 Despliegue con Docker

### **Dockerfile**

Ya tienes un Dockerfile en el proyecto. Para construir:

```bash
docker build -t rag-agent-api .
```

Ejecutar:

```bash
docker run -p 3001:3001 \
  -e OPENAI_API_KEY=your-key \
  -e PINECONE_API_KEY=your-key \
  -e PINECONE_INDEX_NAME=your-index \
  rag-agent-api
```

### **Docker Compose**

```yaml
version: '3.8'
services:
  rag-agent:
    build: .
    ports:
      - "3001:3001"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - PINECONE_API_KEY=${PINECONE_API_KEY}
      - PINECONE_INDEX_NAME=${PINECONE_INDEX_NAME}
      - RAG_SIMILARITY_THRESHOLD=0.5
      - RAG_TOP_K=5
    restart: unless-stopped
```

---

## ☁️ Despliegue en Cloud

### **Opción 1: Railway**

1. Conecta tu repo de GitHub
2. Railway detecta automáticamente Node.js
3. Agrega variables de entorno
4. Deploy automático

### **Opción 2: Render**

1. Conecta repo
2. Build Command: `npm install`
3. Start Command: `npm run start-api`
4. Agrega variables de entorno

### **Opción 3: AWS/GCP/Azure**

Usa el Dockerfile incluido con Kubernetes manifests en `/k8s`

---

## 📊 Monitoreo

### **Logs**

El servidor registra logs a consola. Para producción, integra con:
- **Winston** para logging estructurado
- **Morgan** para logs HTTP
- **Sentry** para error tracking

### **Métricas**

El endpoint `/api/stats/:idEmpresa` proporciona métricas básicas. Para más avanzado:
- **Prometheus** + **Grafana**
- **New Relic** o **Datadog**

---

## 🧪 Testing del API

### **Test Automático**

```bash
npm run test-api
```

### **Test Manual con Postman**

1. Importa la colección (crear `postman_collection.json`)
2. Configura variables de entorno
3. Ejecuta tests

### **Test de Carga**

```bash
npm install -g autocannon

autocannon -c 10 -d 30 \
  -m POST \
  -H "Content-Type: application/json" \
  -b '{"sessionId":"load-test","idEmpresa":"test","query":"test"}' \
  http://localhost:3001/api/chat
```

---

## 🔧 Troubleshooting

### **Puerto 3001 ocupado**

```bash
# Cambiar puerto en .env
PORT=3002

# O matar proceso
lsof -ti:3001 | xargs kill
```

### **CORS errors**

Verifica `ALLOWED_ORIGINS` en `.env` o ajusta configuración CORS

### **Timeout en respuestas**

Aumenta timeout de Node.js o considera implementar streaming

---

## 📚 Recursos

- **Documentación API:** http://localhost:3001/
- **Health Check:** http://localhost:3001/api/health
- **Repositorio:** (tu repo aquí)

---

## ✅ Checklist de Producción

- [ ] Variables de entorno configuradas
- [ ] CORS configurado correctamente
- [ ] Rate limiting activado
- [ ] Logging estructurado (Winston)
- [ ] Error tracking (Sentry)
- [ ] Monitoreo (Prometheus/Grafana)
- [ ] Tests E2E ejecutándose
- [ ] Documentación API actualizada
- [ ] Kubernetes manifests validados
- [ ] Backup strategy definida

---

**¡El API está listo para recibir tráfico!** 🚀
