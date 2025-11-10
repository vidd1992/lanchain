/**
 * Ver el contenido real del protocolo.docx
 * Para entender qué información contiene
 */

import { DocumentProcessor } from '../src/utils/document_processor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function viewProtocolContent() {
  console.log('\n' + '═'.repeat(80));
  console.log('📄 CONTENIDO DEL PROTOCOLO.DOCX');
  console.log('═'.repeat(80) + '\n');

  const processor = new DocumentProcessor();
  const docPath = path.join(__dirname, '../documents/protocolo.docx');

  console.log(`📂 Cargando: ${docPath}\n`);

  // Cargar documento
  const docs = await processor.loadDocument(docPath);

  console.log(`✅ Documento cargado: ${docs.length} secciones\n`);
  console.log('━'.repeat(80));

  // Mostrar las primeras 5 secciones completas
  console.log('\n📋 PRIMERAS 5 SECCIONES DEL DOCUMENTO:\n');
  
  docs.slice(0, 5).forEach((doc, idx) => {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`SECCIÓN ${idx + 1}`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`Longitud: ${doc.pageContent.length} caracteres\n`);
    console.log(doc.pageContent);
    console.log(`\nMetadata:`, doc.metadata);
  });

  // Dividir en chunks
  console.log('\n\n' + '━'.repeat(80));
  console.log('✂️  CHUNKS GENERADOS');
  console.log('━'.repeat(80) + '\n');

  const chunks = await processor.textSplitter.splitDocuments(docs);
  console.log(`Total de chunks: ${chunks.length}\n`);

  // Mostrar primeros 3 chunks
  console.log('📦 PRIMEROS 3 CHUNKS:\n');
  
  chunks.slice(0, 3).forEach((chunk, idx) => {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`CHUNK ${idx + 1}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`Longitud: ${chunk.pageContent.length} caracteres\n`);
    console.log(chunk.pageContent.substring(0, 500));
    if (chunk.pageContent.length > 500) {
      console.log('\n... (truncado)');
    }
  });

  // Buscar contenido sobre "protocolo de atención"
  console.log('\n\n' + '━'.repeat(80));
  console.log('🔍 BÚSQUEDA: "protocolo" o "atención"');
  console.log('━'.repeat(80) + '\n');

  const protocolRelated = chunks.filter(chunk => 
    chunk.pageContent.toLowerCase().includes('protocolo') ||
    chunk.pageContent.toLowerCase().includes('atención') ||
    chunk.pageContent.toLowerCase().includes('atender')
  );

  console.log(`✅ Encontrados ${protocolRelated.length} chunks relacionados con protocolo/atención\n`);

  if (protocolRelated.length > 0) {
    console.log('📋 MUESTRA DE CHUNKS RELACIONADOS:\n');
    protocolRelated.slice(0, 3).forEach((chunk, idx) => {
      console.log(`\n${idx + 1}. ${chunk.pageContent.substring(0, 300)}...`);
      console.log('');
    });
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ ANÁLISIS COMPLETADO');
  console.log('═'.repeat(80) + '\n');
}

viewProtocolContent()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  });
