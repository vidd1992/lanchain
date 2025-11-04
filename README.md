# RAG Agent con OpenAI, Pinecone y Perplexity

Un agente conversacional inteligente que combina RAG (Retrieval-Augmented Generation) con Pinecone y OpenAI, con fallback automático a Perplexity AI para consultas que requieren información actualizada.

## Características

- **RAG Inteligente**: Búsqueda de documentos relevantes en Pinecone usando embeddings de OpenAI
- **Fallback Automático**: Si no encuentra información relevante en RAG, consulta automáticamente a Perplexity
- **Historial de Conversaciones**: Mantiene contexto entre consultas usando LangChain Memory
- **Gestión de Sesiones**: Soporte para múltiples sesiones de conversación
- **Threshold Configurable**: Ajusta el umbral de similitud para decidir cuándo usar RAG vs Perplexity
- **Procesamiento Avanzado de Documentos**: Usa LangChain para procesar documentos con chunking óptimo
- **Auto-creación de Índices**: Crea automáticamente el índice en Pinecone si no existe
- **Múltiples Formatos**: Soporta TXT, MD, PDF, CSV, JSON
- **Modo FAQ Especial**: Procesamiento optimizado para preguntas frecuentes

## Arquitectura

```
Usuario → RAG Agent
            ↓
    ┌──────────────┐
    │ Buscar en RAG│
    │  (Pinecone)  │
    └──────┬───────┘
           │
    ¿Resultados relevantes?
           │
    ┌──────┴──────┐
    Sí             No
    ↓              ↓
┌────────┐   ┌─────────┐
│ OpenAI │   │Perplexity│
│  RAG   │   │   API   │
└────────┘   └─────────┘
    │              │
    └──────┬───────┘
           ↓
      Respuesta + Historial
```

## Requisitos

- Node.js >= 18
- Cuenta de OpenAI con API key
- Cuenta de Pinecone con API key
- Cuenta de Perplexity AI con API key

## Instalación Rápida

1. Instala dependencias:

```bash
npm install
```

2. Configura las variables de entorno:

```bash
cp .env.example .env
```

3. Edita el archivo `.env` con tus credenciales:

```env
# OpenAI
OPENAI_API_KEY=tu-api-key-aqui

# Pinecone
PINECONE_API_KEY=tu-pinecone-api-key
PINECONE_INDEX_NAME=mi-rag-index

# Perplexity
PERPLEXITY_API_KEY=tu-perplexity-api-key
```

4. Coloca tus documentos en la carpeta `documents/`:

```bash
# Ya existe un archivo de ejemplo: documents/faq_ejemplo.txt
# Agrega tus propios archivos (.txt, .md, .pdf, .csv, .json)
```

5. Ejecuta el setup (crea índice y sube documentos):

```bash
npm run setup
```

¡Listo! El script:

- ✅ Creará el índice en Pinecone automáticamente (si no existe)
- ✅ Procesará todos los documentos con LangChain
- ✅ Los dividirá en chunks óptimos
- ✅ Los subirá a Pinecone con embeddings

## Uso

### Modo Chat Interactivo

Inicia una conversación con el agente:

```bash
npm run chat
```

### Pruebas Automáticas

```bash
npm test
```

### Agregar Más Documentos Después

Si quieres agregar más documentos sin recrear el índice:

```bash
# 1. Coloca nuevos archivos en documents/
# 2. Ejecuta el setup de nuevo
npm run setup
```

El script detectará que el índice ya existe y solo agregará los nuevos documentos.

## Uso Programático

```javascript
import { RAGAgent, validateConfig } from './src/index.js';

async function main() {
  // Validar configuración
  validateConfig();

  // Crear agente con ID de sesión
  const agent = new RAGAgent('user-123');
  await agent.initialize();

  // Hacer una consulta
  const response = await agent.query('¿Qué es LangChain?');

  console.log('Respuesta:', response.answer);
  console.log('Fuente:', response.source); // 'rag' o 'perplexity'

  // Si la fuente es RAG
  if (response.source === 'rag') {
    console.log('Documentos usados:', response.ragResults.length);
    console.log('Score:', response.ragResults[0].score);
  }

  // Si la fuente es Perplexity
  if (response.source === 'perplexity' && response.citations) {
    console.log('Fuentes:', response.citations);
  }

  // Obtener historial
  const history = await agent.getHistory();
  console.log('Historial:', history);

  // Limpiar historial
  agent.clearHistory();
}

main();
```

## Estructura del Proyecto

