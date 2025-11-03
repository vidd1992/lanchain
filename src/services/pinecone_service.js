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
        apiKey: config.pinecone.apiKey
      });

      // Inicializar embeddings de OpenAI
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: config.openai.apiKey,
        modelName: 'text-embedding-3-small',
        verbose: process.env.LANGCHAIN_VERBOSE === 'true'
      });

      // Obtener el índice
      const index = this.pinecone.Index(config.pinecone.indexName);

      // Crear vector store
      this.vectorStore = await PineconeStore.fromExistingIndex(
        this.embeddings,
        { pineconeIndex: index }
      );

      console.log('✅ Pinecone inicializado correctamente');
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
   * @returns {Promise<Array>} - Documentos encontrados con scores
   */
  async searchSimilarDocuments(query, k = config.rag.topK) {
    try {
      if (!this.vectorStore) {
        throw new Error('Vector store no inicializado. Llama a initialize() primero.');
      }

      // Buscar documentos similares con scores
      const results = await this.vectorStore.similaritySearchWithScore(query, k);

      return results.map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        score: score
      }));
    } catch (error) {
      console.error('Error en búsqueda de Pinecone:', error.message);
      return [];
    }
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
          metadata: metadatas[i] || {}
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
}
