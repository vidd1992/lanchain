import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';
import { config } from '../config/env.js';

/**
 * Query Transform Chain - Usa LangChain para transformar queries conversacionales
 * en queries optimizadas para búsqueda vectorial
 * 
 * VENTAJAS sobre regex:
 * - Considera contexto de conversación
 * - Entiende intención real del usuario
 * - Preserva información importante
 * - Maneja casos edge automáticamente
 */
export class QueryTransformChain {
  constructor() {
    this.llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini', // Modelo rápido y económico
      temperature: 0, // Determinista
    });

    // Prompt optimizado para transformación de queries
    this.promptTemplate = PromptTemplate.fromTemplate(`Eres un experto en transformar preguntas conversacionales en queries de búsqueda optimizadas.

Tu tarea es extraer la INTENCIÓN PRINCIPAL de la pregunta del usuario, considerando el contexto de la conversación.

REGLAS:
1. PRESERVA las palabras clave importantes (nombres de cursos, temas, tecnologías)
2. ELIMINA saludos y frases de cortesía solo si no aportan al contexto
3. SIMPLIFICA la pregunta manteniendo la información relevante
4. CONSIDERA el historial - si se refiere a algo mencionado antes, inclúyelo
5. NO inventes información que no está en la pregunta
6. Si la pregunta es sobre disponibilidad/fechas, MANTÉN esa intención

HISTORIAL DE CONVERSACIÓN:
{conversationHistory}

PREGUNTA DEL USUARIO:
"{query}"

Genera la query optimizada (solo la query, sin explicaciones):
Query optimizada:`);

    this.chain = new LLMChain({
      llm: this.llm,
      prompt: this.promptTemplate,
      verbose: process.env.LANGCHAIN_VERBOSE === 'true',
    });
  }

  /**
   * Transformar query usando el chain
   * @param {string} query - Query original del usuario
   * @param {Array} conversationHistory - Historial de conversación
   * @returns {Promise<Object>} - {original, transformed, intent}
   */
  async transform(query, conversationHistory = []) {
    try {
      // Formatear historial
      const historyText = this.formatHistory(conversationHistory);

      // Ejecutar chain
      const result = await this.chain.call({
        query: query,
        conversationHistory: historyText || 'No hay historial previo.',
      });

      const transformedQuery = result.text.trim();

      // Detectar intent básico
      const intent = this.detectIntent(query, transformedQuery);

      return {
        original: query,
        transformed: transformedQuery,
        intent: intent,
        usedHistory: conversationHistory.length > 0,
      };
    } catch (error) {
      console.error('Error en QueryTransformChain:', error.message);
      // Fallback: devolver query original
      return {
        original: query,
        transformed: query,
        intent: 'general',
        usedHistory: false,
        error: error.message,
      };
    }
  }

  /**
   * Formatear historial de conversación
   */
  formatHistory(history) {
    if (!history || history.length === 0) {
      return '';
    }

    // Tomar solo los últimos 3 intercambios para no saturar el prompt
    const recentHistory = history.slice(-6); // 3 user + 3 assistant

    return recentHistory
      .map(msg => {
        const role = msg.role === 'user' ? 'Usuario' : 'Asistente';
        return `${role}: ${msg.content}`;
      })
      .join('\n');
  }

  /**
   * Detectar intent básico de la query
   */
  detectIntent(original, transformed) {
    const lowerOriginal = original.toLowerCase();
    const lowerTransformed = transformed.toLowerCase();

    // Detección de intents comunes
    if (
      /disponible|disponibilidad|hay|tienen|ofrece/.test(lowerOriginal)
    ) {
      return 'disponibilidad';
    }

    if (
      /cuándo|cuando|fecha|empieza|inicia|termina/.test(lowerOriginal)
    ) {
      return 'fecha';
    }

    if (/cuánto|cuanto|precio|costo|vale/.test(lowerOriginal)) {
      return 'precio';
    }

    if (/requisito|necesito|debo/.test(lowerOriginal)) {
      return 'requisitos';
    }

    if (/duración|dura|tiempo|horas/.test(lowerOriginal)) {
      return 'duracion';
    }

    if (
      /modalidad|presencial|online|virtual|distancia/.test(lowerOriginal)
    ) {
      return 'modalidad';
    }

    if (/instructor|profesor|docente|quién/.test(lowerOriginal)) {
      return 'instructor';
    }

    return 'general';
  }
}

/**
 * VERSIÓN MEJORADA 2: QueryRewriteChain con Contextual Compression
 * 
 * Para casos donde necesitas máxima precisión
 */
