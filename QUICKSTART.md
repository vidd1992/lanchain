# 🚀 Guía Rápida de Inicio

## Setup en 3 Pasos

### 1️⃣ Configurar `.env`

```bash
cp .env.example .env
```

Edita `.env` y agrega tus API keys:

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=mi-rag-index
PERPLEXITY_API_KEY=pplx-...
```

### 2️⃣ Agregar Documentos

Coloca tus archivos en la carpeta `documents/`:

```bash
# Ya hay un archivo de ejemplo: documents/faq_ejemplo.txt
# Agrega tus propios archivos
cp mi_documento.pdf documents/
cp mis_faqs.txt documents/faq_mis_faqs.txt
```

**Formatos soportados:** `.txt`, `.md`, `.pdf`, `.csv`, `.json`

**Archivos FAQ:** Nómbralos con prefijo `faq_` para procesamiento especial

### 3️⃣ Ejecutar Setup

```bash
npm run setup
```

✅ Esto automáticamente:
- Crea el índice en Pinecone (si no existe)
- Procesa todos los documentos con LangChain
- Los divide en chunks óptimos
- Genera embeddings con OpenAI
- Los sube a Pinecone

## Usar el Agente

### Chat Interactivo

```bash
npm run chat
```

### Ejemplo Programático

```javascript
import { RAGAgent } from './src/index.js';

const agent = new RAGAgent('mi-sesion');
await agent.initialize();

const response = await agent.query('¿Qué es LangChain?');
console.log(response.answer);
console.log('Fuente:', response.source); // 'rag' o 'perplexity'
```

## Cómo Funciona

1. **Consulta del usuario** → Busca en Pinecone (RAG)
2. **¿Score >= 0.7?**
   - ✅ Sí → Responde con RAG + OpenAI
   - ❌ No → Consulta Perplexity (info actualizada)
3. **Guarda en historial** → Mantiene contexto conversacional

## Formatos de Documentos FAQ

### Opción 1: Q&A Simple

```
Q: ¿Qué es esto?
A: Es un agente RAG inteligente.

Q: ¿Cómo funciona?
A: Busca en Pinecone primero, luego usa Perplexity si es necesario.
```

### Opción 2: Markdown

```markdown
## ¿Qué es esto?
Es un agente RAG inteligente.

## ¿Cómo funciona?
Busca en Pinecone primero, luego usa Perplexity si es necesario.
```

### Opción 3: JSON

```json
[
  {
    "question": "¿Qué es esto?",
    "answer": "Es un agente RAG inteligente.",
    "category": "general"
  }
]
```

## Scripts Disponibles

```bash
npm run setup      # Crear índice y subir documentos
npm run chat       # Chat interactivo
npm test           # Pruebas automáticas
npm run add-docs   # Agregar documentos manualmente (método antiguo)
```

## Configuración Avanzada

### Ajustar Chunking

```env
CHUNK_SIZE=1000      # Tamaño de cada chunk
CHUNK_OVERLAP=200    # Overlap entre chunks
```

### Ajustar Threshold

```env
RAG_SIMILARITY_THRESHOLD=0.7   # Más alto = más estricto
```

### Cambiar Modelos

```env
OPENAI_MODEL=gpt-4o
PERPLEXITY_MODEL=llama-3.1-sonar-large-128k-online
```

## Troubleshooting

### Error: "Faltan variables de entorno"
→ Revisa que `.env` tenga todas las API keys

### Error: "Vector store no inicializado"
→ Llama a `await agent.initialize()` antes de usar el agente

### No encuentra documentos
→ Verifica que ejecutaste `npm run setup` y que hay archivos en `documents/`

### Siempre va a Perplexity
→ Reduce el `RAG_SIMILARITY_THRESHOLD` (ej: 0.6)

### Siempre usa RAG incluso con preguntas irrelevantes
→ Aumenta el `RAG_SIMILARITY_THRESHOLD` (ej: 0.8)

## Agregar Más Documentos Después

```bash
# 1. Agrega nuevos archivos a documents/
cp nuevo_documento.pdf documents/

# 2. Ejecuta setup de nuevo
npm run setup
```

El script detecta que el índice ya existe y solo agrega los nuevos documentos.

## Próximos Pasos

1. Lee el [README.md](README.md) completo para más detalles
2. Revisa [documents/README.md](documents/README.md) para formatos de documentos
3. Explora los ejemplos en `examples/`
4. Personaliza la configuración en `.env`

¡Listo para usar! 🎉
