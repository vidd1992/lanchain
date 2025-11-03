import { PineconeSetup } from '../src/utils/pinecone_setup.js';
import { DocumentProcessor } from '../src/utils/document_processor.js';
import { RAGAgent } from '../src/agent/rag_agent.js';
import { validateConfig, config } from '../src/config/env.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Script principal para configurar Pinecone y subir documentos
 */
async function main() {
  try {
    console.log('🚀 Iniciando configuración y carga de documentos\n');
    console.log('='.repeat(60));

    // 1. Validar configuración
    console.log('\n📋 Paso 1: Validando configuración...');
    validateConfig();
    console.log('✅ Configuración válida');

    // 2. Configurar Pinecone
    console.log('\n📋 Paso 2: Configurando Pinecone...');
    const pineconeSetup = new PineconeSetup();

    // Crear índice si no existe
    await pineconeSetup.createIndexIfNotExists(
      config.pinecone.indexName,
      config.pinecone.dimension || 1536,
      config.pinecone.metric || 'cosine',
      config.pinecone.cloud || 'aws',
      config.pinecone.region || 'us-east-1'
    );

    // Mostrar info del índice
    const indexInfo = await pineconeSetup.getIndexInfo(config.pinecone.indexName);
    console.log('\n📊 Información del índice:');
    console.log(`   - Nombre: ${config.pinecone.indexName}`);
    console.log(`   - Dimensión: ${indexInfo.dimension}`);
    console.log(`   - Métrica: ${indexInfo.metric}`);
    console.log(`   - Estado: ${indexInfo.status?.ready ? 'Listo' : 'No listo'}`);

    // 3. Procesar documentos
    console.log('\n📋 Paso 3: Procesando documentos...');
    const documentsPath = path.join(process.cwd(), 'documents');

    // Verificar si existe la carpeta documents
    try {
      await fs.access(documentsPath);
    } catch (error) {
      console.log('📁 Creando carpeta documents/...');
      await fs.mkdir(documentsPath, { recursive: true });
      console.log('⚠️  La carpeta documents/ está vacía. Coloca tus archivos ahí.');
      console.log('   Formatos soportados: .txt, .md, .pdf, .docx, .csv, .json');
      console.log('   Para FAQs, nombra el archivo como faq_*.txt o faq_*.json');
      console.log('   Los archivos .docx se procesan con extracción de estructura/índice');
      return;
    }

    // Listar archivos
    const files = await fs.readdir(documentsPath);
    if (files.length === 0) {
      console.log('⚠️  No se encontraron archivos en documents/');
      return;
    }

    console.log(`📁 Encontrados ${files.length} archivos:`);
    files.forEach(file => console.log(`   - ${file}`));

    // Procesar documentos
    const processor = new DocumentProcessor(
      config.processing?.chunkSize || 1000,
      config.processing?.chunkOverlap || 200
    );

    const allDocuments = [];

    for (const file of files) {
      const filePath = path.join(documentsPath, file);
      const stat = await fs.stat(filePath);

      // Saltar directorios
      if (!stat.isFile()) {
        continue;
      }

      const isFAQ = file.toLowerCase().startsWith('faq');
      const isDocx = file.toLowerCase().endsWith('.docx');

      console.log(`\n📄 Procesando: ${file} ${isFAQ ? '(FAQ)' : isDocx ? '(DOCX con estructura)' : ''}...`);

      let docs;

      // Procesamiento especial para .docx para extraer estructura
      if (isDocx) {
        docs = await processor.processDocxWithStructure(filePath, {
          source: file,
          uploadDate: new Date().toISOString()
        });
      } else {
        docs = await processor.processFile(filePath, isFAQ, {
          source: file,
          uploadDate: new Date().toISOString()
        });
      }

      allDocuments.push(...docs);
    }

    // Validar documentos
    const validDocuments = processor.validateDocuments(allDocuments);
    console.log(`\n✅ Documentos válidos: ${validDocuments.length}`);

    // Mostrar estadísticas
    const stats = processor.getDocumentStats(validDocuments);
    console.log('\n📊 Estadísticas:');
    console.log(`   - Total documentos: ${stats.totalDocuments}`);
    console.log(`   - Total caracteres: ${stats.totalCharacters.toLocaleString()}`);
    console.log(`   - Promedio por chunk: ${stats.averageCharsPerDoc} caracteres`);
    console.log(`   - Archivos procesados: ${stats.sources}`);

    if (validDocuments.length === 0) {
      console.log('⚠️  No hay documentos para subir');
      return;
    }

    // 4. Subir a Pinecone
    console.log('\n📋 Paso 4: Subiendo documentos a Pinecone...');

    const agent = new RAGAgent();
    await agent.initialize();

    // Subir en batches para evitar timeouts
    const batchSize = 100;
    let uploaded = 0;

    for (let i = 0; i < validDocuments.length; i += batchSize) {
      const batch = validDocuments.slice(i, i + batchSize);
      const texts = batch.map(doc => doc.pageContent);
      const metadatas = batch.map(doc => doc.metadata);

      console.log(`   Subiendo batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validDocuments.length / batchSize)} (${batch.length} documentos)...`);

      await agent.addDocuments(texts, metadatas);
      uploaded += batch.length;

      console.log(`   ✅ ${uploaded}/${validDocuments.length} documentos subidos`);
    }

    // 5. Verificar estadísticas finales
    console.log('\n📋 Paso 5: Verificando estadísticas finales...');
    const finalStats = await pineconeSetup.getIndexStats(config.pinecone.indexName);

    if (finalStats) {
      console.log('\n📊 Estadísticas del índice:');
      console.log(`   - Total vectores: ${finalStats.totalRecordCount || 'N/A'}`);
      console.log(`   - Namespaces: ${finalStats.namespaces ? Object.keys(finalStats.namespaces).length : 'N/A'}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ¡Proceso completado exitosamente!');
    console.log('='.repeat(60));

    console.log('\n📝 Próximos pasos:');
    console.log('   1. Ejecuta: npm run example (para probar el chat)');
    console.log('   2. O ejecuta: npm test (para pruebas automáticas)');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
