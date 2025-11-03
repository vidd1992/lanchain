import { PineconeSetup } from '../src/utils/pinecone_setup.js';
import { validateConfig, config } from '../src/config/env.js';

/**
 * Script para listar índices de Pinecone
 */
async function main() {
  try {
    console.log('📋 Listando índices de Pinecone...\n');

    validateConfig();

    const pineconeSetup = new PineconeSetup();
    const indexes = await pineconeSetup.listIndexes();

    if (indexes.length === 0) {
      console.log('No hay índices en tu cuenta de Pinecone');
      return;
    }

    console.log(`✅ Encontrados ${indexes.length} índices:\n`);

    for (const index of indexes) {
      console.log(`📌 ${index.name}`);
      console.log(`   - Estado: ${index.status?.ready ? 'Listo' : 'No listo'}`);
      console.log(`   - Dimensión: ${index.dimension}`);
      console.log(`   - Métrica: ${index.metric}`);
      console.log(`   - Host: ${index.host}`);

      // Obtener estadísticas
      const stats = await pineconeSetup.getIndexStats(index.name);
      if (stats) {
        console.log(`   - Vectores: ${stats.totalRecordCount || 0}`);
      }
      console.log('');
    }

    console.log('\n💡 Para usar uno de estos índices:');
    console.log('   1. Edita tu .env');
    console.log('   2. Cambia PINECONE_INDEX_NAME=nombre-del-indice');
    console.log('   3. Ejecuta: npm run setup');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
