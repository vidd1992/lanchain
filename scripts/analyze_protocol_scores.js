/**
 * Análisis Profundo de Scores del Protocolo
 * Compara threshold actual vs scores reales del protocolo
 */

import { PineconeService } from '../src/services/pinecone_service.js';
import { config } from '../src/config/env.js';

async function analyzeProtocolScores() {
  console.log('\n' + '═'.repeat(80));
  console.log('📊 ANÁLISIS DE SCORES: PROTOCOLO vs THRESHOLD');
  console.log('═'.repeat(80) + '\n');

  const pinecone = new PineconeService();
  await pinecone.initialize();

  // ============================================================
  // Queries de prueba relacionadas con el protocolo
  // ============================================================
  const testQueries = [
    'cómo atender a un cliente',
    'protocolo de atención al cliente',
    'pasos para atender clientes',
    'lineamientos de atención',
    'cómo responder a un cliente',
    'proceso de atención',
    '¿Qué cursos de inglés tienen?',
    '¿Cuánto cuesta un curso?',
    'horarios de cursos',
    'cómo matricularse'
  ];

  console.log(`⚙️  CONFIGURACIÓN ACTUAL:`);
  console.log(`   Threshold: ${config.rag.similarityThreshold}`);
  console.log(`   Top K: ${config.rag.topK}\n`);
  console.log('━'.repeat(80) + '\n');

  const results = [];

  for (const query of testQueries) {
    console.log(`🔎 Query: "${query}"`);
    
    const docs = await pinecone.searchSimilarDocuments(query);
    
    // Filtrar protocolo
    const protocolDocs = docs.filter(doc => 
      doc.metadata?.source?.toLowerCase().includes('protocol')
    );

    const otherDocs = docs.filter(doc => 
      !doc.metadata?.source?.toLowerCase().includes('protocol')
    );

    const bestProtocolScore = protocolDocs.length > 0 ? protocolDocs[0].score : 0;
    const bestOtherScore = otherDocs.length > 0 ? otherDocs[0].score : 0;
    const passesThreshold = bestProtocolScore >= config.rag.similarityThreshold;

    console.log(`   📊 Mejor score PROTOCOLO: ${bestProtocolScore.toFixed(4)}`);
    console.log(`   📊 Mejor score OTROS: ${bestOtherScore.toFixed(4)}`);
    console.log(`   ${passesThreshold ? '✅' : '❌'} ${passesThreshold ? 'PASA' : 'NO PASA'} threshold (${config.rag.similarityThreshold})`);
    
    if (protocolDocs.length > 0) {
      const positionInAll = docs.findIndex(d => d.metadata?.source?.toLowerCase().includes('protocol'));
      console.log(`   🎯 Posición del protocolo: #${positionInAll + 1} de ${docs.length}`);
    } else {
      console.log(`   ⚠️  Protocolo NO aparece en resultados`);
    }
    
    console.log('');

    results.push({
      query,
      protocolScore: bestProtocolScore,
      otherScore: bestOtherScore,
      passesThreshold,
      protocolCount: protocolDocs.length
    });
  }

  // ============================================================
  // RESUMEN Y ESTADÍSTICAS
  // ============================================================
  console.log('━'.repeat(80));
  console.log('📈 RESUMEN ESTADÍSTICO');
  console.log('━'.repeat(80) + '\n');

  const protocolScores = results.map(r => r.protocolScore).filter(s => s > 0);
  const avgProtocolScore = protocolScores.reduce((a, b) => a + b, 0) / protocolScores.length;
  const maxProtocolScore = Math.max(...protocolScores);
  const minProtocolScore = Math.min(...protocolScores.filter(s => s > 0));

  console.log(`📊 Scores del PROTOCOLO:`);
  console.log(`   Promedio: ${avgProtocolScore.toFixed(4)}`);
  console.log(`   Máximo: ${maxProtocolScore.toFixed(4)}`);
  console.log(`   Mínimo: ${minProtocolScore.toFixed(4)}`);
  console.log(`   Threshold actual: ${config.rag.similarityThreshold}`);
  console.log(`   Diferencia vs threshold: ${(config.rag.similarityThreshold - avgProtocolScore).toFixed(4)}`);

  const passingQueries = results.filter(r => r.passesThreshold).length;
  const totalQueries = results.length;
  const passingPercentage = (passingQueries / totalQueries * 100).toFixed(1);

  console.log(`\n📉 Queries que PASAN el threshold:`);
  console.log(`   ${passingQueries} de ${totalQueries} (${passingPercentage}%)`);

  // ============================================================
  // DIAGNÓSTICO Y RECOMENDACIONES
  // ============================================================
  console.log('\n' + '━'.repeat(80));
  console.log('💡 DIAGNÓSTICO');
  console.log('━'.repeat(80) + '\n');

  if (avgProtocolScore < config.rag.similarityThreshold) {
    const diff = config.rag.similarityThreshold - avgProtocolScore;
    console.log(`🔴 PROBLEMA CRÍTICO: Scores demasiado bajos\n`);
    console.log(`   El score promedio del protocolo (${avgProtocolScore.toFixed(4)}) está`);
    console.log(`   ${diff.toFixed(4)} puntos POR DEBAJO del threshold (${config.rag.similarityThreshold})\n`);
    console.log(`   Esto significa que el protocolo prácticamente NUNCA se usa.`);
    console.log(`   El sistema siempre hace fallback a Perplexity.\n`);

    console.log(`💡 SOLUCIONES POSIBLES:\n`);
    console.log(`   OPCIÓN 1: Bajar el threshold (MÁS RÁPIDO)`);
    console.log(`   ────────────────────────────────────────`);
    console.log(`   Threshold recomendado: ${(maxProtocolScore - 0.05).toFixed(2)} - ${maxProtocolScore.toFixed(2)}`);
    console.log(`   Esto permitirá que el protocolo se use\n`);

    console.log(`   OPCIÓN 2: Agregar boost de score para tipo "protocol" (MEDIO)`);
    console.log(`   ───────────────────────────────────────────────────────────────`);
    console.log(`   Multiplicar scores del protocolo por un factor (ej: 1.5x)`);
    console.log(`   Score boosted: ${(avgProtocolScore * 1.5).toFixed(4)}\n`);

    console.log(`   OPCIÓN 3: Reprocesar con mejor chunking (MÁS TRABAJO)`);
    console.log(`   ──────────────────────────────────────────────────────`);
    console.log(`   - Chunks más grandes (2000 chars)`);
    console.log(`   - Mantener contexto estructural`);
    console.log(`   - Agregar keywords en metadata\n`);

    console.log(`   OPCIÓN 4: Filtrado explícito por tipo (ALTERNATIVA)`);
    console.log(`   ──────────────────────────────────────────────────────`);
    console.log(`   En queries sobre "atención", buscar primero en protocolo`);
    console.log(`   Usar threshold más bajo solo para protocolo\n`);

  } else {
    console.log(`✅ Los scores del protocolo son adecuados`);
    console.log(`   El problema puede estar en otro lado.`);
  }

  console.log('═'.repeat(80));
  console.log('✅ ANÁLISIS COMPLETADO');
  console.log('═'.repeat(80) + '\n');
}

analyzeProtocolScores()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