```
.
├── src/
│   ├── agent/
│   │   └── rag_agent.js              # Agente principal
│   ├── services/
│   │   ├── pinecone_service.js       # Servicio de Pinecone
│   │   ├── perplexity_service.js     # Servicio de Perplexity
│   │   └── conversation_history.js   # Gestión de historial
│   ├── utils/
│   │   ├── pinecone_setup.js         # Auto-creación de índices
│   │   └── document_processor.js     # Procesamiento con LangChain
│   ├── config/
│   │   └── env.js                    # Configuración
│   └── index.js                      # Exports principales
├── scripts/
│   └── setup_and_upload.js           # Setup automático
├── examples/
│   ├── chat_example.js               # Chat interactivo
│   ├── add_documents.js              # Agregar documentos manualmente
│   └── test_agent.js                 # Pruebas
├── documents/                         # 📁 Coloca tus archivos aquí
│   ├── README.md                     # Guía de formatos
│   └── faq_ejemplo.txt               # Ejemplo de FAQ
├── package.json
├── .env.example
└── README.md
```

## Cómo Funciona

### 1. Procesamiento de Documentos (Setup)

**Cuando ejecutas `npm run setup`:**

1. **Carga de Documentos** - LangChain loaders para cada formato:

   - `.txt`, `.md` → `TextLoader`
   - `.pdf` → `PDFLoader`
   - `.csv` → `CSVLoader`
   - `.json` → `JSONLoader`

2. **Text Splitting** - `RecursiveCharacterTextSplitter`:

   - Divide documentos en chunks de tamaño óptimo (default: 1000 chars)
   - Mantiene overlap (default: 200 chars) para contexto
   - Respeta estructura del documento (párrafos, secciones)

3. **FAQ Especial** - Para archivos `faq_*`:

   - Mantiene cada Q+A como unidad completa
   - No divide las preguntas/respuestas
   - Soporta múltiples formatos (Q:/A:, Markdown, JSON)

4. **Embeddings** - Genera vectores con OpenAI:

   - Usa `text-embedding-3-small` (1536 dimensiones)
   - Cada chunk se convierte en un vector

5. **Subida a Pinecone**:
   - Crea el índice automáticamente si no existe
   - Sube chunks con embeddings y metadata
   - Procesa en batches para eficiencia

### 2. Búsqueda en RAG (Consultas)

Cuando haces una consulta:

1. El agente genera embeddings de tu pregunta usando OpenAI
2. Busca documentos similares en Pinecone (búsqueda vectorial)
3. Calcula un score de similitud para cada resultado

### 3. Decisión RAG vs Perplexity

El agente evalúa si los resultados son relevantes:

- Si el mejor score >= `RAG_SIMILARITY_THRESHOLD` (default: 0.7) → Usa RAG
- Si no hay resultados relevantes → Usa Perplexity

### 4. Generación de Respuesta

**Con RAG:**

- Toma los documentos relevantes como contexto
- Incluye el historial de conversación
- Genera respuesta usando OpenAI con el contexto

**Con Perplexity:**

- Envía la consulta a Perplexity AI
- Incluye historial de conversación
- Obtiene respuesta actualizada con fuentes

### 5. Historial de Conversaciones

- Usa LangChain Memory para mantener contexto
- Almacena últimos N mensajes (configurable)
- Incluye historial en prompts para continuidad

## Configuración Avanzada

### Ajustar Threshold de Similitud

El threshold determina cuándo confiar en RAG:

```env
# Más estricto (0.8) - Va a Perplexity más frecuentemente
RAG_SIMILARITY_THRESHOLD=0.8

# Más permisivo (0.6) - Usa RAG más frecuentemente
RAG_SIMILARITY_THRESHOLD=0.6
```

### Número de Documentos RAG

```env
# Buscar top 5 documentos más relevantes
RAG_TOP_K=5
```

### Chunking de Documentos

```env
# Tamaño de cada chunk (en caracteres)
CHUNK_SIZE=1000

# Overlap entre chunks (mantiene contexto)
CHUNK_OVERLAP=200
```

**Recomendaciones:**

- **Documentos técnicos**: `CHUNK_SIZE=1500`, `CHUNK_OVERLAP=300`
- **FAQs cortos**: `CHUNK_SIZE=500`, `CHUNK_OVERLAP=50`
- **Artículos largos**: `CHUNK_SIZE=2000`, `CHUNK_OVERLAP=400`

### Modelos

```env
# Cambiar modelo de OpenAI
OPENAI_MODEL=gpt-4o

# Cambiar modelo de Perplexity
PERPLEXITY_MODEL=llama-3.1-sonar-large-128k-online
```

