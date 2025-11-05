import { PineconeService } from '../src/services/pinecone_service.js';
import { DocumentProcessor } from '../src/utils/document_processor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Script para reprocesar un documento específico
 * Uso: node scripts/reprocess_single_doc.js <nombre-archivo>
 */

async function reprocessDocument(filename) {
  console.log(`🔄 Reprocesando documento: ${filename}\n`);

  // Inicializar servicios
  const pineconeService = new PineconeService();
  await pineconeService.initialize();

  const documentProcessor = new DocumentProcessor();

  // Ruta del documento
  const docPath = path.join(__dirname, '../documents', filename);

  console.log(`📄 Cargando: ${docPath}\n`);

  // Cargar y procesar documento
  const docs = await documentProcessor.loadDocument(docPath);

  if (docs.length === 0) {
    console.log('❌ No se pudo cargar el documento');
    return;
  }

  console.log(`✅ Documento cargado: ${docs.length} secciones\n`);

  // Dividir en chunks
  console.log('✂️  Dividiendo en chunks...');
  const chunks = await documentProcessor.textSplitter.splitDocuments(docs);
  console.log(`✅ ${chunks.length} chunks creados\n`);

  // Preparar textos y metadatos
  const texts = chunks.map(chunk => chunk.pageContent);
  const metadatas = chunks.map((chunk, index) => ({
    ...chunk.metadata,
    source: filename,
    chunkIndex: index,
  }));

  console.log('📤 Subiendo a Pinecone...');
  await pineconeService.addDocuments(texts, metadatas);

  console.log(`\n✅ Documento reprocesado exitosamente`);
  console.log(`📊 Total chunks subidos: ${chunks.length}`);
}

// Obtener nombre del archivo de los argumentos
const filename = process.argv[2] || 'protocolo.docx';

console.log('═══════════════════════════════════════════════════════');
console.log('🔄 REPROCESAR DOCUMENTO INDIVIDUAL');
console.log('═══════════════════════════════════════════════════════\n');

reprocessDocument(filename)
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
