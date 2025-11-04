import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { config } from '../config/env.js';

export class PineconeService {
  constructor() {
    this.pinecone = null;
    this.vectorStore = null;
    this.embeddings = null;
  }

  async initialize() {
    try {
      // Inicializar Pinecone
      this.pinecone = new Pinecone({
        apiKey: config.pinecone.apiKey,
      });

      // Inicializar embeddings de OpenAI
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: config.openai.apiKey,
        modelName: 'text-embedding-3-small',
        verbose: process.env.LANGCHAIN_VERBOSE === 'true',
      });

      // Obtener el índice
      const index = this.pinecone.Index(config.pinecone.indexName);

      // 📊 Obtener stats del índice
      const stats = await index.describeIndexStats();

      console.log('✅ Pinecone inicializado correctamente');
      console.log(`📊 Índice: "${config.pinecone.indexName}"`);
      console.log(`📦 Total de vectores: ${stats.totalRecordCount || 'N/A'}`);
      console.log(`🔢 Dimensiones: ${stats.dimension || 'N/A'}`);

      if (stats.namespaces) {
        const namespaceNames = Object.keys(stats.namespaces);
        if (namespaceNames.length > 0) {
          console.log(`📁 Namespaces: ${namespaceNames.join(', ')}`);
          namespaceNames.forEach(ns => {
            console.log(`   - ${ns}: ${stats.namespaces[ns].recordCount} vectores`);
          });
        }
      }

      // Crear vector store
      this.vectorStore = await PineconeStore.fromExistingIndex(this.embeddings, {
        pineconeIndex: index,
      });

