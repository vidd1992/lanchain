/**
 * Sistema de logging mejorado para el flujo RAG
 * Proporciona visibilidad clara de cada paso del proceso
 */

export class RAGLogger {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.startTime = null;
  }

  /**
   * Inicia el tracking de tiempo para una query
   */
  startQuery(query, sessionId) {
    if (!this.enabled) return;
    
    this.startTime = Date.now();
    console.log('\n' + '🚀'.repeat(40));
    console.log('🔵 NUEVA QUERY RECIBIDA');
    console.log('━'.repeat(80));
    console.log(`📝 Query: "${query}"`);
    console.log(`🆔 Session: ${sessionId}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log('━'.repeat(80) + '\n');
  }

  /**
   * Log del contexto conversacional cargado
   */
  logContext(conversationHistory, hasSummary = false, summaryContent = '') {
    if (!this.enabled) return;

    console.log('📚 CONTEXTO CONVERSACIONAL CARGADO');
    console.log('━'.repeat(80));
    console.log(`📊 Total mensajes en memoria: ${conversationHistory.length}`);
    
    if (hasSummary) {
      console.log('📝 Resumen disponible: ✅ SÍ');
      console.log(`   Contenido: "${summaryContent.substring(0, 100)}${summaryContent.length > 100 ? '...' : ''}"`);
    } else {
      console.log('📝 Resumen disponible: ❌ NO (primera conversación)');
    }

    console.log('\n💬 Historial de mensajes:');
    conversationHistory.slice(-5).forEach((msg, idx) => {
      const role = msg.role === 'user' ? '👤' : '🤖';
      const preview = msg.content.substring(0, 60);
      console.log(`   ${role} [${idx + 1}] ${preview}${msg.content.length > 60 ? '...' : ''}`);
    });
    
    if (conversationHistory.length > 5) {
      console.log(`   ... (${conversationHistory.length - 5} mensajes anteriores)`);
    }
    console.log('━'.repeat(80) + '\n');
  }

  /**
   * Log de la transformación de query
   */
  logQueryTransform(original, transformed, intent) {
    if (!this.enabled) return;

    console.log('🔄 TRANSFORMACIÓN DE QUERY');
    console.log('━'.repeat(80));
    console.log(`📝 Original:     "${original}"`);
    console.log(`🎯 Transformada: "${transformed}"`);
    console.log(`🧠 Intent:       ${intent}`);
    
    if (original !== transformed) {
      console.log('✅ Query optimizada para búsqueda contextual');
    } else {
      console.log('ℹ️  Query sin cambios (ya es clara)');
    }
    console.log('━'.repeat(80) + '\n');
  }

  /**
   * Log de búsqueda en Pinecone
   */
  logPineconeSearch(transformedQuery, results, threshold) {
    if (!this.enabled) return;

    console.log('🔍 BÚSQUEDA EN PINECONE');
    console.log('━'.repeat(80));
    console.log(`🔎 Query de búsqueda: "${transformedQuery}"`);
    console.log(`📊 Threshold configurado: ${threshold}`);
    console.log(`📦 Resultados encontrados: ${results.length}`);
    
    if (results.length > 0) {
      console.log('\n📋 Top resultados:');
      results.slice(0, 3).forEach((doc, idx) => {
        const title = doc.metadata?.titulo || doc.metadata?.nombre || 'Sin título';
        console.log(`   ${idx + 1}. [Score: ${doc.score.toFixed(4)}] ${title}`);
        console.log(`      Preview: ${doc.content.substring(0, 80)}...`);
      });
      
      const avgScore = (results.reduce((sum, doc) => sum + doc.score, 0) / results.length).toFixed(4);
      console.log(`\n📈 Score promedio: ${avgScore}`);
      console.log(`✅ Documentos relevantes encontrados`);
    } else {
      console.log('❌ No se encontraron documentos relevantes');
      console.log('➡️  Fallback: Perplexity');
    }
    console.log('━'.repeat(80) + '\n');
  }

  /**
   * Log de generación de respuesta RAG
   */
  logRAGGeneration(documents, contextSize, historySize) {
    if (!this.enabled) return;

    console.log('🤖 GENERACIÓN DE RESPUESTA RAG');
    console.log('━'.repeat(80));
    console.log(`📚 Documentos en contexto: ${documents}`);
    console.log(`📏 Tamaño del contexto: ${contextSize} caracteres`);
    console.log(`💬 Mensajes en historial: ${historySize}`);
    console.log(`🔧 Modelo: gpt-4o-mini`);
    console.log(`🌡️  Temperature: 0.3`);
    console.log('━'.repeat(80) + '\n');
  }

  /**
   * Log de decisión RAG vs Perplexity
   */
  logRAGDecision(hasRelevant, threshold, bestScore) {
    if (!this.enabled) return;

    console.log('⚖️  DECISIÓN DE FUENTE');
    console.log('━'.repeat(80));
    console.log(`📊 Threshold: ${threshold}`);
    console.log(`🎯 Mejor score: ${bestScore ? bestScore.toFixed(4) : 'N/A'}`);
    console.log(`✅ ¿Relevante?: ${hasRelevant ? 'SÍ ✓' : 'NO ✗'}`);
    console.log(`📤 Decisión: ${hasRelevant ? 'Usar RAG' : 'Fallback a Perplexity'}`);
    console.log('━'.repeat(80) + '\n');
  }

  /**
   * Log de respuesta final
   */
  logResponse(source, answer, ragScore = null) {
    if (!this.enabled) return;

    const elapsed = this.startTime ? Date.now() - this.startTime : 0;
    const answerLength = typeof answer === 'string' ? answer.length : 0;

    console.log('✅ RESPUESTA GENERADA');
    console.log('━'.repeat(80));
    console.log(`📤 Fuente: ${source.toUpperCase()}`);
    console.log(`📏 Longitud respuesta: ${answerLength} caracteres`);
    if (ragScore) {
      console.log(`📊 Score RAG promedio: ${ragScore.toFixed(4)}`);
    }
    console.log(`⏱️  Tiempo total: ${elapsed}ms`);
    console.log('━'.repeat(80) + '\n');
  }

  /**
   * Log de error
   */
  logError(error, step) {
    if (!this.enabled) return;

    console.error('\n❌ ERROR EN FLUJO RAG');
    console.error('━'.repeat(80));
    console.error(`🔴 Paso: ${step}`);
    console.error(`💥 Error: ${error.message}`);
    if (error.stack) {
      console.error(`📍 Stack:\n${error.stack}`);
    }
    console.error('━'.repeat(80) + '\n');
  }

  /**
   * Log de métricas de historial
   */
  logHistoryMetrics(action, details) {
    if (!this.enabled) return;

    console.log(`\n💾 HISTORIAL - ${action}`);
    console.log('━'.repeat(80));
    Object.entries(details).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log('━'.repeat(80) + '\n');
  }

  /**
   * Log compacto de summary
   */
  logSummaryCreation(oldCount, newCount, summaryLength) {
    if (!this.enabled) return;

    console.log('\n📄 RESUMEN CREADO');
    console.log('━'.repeat(80));
    console.log(`   Mensajes antiguos: ${oldCount - newCount}`);
    console.log(`   Mensajes mantenidos: ${newCount}`);
    console.log(`   Longitud del resumen: ${summaryLength} caracteres`);
    console.log('━'.repeat(80) + '\n');
  }

  /**
   * Desactivar logs temporalmente
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Activar logs
   */
  enable() {
    this.enabled = true;
  }
}

// Exportar instancia singleton
export const ragLogger = new RAGLogger(true);
