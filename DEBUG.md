# Modo Debug - Guía de Uso

El sistema incluye un logger de debug detallado que te permite ver el flujo interno del agente RAG.

## Activar el Modo Debug

Para activar el modo debug, edita tu archivo `.env` y cambia:

```env
DEBUG_MODE=true
```

También puedes usar la variable `LANGCHAIN_VERBOSE`:

```env
LANGCHAIN_VERBOSE=true
```

Cualquiera de las dos activará el logger de debug.

## Información que Muestra el Debug Logger

Cuando el modo debug está activado, verás información detallada sobre:

### 1. **Detección de Intenciones**
Muestra cuando se detecta una intención simple (saludo, despedida, agradecimiento):

```
💡 Intención detectada:
   - Tipo: greeting
   - Confianza: 1
```

### 2. **Búsqueda en RAG**
Muestra los resultados de la búsqueda en Pinecone con scores de similitud:

```
🔎 Búsqueda en RAG:
   - Query: "¿Qué es el CEC-EPN?"
   - Resultados encontrados: 3

   Top 3 resultados:
   1. Score: 0.7610
      Contenido: El Centro de Educación Continua...
      Metadata: {...}
```

### 3. **Decisión RAG vs Perplexity**
Muestra el threshold configurado y la decisión tomada:

```
⚖️  Decisión RAG vs Perplexity:
   - Threshold: 0.5
   - Mejor score: 0.7610
   - Decisión: Usar RAG ✅
```

O cuando se usa Perplexity:

```
⚖️  Decisión RAG vs Perplexity:
   - Threshold: 0.5
   - Mejor score: 0.2266
   - Decisión: Usar Perplexity 🌐
```

### 4. **Prompts Enviados a LLMs**
Muestra el prompt completo enviado a OpenAI (cuando usa RAG):

```
📝 Prompt enviado (RAG):
────────────────────────────────────────────────────────────
Eres Asistente CEC-EPN, asistente virtual del Centro de Educación Continua...

HISTORIAL DE CONVERSACIÓN:
...

CONTEXTO DISPONIBLE:
...

PREGUNTA DEL USUARIO: ¿Qué es el CEC-EPN?
────────────────────────────────────────────────────────────
```

### 5. **Respuestas Generadas**
Muestra un preview de la respuesta generada:

```
✨ Respuesta generada:
   - Fuente: RAG (OpenAI)
   - Contenido: El Centro de Educación Continua (CEC) de la Escuela...
```

### 6. **Historial de Conversación**
Cuando se consulta Perplexity, muestra el historial que se está enviando:

```
💭 Historial de conversación:
   - Mensajes en memoria: 4
   1. user: Hola...
   2. assistant: ¡Hola! Soy Asistente CEC-EPN...
   3. user: ¿Qué es el CEC-EPN?...
   4. assistant: El Centro de Educación Continua...
```

### 7. **Errores**
Si ocurre algún error, muestra el stack trace completo:

```
❌ Error al procesar consulta:
   - Mensaje: Connection timeout
   - Stack: Error: Connection timeout...
```

## Modo Verbose de LangChain (Nativo)

Además del debug logger personalizado, cuando `LANGCHAIN_VERBOSE=true` está activado, también verás los **logs nativos de LangChain**:

### Información del Modo Verbose de LangChain:

1. **Llamadas a LLMs (OpenAI)**:
   ```
   🔵 [LangChain LLM Start]
      Model: ChatOpenAI
      Prompts: 1
      First prompt preview: Eres Asistente CEC-EPN, asistente virtual...

   🟢 [LangChain LLM End]
      Response: El Centro de Educación Continua...
      Token usage: {
        promptTokens: 416,
        completionTokens: 68,
        totalTokens: 484
      }
   ```

2. **Operaciones de Embeddings**:
   - Muestra cuando se generan embeddings para búsquedas
   - Muestra tokens utilizados en las operaciones de embeddings
   - Tiempo de ejecución

3. **Logs Nativos de LangChain** (formato original):
   ```
   [llm/start] [1:llm:ChatOpenAI] Entering LLM run with input: {...}
   [llm/end] [1:llm:ChatOpenAI] [5.26s] Exiting LLM run with output: {
     "tokenUsage": {
       "promptTokens": 416,
       "completionTokens": 68,
       "totalTokens": 484
     }
   }
   ```

4. **Callbacks Personalizados**:
   - `handleLLMStart`: Antes de cada llamada al LLM
   - `handleLLMEnd`: Después de cada llamada con métricas
   - `handleLLMError`: Si hay errores en el LLM
   - `handleChainStart/End`: Para operaciones en cadena
   - `handleToolStart/End`: Para herramientas (si se usan)

### Diferencias entre DEBUG_MODE y LANGCHAIN_VERBOSE:

| Feature | DEBUG_MODE | LANGCHAIN_VERBOSE |
|---------|-----------|-------------------|
| Detección de intenciones | ✅ | ❌ |
| Búsqueda RAG con scores | ✅ | ❌ |
| Decisión RAG vs Perplexity | ✅ | ❌ |
| Prompts formateados | ✅ | ❌ |
| Historial de conversación | ✅ | ❌ |
| Logs nativos de LangChain | ❌ | ✅ |
| Tokens y métricas LLM | ❌ | ✅ |
| Callbacks de LangChain | ❌ | ✅ |
| Operaciones de Embeddings | ❌ | ✅ |

### Recomendación de Uso:

**Para máximo detalle, activa ambos**:
```env
DEBUG_MODE=true
LANGCHAIN_VERBOSE=true
```

Esto te dará:
- **DEBUG_MODE**: Contexto de alto nivel sobre decisiones del agente
- **LANGCHAIN_VERBOSE**: Detalles técnicos de LangChain (tokens, tiempos, etc.)

## Probar el Debug Logger

Ejecuta el script de prueba incluido:

```bash
npm run test-debug
```

Este script ejecuta 3 tests:
1. **Saludo** - Muestra detección de intención simple
2. **Pregunta sobre CEC-EPN** - Muestra búsqueda RAG exitosa
3. **Pregunta no relacionada** - Muestra fallback a Perplexity

También puedes usar el chat interactivo con debug activado:

```bash
npm run chat
```

## Desactivar el Debug

Para desactivar el modo debug, simplemente cambia en `.env`:

```env
DEBUG_MODE=false
LANGCHAIN_VERBOSE=false
```

## Recomendaciones

- **En desarrollo**: Mantén `DEBUG_MODE=true` para ver el flujo completo
- **En producción**: Usa `DEBUG_MODE=false` para reducir el ruido en los logs
- **Para análisis de rendimiento**: Activa solo `LANGCHAIN_VERBOSE=true` para ver tokens y tiempos
- **Para depurar decisiones**: Usa `DEBUG_MODE=true` para ver scores de similitud y decisiones RAG vs Perplexity

## Código del Debug Logger

El debug logger está implementado en [`src/utils/debug_logger.js`](src/utils/debug_logger.js) y se integra automáticamente en el RAGAgent cuando está activado.
