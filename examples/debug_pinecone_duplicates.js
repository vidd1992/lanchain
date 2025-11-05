import { PineconeService } from '../src/services/pinecone_service.js';
import { config } from '../src/config/env.js';

/**
 * Script para depurar la base de datos de Pinecone
 * - Buscar duplicados
 * - Ver distribución de metadatos
 * - Analizar calidad de los vectores
 */

async function debugPinecone() {
  console.log('🔍 Iniciando depuración de Pinecone...\n');

  const pineconeService = new PineconeService();
  await pineconeService.initialize();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 ANÁLISIS DE DUPLICADOS');
  console.log('═══════════════════════════════════════════════════════\n');

  // Para encontrar duplicados, vamos a hacer búsquedas de prueba
  // y analizar los resultados

  const testQueries = [
    'cursos de inglés',
    'Excel',
    'Python',
    'refrigeración',
    'precios',
    'horarios',
    'matrícula',
  ];

  const allResults = [];
  const duplicateAnalysis = new Map();

  for (const query of testQueries) {
    console.log(`\n🔍 Query de prueba: "${query}"`);
    const results = await pineconeService.searchSimilarDocuments(query, 10);

    console.log(`   Encontrados: ${results.length} documentos`);

    for (const result of results) {
      const key = `${result.metadata.source || 'unknown'}::${
        result.metadata.chunkIndex || 'no-index'
      }`;

      if (!duplicateAnalysis.has(key)) {
        duplicateAnalysis.set(key, []);
      }

      duplicateAnalysis.get(key).push({
        query: query,
        score: result.score,
        content: result.content.substring(0, 100),
        metadata: result.metadata,
      });

      allResults.push({
        query,
        score: result.score,
        source: result.metadata.source || 'unknown',
        chunkIndex: result.metadata.chunkIndex,
        tipo: result.metadata.tipo,
        content: result.content,
      });
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔎 BÚSQUEDA DE DUPLICADOS POR SOURCE + CHUNK');
  console.log('═══════════════════════════════════════════════════════\n');

  let duplicatesFound = 0;
  const duplicateGroups = [];

  for (const [key, occurrences] of duplicateAnalysis.entries()) {
    if (occurrences.length > 1) {
      // Verificar si el contenido es realmente duplicado
      const contents = occurrences.map(o => o.content);
      const uniqueContents = [...new Set(contents)];

      if (uniqueContents.length < contents.length) {
        duplicatesFound++;
        duplicateGroups.push({
          key,
          count: occurrences.length,
          occurrences,
        });

        console.log(`⚠️  Duplicado encontrado: ${key}`);
        console.log(`   Apariciones: ${occurrences.length}`);
        console.log(
          `   Queries donde apareció: ${occurrences.map(o => o.query).join(', ')}`
        );
        console.log(`   Contenido: "${occurrences[0].content.substring(0, 80)}..."`);
        console.log('');
      }
    }
  }

  if (duplicatesFound === 0) {
    console.log('✅ No se encontraron duplicados evidentes');
  } else {
    console.log(`\n📊 Total de duplicados encontrados: ${duplicatesFound}`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📈 DISTRIBUCIÓN POR TIPO DE DOCUMENTO');
  console.log('═══════════════════════════════════════════════════════\n');

  const typeDistribution = new Map();
  const sourceDistribution = new Map();

  for (const result of allResults) {
    // Contar por tipo
    const tipo = result.tipo || 'sin-tipo';
    typeDistribution.set(tipo, (typeDistribution.get(tipo) || 0) + 1);

    // Contar por source
    const source = result.source || 'sin-source';
    sourceDistribution.set(source, (sourceDistribution.get(source) || 0) + 1);
  }

  console.log('Por TIPO:');
  for (const [tipo, count] of typeDistribution.entries()) {
    console.log(`   ${tipo}: ${count} resultados`);
  }

  console.log('\nPor SOURCE (Top 10):');
  const sortedSources = [...sourceDistribution.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [source, count] of sortedSources) {
    console.log(`   ${source}: ${count} resultados`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🎯 ANÁLISIS DE SCORES');
  console.log('═══════════════════════════════════════════════════════\n');

  const scores = allResults.map(r => r.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  console.log(`Score promedio: ${avgScore.toFixed(4)}`);
  console.log(`Score máximo: ${maxScore.toFixed(4)}`);
  console.log(`Score mínimo: ${minScore.toFixed(4)}`);
  console.log(`Threshold configurado: ${config.rag.similarityThreshold}`);

  const aboveThreshold = scores.filter(s => s >= config.rag.similarityThreshold).length;
  const belowThreshold = scores.filter(s => s < config.rag.similarityThreshold).length;

  console.log(`\n✅ Por encima del threshold: ${aboveThreshold}`);
  console.log(`❌ Por debajo del threshold: ${belowThreshold}`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 COMPARACIÓN DE VECTORES (similitud coseno)');
  console.log('═══════════════════════════════════════════════════════\n');

  // Función para calcular similitud coseno entre dos vectores
  function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  console.log('🔄 Obteniendo vectores de embeddings para comparar...\n');

  // Crear embeddings para algunos documentos de muestra
  const sampleResults = allResults.slice(0, 20); // Limitamos a 20 para no exceder límites de API
  const embeddingsMap = new Map();

  console.log(`📊 Generando embeddings para ${sampleResults.length} documentos...\n`);

  for (let i = 0; i < sampleResults.length; i++) {
    const result = sampleResults[i];
    const key = `${result.source}::${result.chunkIndex}`;

    // Generar embedding para este contenido
    const embedding = await pineconeService.embeddings.embedQuery(result.content);
    embeddingsMap.set(key, {
      embedding,
      content: result.content,
      source: result.source,
      chunkIndex: result.chunkIndex,
    });
  }

  console.log('✅ Embeddings generados\n');
  console.log('🔎 Buscando vectores duplicados (similitud > 0.95):\n');

  const vectorDuplicates = [];
  const keys = Array.from(embeddingsMap.keys());

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const doc1 = embeddingsMap.get(keys[i]);
      const doc2 = embeddingsMap.get(keys[j]);

      const similarity = cosineSimilarity(doc1.embedding, doc2.embedding);

      // Si la similitud es muy alta (> 0.95), probablemente son duplicados
      if (similarity > 0.95) {
        vectorDuplicates.push({
          doc1Key: keys[i],
          doc2Key: keys[j],
          similarity,
          content1: doc1.content.substring(0, 100),
          content2: doc2.content.substring(0, 100),
        });

        console.log(`⚠️  Duplicado vectorial encontrado:`);
        console.log(`   Documento 1: ${keys[i]}`);
        console.log(`   Documento 2: ${keys[j]}`);
        console.log(`   Similitud coseno: ${similarity.toFixed(6)}`);
        console.log(`   Contenido 1: "${doc1.content.substring(0, 80)}..."`);
        console.log(`   Contenido 2: "${doc2.content.substring(0, 80)}..."`);
        console.log('');
      }
    }
  }

  if (vectorDuplicates.length === 0) {
    console.log('✅ No se encontraron vectores duplicados en la muestra analizada');
  } else {
    console.log(`\n📊 Total de duplicados vectoriales: ${vectorDuplicates.length}`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('💡 RECOMENDACIONES');
  console.log('═══════════════════════════════════════════════════════\n');

  if (duplicatesFound > 0) {
    console.log('⚠️  Se encontraron duplicados. Recomendaciones:');
    console.log('   1. Revisar el proceso de subida de documentos');
    console.log('   2. Usar source + chunkIndex únicos para cada documento');
    console.log('   3. Implementar deduplicación antes de subir');
  }

  if (belowThreshold > aboveThreshold) {
    console.log('⚠️  Muchos resultados por debajo del threshold. Considerar:');
    console.log(
      `   1. Reducir threshold de ${config.rag.similarityThreshold} a ${(
        config.rag.similarityThreshold - 0.1
      ).toFixed(2)}`
    );
    console.log('   2. Mejorar la calidad de los documentos fuente');
    console.log('   3. Usar chunks más grandes o con más overlap');
  }

  if (vectorDuplicates.length > 0) {
    console.log('⚠️  Duplicados vectoriales encontrados. Acciones recomendadas:');
    console.log('   1. Eliminar vectores duplicados del índice de Pinecone');
    console.log('   2. Revisar proceso de carga para evitar duplicación');
    console.log('   3. Usar IDs únicos basados en hash del contenido');
  }

  console.log('\n✅ Depuración completada');
}

// Ejecutar
debugPinecone()
  .then(() => {
    console.log('\n🎉 Proceso finalizado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
