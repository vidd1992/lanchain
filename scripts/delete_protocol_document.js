/**
 * Script para eliminar un documento específico del índice de Pinecone
 */

import { PineconeService } from '../src/services/pinecone_service.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deleteDocument(filename) {
  console.log('\n' + '═'.repeat(80));
  console.log('🗑️  ELIMINAR DOCUMENTO DEL ÍNDICE');
  console.log('═'.repeat(80) + '\n');

  console.log(`📄 Archivo a eliminar: ${filename}\n`);

  // Inicializar Pinecone
  const pinecone = new PineconeService();
  await pinecone.initialize();

  const index = pinecone.pinecone.Index(pinecone.indexName);

  // Buscar vectores con este source
  console.log('🔍 Buscando vectores del documento...');
  
  const queryVector = new Array(1536).fill(0); // Vector dummy
  const results = await index.query({
    vector: queryVector,
    topK: 10000,
    includeMetadata: true,
    filter: { source: filename }
  });

  if (!results.matches || results.matches.length === 0) {
    console.log('⚠️  No se encontraron vectores para este documento\n');
    return;
  }

  const idsToDelete = results.matches.map(match => match.id);
  console.log(`   ✅ Encontrados ${idsToDelete.length} vectores\n`);

  // Mostrar info del documento
  const firstMatch = results.matches[0];
  console.log('📋 Información del documento:');
  console.log(`   Source: ${firstMatch.metadata?.source}`);
  console.log(`   Type: ${firstMatch.metadata?.type || 'N/A'}`);
  console.log(`   Priority: ${firstMatch.metadata?.priority || 'N/A'}`);
  console.log(`   Category: ${firstMatch.metadata?.category || 'N/A'}`);
  console.log(`   Chunks: ${idsToDelete.length}\n`);

  // Eliminar en batches de 100
  console.log('🗑️  Eliminando vectores...');
  for (let i = 0; i < idsToDelete.length; i += 100) {
    const batch = idsToDelete.slice(i, i + 100);
    await index.deleteMany(batch);
    console.log(`   Eliminados ${Math.min(i + 100, idsToDelete.length)}/${idsToDelete.length}`);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ DOCUMENTO ELIMINADO EXITOSAMENTE');
  console.log('═'.repeat(80));
  console.log(`📄 Archivo: ${filename}`);
  console.log(`🗑️  Vectores eliminados: ${idsToDelete.length}\n`);
}

// CLI
const filename = process.argv[2];

if (!filename) {
  console.log('\n📄 USO:\n');
  console.log('  node scripts/delete_protocol_document.js <nombre-archivo>\n');
  console.log('Ejemplo:');
  console.log('  node scripts/delete_protocol_document.js protocolo-contacto-sedes.txt\n');
  process.exit(0);
}

deleteDocument(filename)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