export class ContextualQueryRewriteChain {
  constructor() {
    this.llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0,
    });

    // Prompt más sofisticado con ejemplos (few-shot)
    this.promptTemplate = PromptTemplate.fromTemplate(`Eres un experto en entender preguntas sobre cursos educativos y transformarlas en búsquedas efectivas.

CONTEXTO: El usuario busca información sobre cursos del CEC-EPN (Centro de Educación Continua).

EJEMPLOS DE TRANSFORMACIÓN:

Entrada: "Buen día quisiera saber si está disponible cursos de refrigeración o cuando estará disponible"
Salida: "cursos refrigeración disponibilidad fecha"

Entrada: "Hola, me gustaría información sobre el precio del curso de Python que mencionaste antes"
Contexto previo: [Usuario preguntó sobre Python Essentials]
Salida: "precio curso Python Essentials"

Entrada: "¿Cuánto dura?"
Contexto previo: [Hablando sobre curso de Power BI]
Salida: "duración curso Power BI"

Entrada: "Cursos de programación para principiantes"
Salida: "cursos programación principiantes"

REGLAS IMPORTANTES:
1. Si el usuario se refiere a "eso", "ese", "el curso", etc., usa el contexto para identificar de qué habla
2. Mantén términos técnicos exactos (nombres de tecnologías, herramientas)
3. Convierte preguntas en palabras clave pero mantén la semántica
4. Si hay ambigüedad sin contexto, mantén la query original

HISTORIAL RECIENTE:
{conversationHistory}

PREGUNTA ACTUAL:
"{query}"

ANÁLISIS:
- ¿Se refiere a algo del historial? {hasContext}
- ¿Es una pregunta de seguimiento? {isFollowUp}
- Intent detectado: {detectedIntent}

Query optimizada para búsqueda vectorial:`);

    this.chain = new LLMChain({
      llm: this.llm,
      prompt: this.promptTemplate,
      verbose: process.env.LANGCHAIN_VERBOSE === 'true',
    });
  }

  /**
   * Transformar con análisis contextual profundo
   */
  async transform(query, conversationHistory = [], ragResults = []) {
    try {
      // Analizar contexto
      const hasContext = conversationHistory.length > 0;
      const isFollowUp = this.detectFollowUp(query);
      const detectedIntent = this.analyzeIntent(query, conversationHistory);

      const historyText = this.formatContextualHistory(
        conversationHistory,
        ragResults
      );

      const result = await this.chain.call({
        query: query,
        conversationHistory: historyText || 'Sin historial.',
        hasContext: hasContext ? 'Sí' : 'No',
        isFollowUp: isFollowUp ? 'Sí' : 'No',
        detectedIntent: detectedIntent,
      });

      const transformed = result.text.trim();

      return {
        original: query,
        transformed: transformed,
        intent: detectedIntent,
        isFollowUp: isFollowUp,
        hasContext: hasContext,
        confidence: this.calculateConfidence(query, transformed),
      };
    } catch (error) {
      console.error('Error en ContextualQueryRewriteChain:', error.message);
      return {
        original: query,
        transformed: query,
        intent: 'general',
        isFollowUp: false,
        hasContext: false,
        error: error.message,
      };
    }
  }

  /**
   * Detectar si es pregunta de seguimiento
   */
  detectFollowUp(query) {
    const followUpPatterns = [
      /^(y |¿y |pero |entonces |además |también |otro )/i,
      /(ese|esa|eso|ese curso|esa opción)/i,
      /(el mismo|la misma|los mismos)/i,
      /^(cuánto|qué|cómo|dónde|cuándo)/i, // Preguntas cortas suelen ser seguimiento
    ];

    return followUpPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Analizar intent considerando historial
   */
  analyzeIntent(query, history) {
    const lowerQuery = query.toLowerCase();

    // Si es pregunta muy corta y hay historial, probablemente es seguimiento
    if (query.split(' ').length <= 3 && history.length > 0) {
      return 'seguimiento';
    }

    // Intents específicos
    const intentMap = {
      disponibilidad: /disponible|hay|tienen|ofrece/,
      fecha: /cuándo|cuando|fecha|empieza|inicia/,
      precio: /cuánto|cuanto|precio|costo|vale/,
      requisitos: /requisito|necesito|debo/,
      duracion: /duración|dura|tiempo|horas/,
      modalidad: /modalidad|presencial|online|virtual/,
      instructor: /instructor|profesor|docente|quién/,
      comparacion: /diferencia|mejor|comparar|entre/,
    };

    for (const [intent, pattern] of Object.entries(intentMap)) {
      if (pattern.test(lowerQuery)) {
        return intent;
      }
    }

    return 'general';
  }

  /**
   * Formatear historial con contexto de RAG
   */
  formatContextualHistory(history, ragResults) {
    const lines = [];

    // Últimos 3 intercambios
    const recentHistory = history.slice(-6);

    if (recentHistory.length > 0) {
      lines.push('Conversación reciente:');
      recentHistory.forEach(msg => {
        const role = msg.role === 'user' ? 'Usuario' : 'Asistente';
        const preview = msg.content.substring(0, 100);
        lines.push(`${role}: ${preview}${msg.content.length > 100 ? '...' : ''}`);
      });
    }

    // Si hay resultados RAG del último query, incluir tema
    if (ragResults && ragResults.length > 0) {
      const lastCourse = ragResults[0].metadata?.titulo;
      if (lastCourse) {
        lines.push(`\nÚltimo curso mencionado: ${lastCourse}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Calcular confianza de la transformación
   */
  calculateConfidence(original, transformed) {
    // Heurística simple: si son muy diferentes, confianza media
    if (transformed.length < original.length * 0.3) {
      return 'medium';
    }
    if (transformed === original) {
      return 'low';
    }
    return 'high';
  }
}

/**
 * Helper function para uso simple
 */
export async function transformQuery(query, conversationHistory = []) {
  const transformer = new QueryTransformChain();
  return await transformer.transform(query, conversationHistory);
}

/**
 * Helper function para transformación contextual avanzada
 */
export async function transformQueryContextual(
  query,
  conversationHistory = [],
  ragResults = []
) {
  const transformer = new ContextualQueryRewriteChain();
  return await transformer.transform(query, conversationHistory, ragResults);
}
