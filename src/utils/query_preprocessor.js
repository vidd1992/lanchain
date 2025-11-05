import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

/**
 * Pre-procesador de queries para convertir lenguaje natural
 * en queries optimizadas para búsqueda vectorial
 */
export class QueryPreprocessor {
  constructor() {
    this.llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-4o-mini', // Modelo rápido y económico
      temperature: 0,
    });

    // Patrones de saludos/cortesía a remover
    this.greetingPatterns = [
      /^(hola|buenos?\s+d[ií]as?|buenas?\s+tardes?|buenas?\s+noches?)[,\s]*/i,
      /^(buen\s+d[ií]a)[,\s]*/i,
      /^(saludos?)[,\s]*/i,
      /(por\s+favor|porfa)[,\s]*/gi,
      /(gracias?|muchas\s+gracias)[,\s]*/gi,
      /(disculpe?|disculpa)[,\s]*/gi,
      /(quisiera|me\s+gustar[ií]a)[,\s]*/gi,
      /^(quiero|necesito)[,\s]*/i,
    ];

    // Patrones de preguntas a simplificar
    this.questionPatterns = {
      disponibilidad: /(?:está|hay|tienen)\s+disponible/i,
      cuando: /(?:cuándo|cuando)\s+(?:está|estará|hay|habrá)/i,
      precio: /(?:cuánto|cuanto)\s+(?:cuesta|vale|es\s+el\s+precio)/i,
      duracion: /(?:cuánto|cuanto)\s+(?:dura|tiempo)/i,
      requisitos: /(?:qué|que)\s+(?:requisitos|necesito)/i,
    };
  }

  /**
   * Pre-procesar query conversacional a query optimizada
   * @param {string} query - Query original del usuario
   * @returns {Promise<Object>} - {cleanQuery, intent, keywords}
   */
  async preprocess(query) {
    const original = query;

    // Paso 1: Remover saludos y cortesías
    let cleaned = this.removeGreetings(query);

    // Paso 2: Detectar intent
    const intent = this.detectIntent(cleaned);

    // Paso 3: Extraer keywords principales
    const keywords = await this.extractKeyKeywords(cleaned);

    // Paso 4: Construir query optimizada
    const optimizedQuery = this.buildOptimizedQuery(cleaned, intent, keywords);

    return {
      original: original,
      cleanQuery: optimizedQuery,
      intent: intent,
      keywords: keywords,
      shouldUseFilters: intent !== 'general',
    };
  }

  /**
   * Remover saludos y frases de cortesía
   */
  removeGreetings(query) {
    let cleaned = query;

    for (const pattern of this.greetingPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
  }

  /**
   * Detectar intención de la query
   */
  detectIntent(query) {
    for (const [intent, pattern] of Object.entries(this.questionPatterns)) {
      if (pattern.test(query)) {
        return intent;
      }
    }

    return 'general';
  }

  /**
   * Extraer keywords clave usando LLM (rápido y económico)
   */
  async extractKeyKeywords(query) {
    try {
      const prompt = `Extrae las palabras clave principales de esta pregunta sobre cursos.
Solo devuelve las palabras más importantes, separadas por comas.
No incluyas palabras como "curso", "hay", "tiene", "disponible".

Pregunta: "${query}"

Palabras clave:`;

      const response = await this.llm.invoke(prompt);
      const keywords = response.content
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 2);

      return keywords;
    } catch (error) {
      console.error('Error extrayendo keywords:', error.message);
      // Fallback: extracción simple
      return this.simpleKeywordExtraction(query);
    }
  }

  /**
   * Extracción simple de keywords (fallback)
   */
  simpleKeywordExtraction(query) {
    const stopwords = new Set([
      'el',
      'la',
      'de',
      'en',
      'y',
      'a',
      'que',
      'es',
      'por',
      'un',
      'una',
      'con',
      'para',
      'los',
      'las',
      'del',
      'al',
      'hay',
      'tiene',
      'están',
      'curso',
      'cursos',
      'disponible',
      'disponibles',
      'ofrece',
      'ofrecen',
    ]);

    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w));

    return [...new Set(words)];
  }

  /**
   * Construir query optimizada para búsqueda vectorial
   */
  buildOptimizedQuery(cleaned, intent, keywords) {
    // Si es una pregunta específica, enfocarse en las keywords
    if (intent !== 'general' && keywords.length > 0) {
      // Construir query enfocada
      let optimized = keywords.join(' ');

      // Agregar contexto según intent
      switch (intent) {
        case 'disponibilidad':
          optimized = `curso ${optimized}`;
          break;
        case 'precio':
          optimized = `precio costo ${optimized}`;
          break;
        case 'duracion':
          optimized = `duración tiempo ${optimized}`;
          break;
        case 'requisitos':
          optimized = `requisitos ${optimized}`;
          break;
        case 'cuando':
          optimized = `fecha inicio ${optimized}`;
          break;
      }

      return optimized;
    }

    // Para queries generales, usar el texto limpio
    return cleaned;
  }

  /**
   * Generar filtros de metadata basados en intent
   */
  generateFilters(intent, keywords) {
    const filters = {};

    // Por ahora, filtros básicos
    // Esto se puede expandir según necesidades

    return filters;
  }
}

/**
 * Helper function para uso rápido
 */
export async function preprocessQuery(query) {
  const preprocessor = new QueryPreprocessor();
  return await preprocessor.preprocess(query);
}
