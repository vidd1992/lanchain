/**
 * Script de debug para investigar búsqueda en Pinecone
 */

import { PineconeService } from '../src/services/pinecone_service.js';
import { validateConfig } from '../src/config/env.js';

async function debugSearch() {
  try {
    console.log('🔧 Validando configuración...');
    validateConfig();

    console.log('🚀 Inicializando Pinecone...');
    const pinecone = new PineconeService();
    await pinecone.initialize();

    // La pregunta que está fallando
    const query = '¿Cómo puedo rendir un examen antes de la fecha prevista?';

    console.log('\n' + '='.repeat(80));
    console.log('🔍 BÚSQUEDA DE DEBUG');
    console.log('='.repeat(80));
    console.log(`📝 Query: "${query}"`);
    console.log('');

    // Buscar con TOP 10 para ver todos los resultados
    console.log('🔎 Buscando en Pinecone (top 10)...\n');
    const results = await pinecone.searchSimilarDocuments(query, 10);

    if (results.length === 0) {
      console.log('❌ No se encontraron resultados');
      return;
    }

    console.log(`✅ Se encontraron ${results.length} resultados:\n`);

    results.forEach((result, idx) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Resultado ${idx + 1}:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(
        `📊 Score: ${result.score.toFixed(4)} ${result.score >= 0.5 ? '✅' : '❌'}`
      );
      console.log(`📄 Contenido (primeros 200 chars):`);
      console.log(`   ${result.content.substring(0, 200)}...`);
      console.log(`🏷️  Metadata:`);
      console.log(`   ${JSON.stringify(result.metadata, null, 2)}`);
      console.log('');
    });

    console.log('\n' + '='.repeat(80));
    console.log('📊 ANÁLISIS:');
    console.log('='.repeat(80));

    const threshold = 0.5;
    const relevantResults = results.filter(r => r.score >= threshold);

    console.log(`🎯 Threshold configurado: ${threshold}`);
    console.log(`✅ Resultados sobre threshold: ${relevantResults.length}`);
    console.log(
      `❌ Resultados bajo threshold: ${results.length - relevantResults.length}`
    );

    if (relevantResults.length > 0) {
      console.log(`\n🏆 MEJOR RESULTADO (${relevantResults[0].score.toFixed(4)}):`);
      console.log(relevantResults[0].content);
    } else {
      console.log('\n⚠️  NINGÚN RESULTADO SUPERA EL THRESHOLD');
      console.log('Posibles causas:');
      console.log('  1. El documento no existe en Pinecone');
      console.log('  2. El embedding de la pregunta es muy diferente');
      console.log('  3. El threshold es muy alto');
      console.log('  4. Los documentos se subieron con formato diferente');
    }

    // Buscar documentos que contengan palabras clave
    console.log('\n' + '='.repeat(80));
    console.log('🔍 BÚSQUEDA POR PALABRAS CLAVE:');
    console.log('='.repeat(80));

    const keywords = ['examen', 'fecha', 'prevista', 'rendir'];
    console.log(`Buscando documentos que contengan: ${keywords.join(', ')}\n`);

    const matchingDocs = results.filter(r => {
      const content = r.content.toLowerCase();
      return keywords.some(kw => content.includes(kw));
    });

    console.log(`📦 Documentos con palabras clave: ${matchingDocs.length}`);

    if (matchingDocs.length > 0) {
      matchingDocs.forEach((doc, idx) => {
        console.log(`\n${idx + 1}. Score: ${doc.score.toFixed(4)}`);
        console.log(`   Contenido: ${doc.content.substring(0, 150)}...`);
      });
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Ejecutar
debugSearch();