### Configuración de Pinecone

```env
# Dimensión de embeddings (1536 para text-embedding-3-small)
PINECONE_DIMENSION=1536

# Métrica de similitud
PINECONE_METRIC=cosine

# Cloud provider y región
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
```

## API Reference

### RAGAgent

#### Constructor

```javascript
new RAGAgent((sessionId = 'default'));
```

#### Métodos

##### initialize()

```javascript
await agent.initialize();
```

Inicializa el agente y sus servicios.

##### query(query)

```javascript
const response = await agent.query('Tu pregunta aquí');
```

**Returns:**

```javascript
{
  answer: string,        // Respuesta generada
  source: 'rag' | 'perplexity',  // Fuente usada
  query: string,         // Consulta original
  ragResults: Array,     // Documentos encontrados (si source === 'rag')
  citations: Array,      // Fuentes citadas (si source === 'perplexity')
  sessionId: string,     // ID de sesión
  timestamp: string      // Timestamp ISO
}
```

##### getHistory()

```javascript
const history = await agent.getHistory();
```

Retorna el historial de conversación.

##### clearHistory()

```javascript
agent.clearHistory();
```

Limpia el historial de la sesión.

##### addDocuments(texts, metadatas)

```javascript
await agent.addDocuments(
  ['Texto 1', 'Texto 2'],
  [{ category: 'doc1' }, { category: 'doc2' }]
);
```

Agrega documentos al RAG.

## Casos de Uso

### 1. Documentación de Empresa

- Carga la documentación interna en Pinecone
- El agente responde desde RAG para info interna
- Usa Perplexity para info externa/actualizada

### 2. Asistente de Soporte

- Base de conocimiento de productos en RAG
- Fallback a Perplexity para problemas no documentados
- Historial mantiene contexto del cliente

### 3. Chatbot de Investigación

- Papers/artículos guardados en Pinecone
- Perplexity para búsquedas web actualizadas
- Combina conocimiento local y global

## Troubleshooting

### Error: "Vector store no inicializado"

Asegúrate de llamar a `await agent.initialize()` antes de usar el agente.

### No encuentra documentos en Pinecone

1. Verifica que el índice existe
2. Verifica que las dimensiones coinciden (1536 para `text-embedding-3-small`)
3. Confirma que agregaste documentos al índice

### Error de autenticación

Verifica que todas las API keys en `.env` sean correctas y válidas.

## 🚀 REST API

El proyecto incluye una API REST completa para integración con aplicaciones frontend.

### Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar el servidor API
npm run start-api
```

El servidor estará disponible en: `http://localhost:3001`

### Endpoints Principales

- **POST** `/api/chat` - Chatear con el agente
- **GET** `/api/history/:sessionId` - Obtener historial
- **GET** `/api/sessions/:idEmpresa` - Listar sesiones
- **GET** `/api/stats/:idEmpresa` - Estadísticas
- **GET** `/api/health` - Health check

### Ejemplo de Uso

```bash
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "sessionId": "user-123",
    "idEmpresa": "empresa-001",
    "query": "¿Qué cursos ofrecen?"
  }'
```

📚 **Documentación completa**: Ver [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## 🐳 Despliegue en Kubernetes

El proyecto incluye configuración completa para despliegue en Kubernetes (GCP).

### Despliegue Rápido

```bash
# 1. Actualizar credenciales
./update-credentials.sh

# 2. Desplegar
./deploy.sh
```

El script automáticamente:

- ✅ Incrementa la versión de la imagen
- ✅ Construye la imagen Docker
- ✅ Sube al registry de GCP
- ✅ Despliega en Kubernetes
- ✅ Verifica el estado

### Verificación

```bash
# Port-forward al servicio
kubectl port-forward -n coonverso service/rag-agent-api-service 3001:80

# Test
curl http://localhost:3001/api/health
```

📚 **Documentación completa**: Ver [K8S_DEPLOYMENT.md](./K8S_DEPLOYMENT.md)

### Archivos de Kubernetes

- `k8s/deployment.yaml` - Deployment con 2 réplicas
- `k8s/service.yaml` - Service ClusterIP
- `Dockerfile` - Imagen optimizada Node 20 Alpine
- `deploy.sh` - Script de despliegue automatizado
- `.dockerignore` - Optimización de build

## Licencia

MIT

## Contribuir

Pull requests son bienvenidos. Para cambios mayores, abre un issue primero para discutir los cambios propuestos.

---

**Desarrollado por**: David Mejía
**Proyecto**: Coonverso - CEC-EPN
**Fecha**: Noviembre 2025

```

```