      return true;
    } catch (error) {
      console.error('❌ Error al inicializar Pinecone:', error.message);
      throw error;
    }
  }

  /**
   * Buscar documentos similares en Pinecone
   * @param {string} query - La consulta del usuario
   * @param {number} k - Número de documentos a retornar
   * @param {Object} filters - Filtros de metadata opcionales
   * @param {boolean} useHybrid - Usar búsqueda híbrida (semantic + keyword)
   * @returns {Promise<Array>} - Documentos encontrados con scores
   */
  async searchSimilarDocuments(
    query,
    k = config.rag.topK,
    filters = {},
    useHybrid = false
  ) {
    try {
      if (!this.vectorStore) {
        throw new Error('Vector store no inicializado. Llama a initialize() primero.');
      }

      // 🔧 FILTROS AUTOMÁTICOS DESACTIVADOS
      // Extraer filtros automáticamente de la query si no se proporcionan
      // let autoFilters = filters;
      // if (Object.keys(filters).length === 0) {
      //   const extractedFilters = this.extractFiltersFromQuery(query);
      //   // Solo aplicar si hay filtros detectados (evitar objeto vacío)
      //   autoFilters =
      //     Object.keys(extractedFilters).length > 0 ? extractedFilters : undefined;
      // }

      // Buscar SIN filtros automáticos (solo filtros manuales si se pasan)
      const finalFilters = Object.keys(filters).length > 0 ? filters : undefined;

      if (useHybrid) {
        // Búsqueda híbrida (semantic + keyword)
        return await this.hybridSearch(query, k, finalFilters);
      } else {
        // Búsqueda semántica estándar SIN filtros automáticos
        // 📊 Obtener más resultados para filtrar duplicados
        const results = await this.vectorStore.similaritySearchWithScore(
          query,
          k * 3, // Obtener 3x más para compensar duplicados
          finalFilters
        );

        const mappedResults = results.map(([doc, score]) => ({
          content: doc.pageContent,
          metadata: doc.metadata,
          score: score,
        }));

        // 🔧 Filtrar duplicados manteniendo el mejor score
        const deduped = this.deduplicateResults(mappedResults);

        // 📉 Retornar solo los k mejores después de deduplicar
        return deduped.slice(0, k);
      }
    } catch (error) {
      console.error('Error en búsqueda de Pinecone:', error.message);
      return [];
    }
  }

  /**
   * Búsqueda híbrida: combina búsqueda semántica con keywords
   * @param {string} query - Query del usuario
   * @param {number} k - Número de resultados
   * @param {Object} filters - Filtros de metadata
   * @returns {Promise<Array>} - Resultados combinados y re-rankeados
   */
  async hybridSearch(query, k, filters = {}) {
    try {
      console.log('🔀 Usando búsqueda híbrida (semantic + keyword)...');

      // 1. Búsqueda semántica
      const semanticResults = await this.vectorStore.similaritySearchWithScore(
        query,
        k * 2, // Obtener más resultados para mezclar
        filters
      );

      // 2. Extraer keywords de la query
      const keywords = this.extractKeywords(query);
      console.log(`🔑 Keywords extraídas: ${keywords.join(', ')}`);

      // 3. Búsqueda por keywords (simple: filtrado por contenido)
      const keywordResults = semanticResults.filter(([doc]) => {
        const content = doc.pageContent.toLowerCase();
        return keywords.some(keyword => content.includes(keyword));
      });

      // 4. Combinar y re-rankear
      const combined = this.mergeAndRerankResults(semanticResults, keywordResults, {
        semanticWeight: 0.7,
        keywordWeight: 0.3,
      });

      console.log(
        `✅ Híbrido: ${semanticResults.length} semantic, ${keywordResults.length} keyword → ${combined.length} combinados`
      );

      // 5. Retornar top K
      return combined.slice(0, k);
    } catch (error) {
      console.error('Error en búsqueda híbrida:', error.message);
      // Fallback a búsqueda semántica normal
      const results = await this.vectorStore.similaritySearchWithScore(query, k, filters);
      return results.map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        score: score,
      }));
    }
  }

  /**
   * Extraer keywords relevantes de la query
   * @param {string} query - Query del usuario
   * @returns {Array<string>} - Keywords extraídas
   */
  extractKeywords(query) {
    // Stopwords en español
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
      'se',
      'como',
      'su',
      'me',
      'te',
      'o',
      'pero',
      'más',
      'mi',
      'tu',
      'este',
      'esta',
      'qué',
      'cuál',
      'cuáles',
      'cómo',
      'dónde',
      'cuándo',
      'quién',
    ]);

    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w));

    return [...new Set(words)]; // Remover duplicados
  }

  /**
   * Combinar y re-rankear resultados de búsqueda semántica y por keywords
   * @param {Array} semanticResults - Resultados de búsqueda semántica
   * @param {Array} keywordResults - Resultados de búsqueda por keywords
   * @param {Object} weights - Pesos para semantic y keyword
   * @returns {Array} - Resultados combinados y ordenados
   */
  mergeAndRerankResults(semanticResults, keywordResults, weights) {
    const resultsMap = new Map();

    // Agregar resultados semánticos
    for (const [doc, score] of semanticResults) {
      const id = doc.metadata.id || doc.pageContent.substring(0, 50);
      resultsMap.set(id, {
        content: doc.pageContent,
        metadata: doc.metadata,
        score: score * weights.semanticWeight,
        semanticScore: score,
        keywordScore: 0,
      });
    }

    // Agregar/actualizar con resultados de keywords
    for (const [doc, score] of keywordResults) {
      const id = doc.metadata.id || doc.pageContent.substring(0, 50);
      if (resultsMap.has(id)) {
        const existing = resultsMap.get(id);
        existing.keywordScore = score;
        existing.score += score * weights.keywordWeight;
      } else {
        resultsMap.set(id, {
          content: doc.pageContent,
          metadata: doc.metadata,
          score: score * weights.keywordWeight,
          semanticScore: 0,
          keywordScore: score,
        });
      }
    }

    // Ordenar por score combinado
    const sorted = Array.from(resultsMap.values());
    sorted.sort((a, b) => b.score - a.score);
    return sorted;
  }

  /**
   * Extraer filtros automáticamente de la query
   * @param {string} query - Query del usuario
   * @returns {Object} - Filtros detectados
   */
  extractFiltersFromQuery(query) {
    const filters = {};

    // Detectar menciones de años
    const yearRegex = /202\d/;
    const yearMatch = yearRegex.exec(query);
    if (yearMatch) {
      filters.year = yearMatch[0];
    }

    // Detectar categorías comunes
    const categories = {
      curso: 'curso',
      cursos: 'curso',
      programa: 'programa',
      programas: 'programa',
      certificado: 'certificacion',
      certificación: 'certificacion',
      horario: 'horarios',
      horarios: 'horarios',
      precio: 'precio',
      precios: 'precio',
      costo: 'precio',
      costos: 'precio',
      inscripción: 'inscripcion',
      inscripcion: 'inscripcion',
      matrícula: 'inscripcion',
      matricula: 'inscripcion',
    };

    const lowerQuery = query.toLowerCase();
    for (const [keyword, category] of Object.entries(categories)) {
      if (lowerQuery.includes(keyword)) {
        filters.category = category;
        break; // Solo tomar la primera categoría encontrada
      }
    }

    // Log si se detectaron filtros
    if (Object.keys(filters).length > 0) {
      console.log(`🔍 Filtros detectados automáticamente:`, filters);
    }

    return filters;
  }

  /**
   * Agregar documentos a Pinecone
   * @param {Array<string>} texts - Textos a agregar
   * @param {Array<Object>} metadatas - Metadatos opcionales
   */
  async addDocuments(texts, metadatas = []) {
    try {
      if (!this.vectorStore) {
        throw new Error('Vector store no inicializado');
      }

      await this.vectorStore.addDocuments(
        texts.map((text, i) => ({
          pageContent: text,
          metadata: metadatas[i] || {},
        }))
      );

      console.log(`✅ ${texts.length} documentos agregados a Pinecone`);
      return true;
    } catch (error) {
      console.error('Error al agregar documentos:', error.message);
      throw error;
    }
  }

  /**
   * Evaluar si los resultados son relevantes
   * @param {Array} results - Resultados de la búsqueda
   * @returns {boolean} - true si hay resultados relevantes
   */
  hasRelevantResults(results) {
    if (!results || results.length === 0) {
      return false;
    }

    // Verificar si el mejor resultado supera el umbral de similitud
    const bestScore = results[0].score;
    return bestScore >= config.rag.similarityThreshold;
  }

  /**
   * Eliminar documentos duplicados de los resultados
   * Mantiene el documento con mejor score para cada contenido único
   * @param {Array} results - Array de resultados con content, metadata, score
   * @returns {Array} - Resultados sin duplicados
   */
  deduplicateResults(results) {
    if (!results || results.length === 0) {
      return results;
    }

    const seen = new Map(); // Usar Map para mantener orden y performance
    const beforeCount = results.length;

    for (const result of results) {
      // Crear clave única basada en source + chunkIndex (si existe)
      const source = result.metadata?.source || 'unknown';
      const chunkIndex = result.metadata?.chunkIndex;

      let key;
      if (chunkIndex === undefined) {
        // Si no hay chunkIndex, usar hash del contenido
        // (simplificado: primeros 100 caracteres)
        const contentHash = result.content.substring(0, 100).trim();
        key = `${source}::${contentHash}`;
      } else {
        // Si hay chunkIndex, usar source + chunkIndex como clave
        key = `${source}::${chunkIndex}`;
      }

      // Si ya existe, mantener el de mejor score
      if (seen.has(key)) {
        const existing = seen.get(key);
        if (result.score > existing.score) {
          seen.set(key, result);
        }
      } else {
        seen.set(key, result);
      }
    }

    const deduplicated = Array.from(seen.values());

    if (beforeCount > deduplicated.length) {
      console.log(
        `🔄 Duplicados eliminados: ${beforeCount} → ${deduplicated.length} documentos únicos`
      );
    }

    return deduplicated;
  }
}
