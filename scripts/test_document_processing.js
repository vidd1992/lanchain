import { DocumentProcessor } from '../src/utils/document_processor.js';
import path from 'path';

/**
 * Script de prueba para verificar procesamiento de documentos
 * NO requiere API keys, solo prueba la extracción y chunking
 */
async function main() {
  try {
    console.log('🧪 Prueba de Procesamiento de Documentos\n');
    console.log('='.repeat(60));

    const documentsPath = path.join(process.cwd(), 'documents');
    const protocoloPath = path.join(documentsPath, 'protocolo.docx');

    // Crear processor
    const processor = new DocumentProcessor(1000, 200);

    console.log('\n📋 Paso 1: Extrayendo estructura del documento...\n');

    // Extraer estructura
    const structure = await processor.extractDocxStructure(protocoloPath);

    if (structure.hasStructure) {
      console.log(`✅ Estructura detectada!`);
      console.log(`   - Total secciones: ${structure.headings.length}`);
      console.log(`\n📑 Índice del documento:\n`);

      // Mostrar índice jerarquizado
      structure.headings.slice(0, 20).forEach(heading => {
        const indent = '  '.repeat(heading.level - 1);
        console.log(`${indent}${heading.level === 1 ? '📌' : '•'} ${heading.title}`);
      });

      if (structure.headings.length > 20) {
        console.log(`\n   ... y ${structure.headings.length - 20} secciones más`);
      }
    } else {
      console.log('⚠️  No se detectó estructura de headings');
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 Paso 2: Procesando documento completo...\n');

    // Procesar documento con estructura
    const docs = await processor.processDocxWithStructure(protocoloPath, {
      source: 'protocolo.docx',
      type: 'protocol'
    });

    console.log(`\n✅ Documento procesado!`);
    console.log(`   - Total chunks: ${docs.length}`);

    // Mostrar estadísticas
    const stats = processor.getDocumentStats(docs);
    console.log('\n📊 Estadísticas:');
    console.log(`   - Total documentos: ${stats.totalDocuments}`);
    console.log(`   - Total caracteres: ${stats.totalCharacters.toLocaleString()}`);
    console.log(`   - Promedio por chunk: ${stats.averageCharsPerDoc} caracteres`);

    // Mostrar primeros chunks como ejemplo
    console.log('\n' + '='.repeat(60));
    console.log('📄 Ejemplos de chunks generados:\n');

    // Mostrar el índice (primer documento)
    if (docs[0].metadata.type === 'index') {
      console.log('📑 CHUNK 0 - ÍNDICE:');
      console.log('─'.repeat(60));
      console.log(docs[0].pageContent.substring(0, 500));
      if (docs[0].pageContent.length > 500) {
        console.log(`... (${docs[0].pageContent.length - 500} caracteres más)`);
      }
      console.log('─'.repeat(60));
    }

    // Mostrar algunos chunks del contenido
    console.log('\n📄 CHUNK 1 - CONTENIDO:');
    console.log('─'.repeat(60));
    console.log(docs[1].pageContent.substring(0, 300));
    if (docs[1].pageContent.length > 300) {
      console.log(`... (${docs[1].pageContent.length - 300} caracteres más)`);
    }
    console.log('─'.repeat(60));

    if (docs.length > 2) {
      console.log('\n📄 CHUNK 2 - CONTENIDO:');
      console.log('─'.repeat(60));
      console.log(docs[2].pageContent.substring(0, 300));
      if (docs[2].pageContent.length > 300) {
        console.log(`... (${docs[2].pageContent.length - 300} caracteres más)`);
      }
      console.log('─'.repeat(60));
    }

    // Mostrar metadata de ejemplo
    console.log('\n📋 Metadata del primer chunk:');
    console.log(JSON.stringify(docs[0].metadata, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('✅ Prueba completada exitosamente!');
    console.log('='.repeat(60));

    console.log('\n📝 Próximos pasos:');
    console.log('   1. Configura tu .env con las API keys');
    console.log('   2. Ejecuta: npm run setup');
    console.log('   3. El documento se subirá a Pinecone automáticamente');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
