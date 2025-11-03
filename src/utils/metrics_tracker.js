import fs from 'node:fs/promises';

/**
 * Sistema de tracking de métricas para el agente RAG
 * Registra latencias, scores, distribución de sources, y errores
 */
export class MetricsTracker {
  constructor() {
    this.metrics = {
      queries: [],
      latencies: [],
      sources: { rag: 0, 'rag-chain': 0, perplexity: 0, direct: 0 },
      ragScores: [],
      errors: [],
      startTime: new Date().toISOString(),
    };
  }

  /**
   * Registrar una query completada
   * @param {string} query - Query del usuario
   * @param {Object} response - Respuesta del agente
   * @param {number} latency - Latencia en ms
   */
  trackQuery(query, response, latency) {
    const queryMetric = {
      query,
      source: response.source,
      latency,
      timestamp: new Date().toISOString(),
      ragScore: response.ragResults?.[0]?.score || null,
      documentsUsed: response.ragResults?.length || 0,
    };

    this.metrics.queries.push(queryMetric);
    this.metrics.latencies.push(latency);
    this.metrics.sources[response.source]++;

    // Registrar score de RAG si está disponible
    if (response.ragResults?.[0]?.score) {
      this.metrics.ragScores.push(response.ragResults[0].score);
    }
  }

  /**
   * Registrar un error
   * @param {Error} error - Error ocurrido
   * @param {Object} context - Contexto del error
   */
  trackError(error, context = {}) {
    this.metrics.errors.push({
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Obtener reporte de métricas
   * @returns {Object} - Reporte consolidado
   */
  getReport() {
    const totalQueries = this.metrics.queries.length;

    if (totalQueries === 0) {
      return {
        totalQueries: 0,
        message: 'No hay queries registradas todavía',
      };
    }

    const avgLatency =
      this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length;
    const avgRAGScore =
      this.metrics.ragScores.length > 0
        ? this.metrics.ragScores.reduce((a, b) => a + b, 0) /
          this.metrics.ragScores.length
        : 0;

    return {
      totalQueries,
      avgLatencyMs: Math.round(avgLatency),
      avgRAGScore: avgRAGScore.toFixed(3),
      minLatencyMs: Math.min(...this.metrics.latencies),
      maxLatencyMs: Math.max(...this.metrics.latencies),
      p50Latency: this.calculatePercentile(this.metrics.latencies, 0.5),
      p95Latency: this.calculatePercentile(this.metrics.latencies, 0.95),
      p99Latency: this.calculatePercentile(this.metrics.latencies, 0.99),
      sourceDistribution: this.metrics.sources,
      sourcePercentages: this.calculateSourcePercentages(),
      errorRate: ((this.metrics.errors.length / totalQueries) * 100).toFixed(2) + '%',
      totalErrors: this.metrics.errors.length,
      uptime: this.getUptime(),
    };
  }

  /**
   * Calcular percentil de un array
   * @param {Array} arr - Array de números
   * @param {number} p - Percentil (0-1)
   * @returns {number} - Valor del percentil
   */
  calculatePercentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return Math.round(sorted[Math.max(0, index)]);
  }

  /**
   * Calcular porcentajes de uso de cada source
   * @returns {Object} - Porcentajes por source
   */
  calculateSourcePercentages() {
    const total = this.metrics.queries.length;
    if (total === 0) return {};

    const percentages = {};
    for (const [source, count] of Object.entries(this.metrics.sources)) {
      percentages[source] = ((count / total) * 100).toFixed(1) + '%';
    }
    return percentages;
  }

  /**
   * Obtener uptime del tracker
   * @returns {string} - Tiempo desde que se inició el tracking
   */
  getUptime() {
    const start = new Date(this.metrics.startTime);
    const now = new Date();
    const diffMs = now - start;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    } else {
      return `${diffMins}m`;
    }
  }

  /**
   * Obtener queries más lentas
   * @param {number} limit - Número de queries a retornar
   * @returns {Array} - Queries más lentas
   */
  getSlowestQueries(limit = 10) {
    const sortedQueries = this.metrics.queries
      .slice()
      .sort((a, b) => b.latency - a.latency);
    return sortedQueries.slice(0, limit).map(q => ({
      query: q.query,
      latency: q.latency,
      source: q.source,
    }));
  }

  /**
   * Obtener queries con scores más bajos de RAG
   * @param {number} limit - Número de queries a retornar
   * @returns {Array} - Queries con scores bajos
   */
  getLowestScoringQueries(limit = 10) {
    const filteredQueries = this.metrics.queries.filter(q => q.ragScore !== null);
    const sortedQueries = filteredQueries.slice().sort((a, b) => a.ragScore - b.ragScore);
    return sortedQueries.slice(0, limit).map(q => ({
      query: q.query,
      score: q.ragScore?.toFixed(3),
      source: q.source,
    }));
  }

  /**
   * Exportar métricas a JSON
   * @param {string} filePath - Ruta del archivo
   */
  async exportToJSON(filePath) {
    try {
      const report = {
        summary: this.getReport(),
        slowestQueries: this.getSlowestQueries(),
        lowestScoringQueries: this.getLowestScoringQueries(),
        allQueries: this.metrics.queries,
        errors: this.metrics.errors,
      };

      await fs.writeFile(filePath, JSON.stringify(report, null, 2));
      console.log(`✅ Métricas exportadas a ${filePath}`);
      return true;
    } catch (error) {
      console.error('❌ Error al exportar métricas:', error.message);
      return false;
    }
  }

  /**
   * Imprimir reporte en consola
   */
  printReport() {
    const report = this.getReport();

    console.log('\n' + '='.repeat(60));
    console.log('📊 REPORTE DE MÉTRICAS DEL AGENTE RAG');
    console.log('='.repeat(60));
    console.log(`⏱️  Uptime: ${report.uptime}`);
    console.log(`📝 Total Queries: ${report.totalQueries}`);
    console.log(`❌ Total Errores: ${report.totalErrors} (${report.errorRate})`);
    console.log('\n--- LATENCIAS ---');
    console.log(`  Promedio: ${report.avgLatencyMs}ms`);
    console.log(`  Mínima: ${report.minLatencyMs}ms`);
    console.log(`  Máxima: ${report.maxLatencyMs}ms`);
    console.log(`  P50: ${report.p50Latency}ms`);
    console.log(`  P95: ${report.p95Latency}ms`);
    console.log(`  P99: ${report.p99Latency}ms`);
    console.log('\n--- DISTRIBUCIÓN DE SOURCES ---');
    for (const [source, count] of Object.entries(report.sourceDistribution)) {
      const percentage = report.sourcePercentages[source];
      console.log(`  ${source}: ${count} (${percentage})`);
    }
    if (report.avgRAGScore > 0) {
      console.log(`\n--- RAG SCORES ---`);
      console.log(`  Score promedio: ${report.avgRAGScore}`);
    }
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Resetear todas las métricas
   */
  reset() {
    this.metrics = {
      queries: [],
      latencies: [],
      sources: { rag: 0, 'rag-chain': 0, perplexity: 0, direct: 0 },
      ragScores: [],
      errors: [],
      startTime: new Date().toISOString(),
    };
    console.log('📊 Métricas reseteadas');
  }
}
