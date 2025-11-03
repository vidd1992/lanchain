# Gestión de Contexto en el Agente RAG

Este documento explica cómo se maneja el contexto (personalidad, historial de conversación, y conocimiento) tanto en el modelo principal (OpenAI con RAG) como en Perplexity.

## Arquitectura de Contexto

El agente tiene **3 niveles de contexto**:

```
┌─────────────────────────────────────────────────┐
│  1. CONTEXTO DEL AGENTE (Personalidad/Rol)     │
│     - Definido en .env                          │
│     - AGENT_NAME, AGENT_ROLE, AGENT_GREETING    │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│  2. HISTORIAL DE CONVERSACIÓN                   │
│     - Gestionado por ConversationHistoryManager │
│     - Mantiene mensajes user/assistant          │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│  3. CONOCIMIENTO (RAG o Web)                    │
│     - RAG: Documentos de Pinecone               │
│     - Perplexity: Búsqueda web (filtrada)       │
└─────────────────────────────────────────────────┘
```

## 1. Contexto en el Modelo Principal (OpenAI + RAG)

### Ubicación: `src/agent/rag_agent.js` - Método `generateAnswerFromRAG()`

```javascript
const systemContext = `Eres ${config.agent.name}, ${config.agent.role}.

TU ROL Y PERSONALIDAD:
- Eres amable, profesional y servicial
- Tu objetivo es ayudar a estudiantes y personas interesadas en los cursos y servicios del CEC-EPN
- Siempre respondes en español
- Si te saludan, responde de manera cordial como representante del CEC-EPN
- Si no tienes información específica, indícalo honestamente

INSTRUCCIONES:
- Usa el contexto proporcionado para responder con precisión
- Mantén la continuidad con el historial de conversación
- Si la información no está en el contexto, puedes usar tu conocimiento general del CEC-EPN`;
```

### Componentes del Prompt a OpenAI:

1. **System Context** (de .env):
   - `AGENT_NAME`: Nombre del asistente
   - `AGENT_ROLE`: Rol específico del asistente
   - Instrucciones de personalidad

2. **Historial de Conversación**:
   ```javascript
   const history = await this.historyManager.getFormattedHistory(this.sessionId);
   const historyText = history
     .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
     .join('\n');
   ```

3. **Contexto de RAG** (Documentos relevantes):
   ```javascript
   const context = documents
     .map((doc, idx) => `[Documento ${idx + 1}] ${doc.content}`)
     .join('\n\n');
   ```

4. **Pregunta del Usuario**

### Prompt Final Enviado a OpenAI:

```
Eres Asistente CEC-EPN, asistente virtual del Centro de Educación Continua...

TU ROL Y PERSONALIDAD:
...

HISTORIAL DE CONVERSACIÓN:
Usuario: Hola
Asistente: ¡Hola! Soy Asistente CEC-EPN...
Usuario: ¿Qué cursos hay?
Asistente: Tenemos varios cursos...

CONTEXTO DISPONIBLE:
[Documento 1] El CEC-EPN ofrece cursos de...
[Documento 2] Horarios de atención...
[Documento 3] Proceso de inscripción...

PREGUNTA DEL USUARIO: ¿Cuánto cuestan los cursos?

RESPUESTA (como Asistente CEC-EPN):
```

## 2. Contexto en Perplexity (Búsqueda Web)

### Ubicación: `src/services/perplexity_service.js` - Método `query()`

### Componentes del Prompt a Perplexity:

1. **System Prompt** (personalidad del agente):
   ```javascript
   const systemPrompt = `Eres ${config.agent.name}, ${config.agent.role}.

   TU ROL Y PERSONALIDAD:
   - Eres amable, profesional y servicial
   - Tu objetivo es ayudar a estudiantes y personas interesadas en los cursos y servicios del CEC-EPN
   - Siempre respondes en español
   - Proporcionas información precisa y actualizada usando búsqueda web
   - Si te saludan, responde de manera cordial como representante del CEC-EPN

   INSTRUCCIONES:
   - Responde de manera clara y concisa
   - Si la pregunta es sobre el CEC-EPN y no tienes información específica, indícalo
   - Mantén un tono profesional pero cercano`;
   ```

2. **Historial de Conversación** (mismo que OpenAI):
   ```javascript
   const messages = [
     { role: 'system', content: systemPrompt },
     ...conversationHistory,  // <- Historial completo
     { role: 'user', content: query }
   ];
   ```

3. **Filtro de Dominios** (búsqueda dirigida):
   ```javascript
   if (config.perplexity.searchDomains && config.perplexity.searchDomains.length > 0) {
     payload.search_domain_filter = config.perplexity.searchDomains;
     // Ejemplo: ['www.cec-epn.edu.ec']
   }
   ```

### Configuración de Dominios:

En tu `.env`:
```env
PERPLEXITY_SEARCH_DOMAINS=www.cec-epn.edu.ec
```

