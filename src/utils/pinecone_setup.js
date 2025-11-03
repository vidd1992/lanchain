import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../config/env.js';

/**
 * Utilidad para crear y gestionar índices de Pinecone
 */
export class PineconeSetup {
  constructor() {
    this.pinecone = new Pinecone({
      apiKey: config.pinecone.apiKey
    });
  }

  /**
   * Verificar si un índice existe
   * @param {string} indexName - Nombre del índice
   * @returns {Promise<boolean>}
   */
  async indexExists(indexName) {
    try {
      const indexes = await this.pinecone.listIndexes();
      return indexes.indexes?.some(index => index.name === indexName) || false;
    } catch (error) {
      console.error('Error al verificar índice:', error.message);
      return false;
    }
  }

  /**
   * Crear índice en Pinecone si no existe
   * @param {string} indexName - Nombre del índice
   * @param {number} dimension - Dimensión de los vectores (default: 1536 para text-embedding-3-small)
   * @param {string} metric - Métrica de similitud (default: cosine)
   * @param {string} cloud - Cloud provider (default: aws)
   * @param {string} region - Región (default: us-east-1)
   * @returns {Promise<boolean>}
   */
  async createIndexIfNotExists(
    indexName,
    dimension = 1536,
    metric = 'cosine',
    cloud = 'aws',
    region = 'us-east-1'
  ) {
    try {
      const exists = await this.indexExists(indexName);

      if (exists) {
        console.log(`✅ Índice "${indexName}" ya existe`);
        return true;
      }

      console.log(`📝 Creando índice "${indexName}"...`);
      console.log(`   - Dimensión: ${dimension}`);
      console.log(`   - Métrica: ${metric}`);
      console.log(`   - Cloud: ${cloud}`);
      console.log(`   - Región: ${region}`);

      await this.pinecone.createIndex({
        name: indexName,
        dimension: dimension,
        metric: metric,
        spec: {
          serverless: {
            cloud: cloud,
            region: region
          }
        }
      });

      // Esperar a que el índice esté listo
      console.log('⏳ Esperando a que el índice esté listo...');
      await this.waitForIndexReady(indexName);

      console.log(`✅ Índice "${indexName}" creado exitosamente`);
      return true;

    } catch (error) {
      console.error('❌ Error al crear índice:', error.message);
      throw error;
    }
  }

  /**
   * Esperar a que el índice esté listo
   * @param {string} indexName - Nombre del índice
   * @param {number} maxAttempts - Número máximo de intentos
   */
  async waitForIndexReady(indexName, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const description = await this.pinecone.describeIndex(indexName);

        if (description.status?.ready) {
          console.log('✅ Índice listo para usar');
          return true;
        }

        console.log(`   Intento ${i + 1}/${maxAttempts}: Estado ${description.status?.state || 'unknown'}`);
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.log(`   Intento ${i + 1}/${maxAttempts}: Esperando...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Timeout esperando a que el índice esté listo');
  }

  /**
   * Obtener información del índice
   * @param {string} indexName - Nombre del índice
   */
  async getIndexInfo(indexName) {
    try {
      const description = await this.pinecone.describeIndex(indexName);
      return description;
    } catch (error) {
      console.error('Error al obtener info del índice:', error.message);
      return null;
    }
  }

  /**
   * Eliminar índice (usar con precaución)
   * @param {string} indexName - Nombre del índice
   */
  async deleteIndex(indexName) {
    try {
      console.log(`⚠️  Eliminando índice "${indexName}"...`);
      await this.pinecone.deleteIndex(indexName);
      console.log('✅ Índice eliminado');
      return true;
    } catch (error) {
      console.error('Error al eliminar índice:', error.message);
      return false;
    }
  }

  /**
   * Listar todos los índices
   */
  async listIndexes() {
    try {
      const indexes = await this.pinecone.listIndexes();
      return indexes.indexes || [];
    } catch (error) {
      console.error('Error al listar índices:', error.message);
      return [];
    }
  }

  /**
   * Obtener estadísticas del índice
   * @param {string} indexName - Nombre del índice
   */
  async getIndexStats(indexName) {
    try {
      const index = this.pinecone.Index(indexName);
      const stats = await index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error('Error al obtener estadísticas:', error.message);
      return null;
    }
  }
}
