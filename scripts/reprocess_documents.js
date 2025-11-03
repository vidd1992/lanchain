import { PineconeService } from '../src/services/pinecone_service.js';
import { DocumentProcessor } from '../src/utils/document_processor.js';
import { validateConfig } from '../src/config/env.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Script para re-procesar y subir documentos con categorías automáticas
 */
try {
  console.log('🔧 Validando configuración...');
  validateConfig();

  console.log('\n📚 Inicializando servicios...');
  const pineconeService = new PineconeService();
  await pineconeService.initialize();

  const processor = new DocumentProcessor();

  // Procesar FAQs
  const documentsPath = path.join(__dirname, '..', 'documents');
  console.log(`\n📂 Procesando documentos en: ${documentsPath}`);

  const docs = await processor.processDirectory(documentsPath, true);

  if (docs.length === 0) {
    console.log('⚠️  No se encontraron documentos para procesar');
    process.exit(0);
  }

  // Mostrar categorías detectadas
  console.log('\n📊 Categorías detectadas:');
  const categoryCount = {};
  for (const doc of docs) {
    const category = doc.metadata.category || 'sin-categoria';
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  }

  for (const [category, count] of Object.entries(categoryCount)) {
    console.log(`   ${category}: ${count} documentos`);
  }

  // Subir a Pinecone
  console.log(`\n⬆️  Subiendo ${docs.length} documentos a Pinecone...`);

  // Separar textos y metadatos
  const texts = docs.map(doc => doc.pageContent);
  const metadatas = docs.map(doc => doc.metadata);

  await pineconeService.addDocuments(texts, metadatas);

  console.log('\n✅ Documentos re-procesados y subidos exitosamente');
  console.log('\n💡 Ahora los filtros automáticos funcionarán correctamente');
} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
