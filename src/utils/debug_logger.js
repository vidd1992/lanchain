/**
 * Logger de debug para visualizar el flujo del agente
 */
export class DebugLogger {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.startTime = null;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  startTimer() {
    this.startTime = Date.now();
  }

  getElapsed() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  log(category, message, data = null) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const elapsed = this.startTime ? `[+${this.getElapsed()}ms]` : '';

    console.log(`\n🔍 [${timestamp}]${elapsed} ${category}:`);
    console.log(`   ${message}`);

    if (data) {
      console.log('   Data:', JSON.stringify(data, null, 2));
    }
  }

  logIntent(intent, confidence) {
    if (!this.enabled) return;
    console.log(`\n💡 Intención detectada:`);
    console.log(`   - Tipo: ${intent}`);
    console.log(`   - Confianza: ${confidence}`);
  }

  logRAGSearch(query, results) {
    if (!this.enabled) return;
    console.log(`\n🔎 Búsqueda en RAG:`);
    console.log(`   - Query: "${query}"`);
    console.log(`   - Resultados encontrados: ${results.length}`);

    if (results.length > 0) {
      console.log(`\n   Top 3 resultados:`);
      results.slice(0, 3).forEach((result, idx) => {
        console.log(`   ${idx + 1}. Score: ${result.score.toFixed(4)}`);
        console.log(`      Contenido: ${result.content.substring(0, 100)}...`);
        console.log(`      Metadata:`, result.metadata);
      });
    }
  }

  logRAGDecision(hasRelevant, threshold, bestScore) {
    if (!this.enabled) return;
    console.log(`\n⚖️  Decisión RAG vs Perplexity:`);
    console.log(`   - Threshold: ${threshold}`);
    console.log(`   - Mejor score: ${bestScore ? bestScore.toFixed(4) : 'N/A'}`);
    console.log(`   - Decisión: ${hasRelevant ? 'Usar RAG ✅' : 'Usar Perplexity 🌐'}`);
  }

  logPrompt(type, prompt) {
    if (!this.enabled) return;
    console.log(`\n📝 Prompt enviado (${type}):`);
    console.log('─'.repeat(60));
    console.log(prompt);
    console.log('─'.repeat(60));
  }

  logResponse(source, response, tokens = null) {
    if (!this.enabled) return;
    console.log(`\n✨ Respuesta generada:`);
    console.log(`   - Fuente: ${source}`);
    if (tokens) {
      console.log(`   - Tokens usados: ${tokens}`);
    }
    console.log(`   - Contenido: ${response.substring(0, 200)}...`);
  }

  logError(error, context = '') {
    if (!this.enabled) return;
    console.error(`\n❌ Error ${context}:`);
    console.error(`   - Mensaje: ${error.message}`);
    console.error(`   - Stack:`, error.stack);
  }

  logMemory(history) {
    if (!this.enabled) return;
    console.log(`\n💭 Historial de conversación:`);
    console.log(`   - Mensajes en memoria: ${history.length}`);
    history.forEach((msg, idx) => {
      console.log(`   ${idx + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
    });
  }
}

// Instancia global para usar en toda la aplicación
export const debugLogger = new DebugLogger(
  process.env.DEBUG_MODE === 'true' || process.env.LANGCHAIN_VERBOSE === 'true'
);
