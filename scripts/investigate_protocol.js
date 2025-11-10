/**
 * Script de Investigación del Protocolo de Atención
 * Analiza cómo está indexado el protocolo en Pinecone y por qué no se prioriza
 */

import { PineconeService } from '../src/services/pinecone_service.js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../src/config/env.js';

async function investigateProtocol() {
  console.log('\n' + '═'.repeat(80));
  console.log('🔍 INVESTIGACIÓN: PROTOCOLO DE ATENCIÓN EN PINECONE');
  console.log('═'.repeat(80) + '\n');

  // Inicializar servicios
  const pinecone = new PineconeService();
  await pinecone.initialize();

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openai.apiKey,
  });

  // ============================================================
  // PASO 1: Verificar estadísticas del índice
  // ============================================================
  console.log('📊 PASO 1: Estadísticas del Índice');
  console.log('-'.repeat(80));
  
  const index = pinecone.pinecone.Index(pinecone.indexName);
  const stats = await index.describeIndexStats();
  
  console.log(`📦 Total de vectores: ${stats.totalRecordCount}`);
  console.log(`🔢 Dimensiones: ${stats.dimension}`);
  if (stats.namespaces) {
    console.log('📁 Namespaces:');
    for (const [ns, data] of Object.entries(stats.namespaces)) {
      console.log(`   - ${ns || 'default'}: ${data.recordCount} vectores`);
    }
  }
  console.log('');

  // ============================================================
  // PASO 2: Buscar vectores del protocolo
  // ============================================================
  console.log('📋 PASO 2: Buscando Vectores del Protocolo');
  console.log('-'.repeat(80));

  // Buscar por metadata usando query
  const protocoloQueries = [
    'protocolo de atención',
    'protocolo atención cliente',
    'cómo atender clientes',
    'pasos para atender',
    'lineamientos de atención'
  ];

  for (const query of protocoloQueries) {
    console.log(`\n🔎 Query: "${query}"`);
    
    const queryEmbedding = await embeddings.embedQuery(query);
    
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 10,
      includeMetadata: true,
    });

    if (searchResults.matches && searchResults.matches.length > 0) {
      console.log(`   ✅ Encontrados ${searchResults.matches.length} resultados\n`);
      
      // Filtrar los que son del protocolo
      const protocolMatches = searchResults.matches.filter(match => 
        match.metadata?.source?.toLowerCase().includes('protocol') ||
        match.metadata?.type === 'protocol' ||
        match.metadata?.tipo === 'protocolo'
      );

      if (protocolMatches.length > 0) {
        console.log(`   📄 ${protocolMatches.length} son del PROTOCOLO:`);
        protocolMatches.forEach((match, idx) => {
          console.log(`\n   ${idx + 1}. Score: ${match.score.toFixed(4)}`);
          console.log(`      ID: ${match.id}`);
          console.log(`      Source: ${match.metadata?.source || 'N/A'}`);
          console.log(`      Type: ${match.metadata?.type || match.metadata?.tipo || 'N/A'}`);
          console.log(`      Chunk: ${match.metadata?.chunkIndex ?? 'N/A'}`);
          if (match.metadata?.text) {
            console.log(`      Texto (100 chars): ${match.metadata.text.substring(0, 100)}...`);
          }
        });
      } else {
        console.log(`   ⚠️  NINGUNO es del protocolo!`);
      }

      // Mostrar top 3 de todos los resultados
      console.log(`\n   📊 Top 3 resultados (cualquier fuente):`);
      searchResults.matches.slice(0, 3).forEach((match, idx) => {
        console.log(`   ${idx + 1}. [${match.score.toFixed(4)}] ${match.metadata?.source || 'N/A'}`);
      });
    } else {
      console.log('   ❌ No se encontraron resultados');
    }
  }

  // ============================================================
  // PASO 3: Listar TODOS los vectores del protocolo
  // ============================================================
  console.log('\n\n📚 PASO 3: Listando TODOS los Vectores del Protocolo');
  console.log('-'.repeat(80));

  // Crear un query dummy para buscar por metadata
  const dummyEmbedding = await embeddings.embedQuery('test');
  
  const allResults = await index.query({
    vector: dummyEmbedding,
    topK: 1000, // Traer muchos para filtrar
    includeMetadata: true,
  });

  const protocolVectors = allResults.matches.filter(match =>
    match.metadata?.source?.toLowerCase().includes('protocol') ||
    match.metadata?.type === 'protocol' ||
    match.metadata?.tipo === 'protocolo'
  );

  console.log(`\n✅ Total de vectores del PROTOCOLO encontrados: ${protocolVectors.length}`);

  if (protocolVectors.length > 0) {
    console.log('\n📋 Detalles de los vectores del protocolo:\n');
    
    protocolVectors.forEach((vector, idx) => {
      console.log(`${idx + 1}. ID: ${vector.id}`);
      console.log(`   Source: ${vector.metadata?.source || 'N/A'}`);
      console.log(`   Type: ${vector.metadata?.type || vector.metadata?.tipo || 'N/A'}`);
      console.log(`   Chunk Index: ${vector.metadata?.chunkIndex ?? 'N/A'}`);
      
      if (vector.metadata?.text) {
        console.log(`   Texto (200 chars):`);
        console.log(`   "${vector.metadata.text.substring(0, 200)}..."`);
      }
      
      if (vector.metadata?.titulo) {
        console.log(`   Título: ${vector.metadata.titulo}`);
      }
      
      console.log('');
    });

    // ============================================================
    // PASO 4: Analizar por qué no aparece en top results
    // ============================================================
    console.log('\n\n⚖️  PASO 4: Análisis de Priorización');
    console.log('-'.repeat(80));

    console.log('\n🔍 Comparando scores del protocolo vs otros documentos:\n');

    const testQuery = 'cómo debo atender a un cliente del CEC-EPN';
    console.log(`Query de prueba: "${testQuery}"\n`);

    const testEmbedding = await embeddings.embedQuery(testQuery);
    const testResults = await index.query({
      vector: testEmbedding,
      topK: 20,
      includeMetadata: true,
    });

    console.log('📊 Top 10 resultados:');
    testResults.matches.slice(0, 10).forEach((match, idx) => {
      const isProtocol = match.metadata?.source?.toLowerCase().includes('protocol') ||
                        match.metadata?.type === 'protocol';
      const marker = isProtocol ? '🎯 PROTOCOLO' : '📄 Otro';
      
      console.log(`${idx + 1}. [${match.score.toFixed(4)}] ${marker} - ${match.metadata?.source || 'N/A'}`);
    });

    const protocolInTop10 = testResults.matches && testResults.matches.slice(0, 10).some(match =>
      match.metadata?.source?.toLowerCase().includes('protocol') ||
      match.metadata?.type === 'protocol'
    );

    console.log(`\n🎯 Protocolo en top 10: ${protocolInTop10 ? 'SÍ ✅' : 'NO ❌'}`);

    if (!protocolInTop10) {
      console.log('\n⚠️  PROBLEMA IDENTIFICADO: El protocolo NO aparece en el top 10');
      console.log('   Posibles causas:');
      console.log('   1. El contenido del protocolo no es semánticamente similar a las queries');
      console.log('   2. El chunking fragmentó información importante');
      console.log('   3. Falta metadata que ayude a priorizarlo');
      console.log('   4. Los embeddings de los cursos tienen mayor similitud');
    } else {
      console.log('\n✅ El protocolo SÍ aparece en el top 10');
    }

  } else {
    console.log('\n❌ NO SE ENCONTRARON VECTORES DEL PROTOCOLO EN PINECONE');
    console.log('\n💡 Soluciones:');
    console.log('   1. Verificar si el archivo existe: documents/protocolo.docx');
    console.log('   2. Procesar e indexar el protocolo:');
    console.log('      npm run reprocess-doc protocolo.docx');
    console.log('   3. Verificar que se subió correctamente a Pinecone');
  }

  // ============================================================
  // PASO 5: Recomendaciones
  // ============================================================
  console.log('\n\n💡 PASO 5: Recomendaciones');
  console.log('-'.repeat(80));

  if (protocolVectors.length === 0) {
    console.log('\n🔴 ACCIÓN REQUERIDA: Indexar el protocolo');
    console.log('   Ejecutar: node scripts/reprocess_single_doc.js protocolo.docx');
  } else if (!protocolInTop10) {
    console.log('\n🟡 OPTIMIZACIÓN SUGERIDA:');
    console.log('   1. Agregar boost de score para documentos tipo "protocol"');
    console.log('   2. Mejorar metadata con keywords relacionados a atención');
    console.log('   3. Procesar el protocolo con chunks más grandes o contextuales');
    console.log('   4. Implementar filtrado por tipo de documento en queries');
  } else {
    console.log('\n🟢 El protocolo está indexado y aparece en búsquedas');
    console.log('   Posible mejora: Aumentar prioridad en el prompt del agente');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ INVESTIGACIÓN COMPLETADA');
  console.log('═'.repeat(80) + '\n');
}

// Ejecutar investigación
investigateProtocol()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error en investigación:', error);
    process.exit(1);
  });