**Ventajas:**
- Perplexity solo buscará en el sitio web oficial del CEC-EPN
- Respuestas más precisas y confiables
- Evita información de fuentes no oficiales
- Incluye citas/referencias del sitio web

**Para múltiples dominios:**
```env
PERPLEXITY_SEARCH_DOMAINS=www.cec-epn.edu.ec,cec-epn.edu.ec,epn.edu.ec
```

## 3. Gestión del Historial de Conversación

### Ubicación: `src/services/conversation_history.js`

El historial se gestiona con **LangChain BufferMemory**:

```javascript
export class ConversationHistoryManager {
  constructor() {
    this.sessions = new Map();
  }

  getMemory(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new BufferMemory({
        chatHistory: new ChatMessageHistory(),
        returnMessages: true,
        memoryKey: 'history'
      }));
    }
    return this.sessions.get(sessionId);
  }
}
```

### Características:

1. **Sesiones Independientes**:
   - Cada usuario tiene su propio `sessionId`
   - El historial no se mezcla entre usuarios

2. **Formato de Mensajes**:
   ```javascript
   await memory.chatHistory.addUserMessage(userMessage);
   await memory.chatHistory.addAIChatMessage(assistantMessage);
   ```

3. **Recuperación del Historial**:
   ```javascript
   const history = await this.getFormattedHistory(sessionId);
   // Retorna: [
   //   { role: 'user', content: 'Hola' },
   //   { role: 'assistant', content: '¡Hola! Soy...' },
   //   ...
   // ]
   ```

4. **Límite de Mensajes** (para evitar prompts muy largos):
   ```javascript
   trimHistory(sessionId, maxMessages = 10) {
     // Mantiene solo los últimos N mensajes
   }
   ```

## Comparación de Contexto: OpenAI vs Perplexity

| Aspecto | OpenAI + RAG | Perplexity |
|---------|--------------|------------|
| **Personalidad** | ✅ Sí (de .env) | ✅ Sí (mismo de .env) |
| **Historial** | ✅ Sí (completo) | ✅ Sí (completo) |
| **Fuente de Datos** | 📚 Documentos en Pinecone | 🌐 Búsqueda web |
| **Filtro de Búsqueda** | 🔍 Similarity score | 🎯 Dominios específicos |
| **Actualización** | ❌ Requiere re-indexar | ✅ Información en tiempo real |
| **Precisión** | ⭐⭐⭐⭐⭐ (si está en docs) | ⭐⭐⭐⭐ (si está en web) |
| **Citas/Referencias** | ✅ Metadata de docs | ✅ URLs de páginas web |

## Flujo de Decisión del Agente

```
Usuario hace pregunta
         ↓
    ¿Es saludo/despedida?
         ↓ No
    Buscar en RAG (Pinecone)
         ↓
    ¿Score > threshold?
         ↓ No
    Usar Perplexity
         ↓
    ¿Dominio configurado?
         ↓ Sí
    Buscar SOLO en www.cec-epn.edu.ec
         ↓
    Generar respuesta con:
    - Personalidad del agente
    - Historial de conversación
    - Información del sitio web
```

## Configuración Recomendada

### Para Producción (Máxima Precisión):

```env
# Personalidad
AGENT_NAME=Asistente CEC-EPN
AGENT_ROLE=asistente virtual del Centro de Educación Continua de la Escuela Politécnica Nacional

# RAG
RAG_SIMILARITY_THRESHOLD=0.7  # Solo documentos muy relevantes

# Perplexity (solo sitio oficial)
PERPLEXITY_SEARCH_DOMAINS=www.cec-epn.edu.ec
```

### Para Desarrollo (Más Flexible):

```env
# RAG
RAG_SIMILARITY_THRESHOLD=0.5  # Acepta documentos menos relevantes

# Perplexity (múltiples fuentes)
PERPLEXITY_SEARCH_DOMAINS=www.cec-epn.edu.ec,cec-epn.edu.ec,epn.edu.ec

# Debug
DEBUG_MODE=true
LANGCHAIN_VERBOSE=true
```

## Beneficios de esta Arquitectura

1. **Consistencia**: El agente mantiene la misma personalidad en RAG y Perplexity
2. **Contexto Continuo**: El historial se comparte entre ambos modelos
3. **Precisión**: Búsqueda web filtrada solo en dominios confiables
4. **Flexibilidad**: Puede usar conocimiento interno (RAG) o buscar información actualizada (web)
5. **Trazabilidad**: Ambos modelos incluyen referencias/citas de sus fuentes

## Archivos Relacionados

- [`src/agent/rag_agent.js`](src/agent/rag_agent.js) - Lógica principal y prompt de OpenAI
- [`src/services/perplexity_service.js`](src/services/perplexity_service.js) - Integración con Perplexity
- [`src/services/conversation_history.js`](src/services/conversation_history.js) - Gestión de historial
- [`src/config/env.js`](src/config/env.js) - Configuración del agente
- [`.env`](.env) - Variables de configuración
