/**
 * Script para agregar o actualizar documentos de protocolo al índice de Pinecone
 * Soporta archivos TXT y DOCX
 * Los marca como tipo "protocol" para que sean priorizados
 */

import { PineconeService } from '../src/services/pinecone_service.js';
import { DocumentProcessor } from '../src/utils/document_processor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Agrega o actualiza un documento en el índice
 * @param {string} filename - Nombre del archivo (con extensión)
 * @param {Object} options - Opciones adicionales
 */
async function addProtocolDocument(filename, options = {}) {
  console.log('\n' + '═'.repeat(80));
  console.log('📄 AGREGAR/ACTUALIZAR DOCUMENTO DE PROTOCOLO');
  console.log('═'.repeat(80) + '\n');

  const {
    type = 'protocol',           // Tipo de documento (para priorización)
    priority = 'high',            // Prioridad (high, medium, low)
    category = 'general',         // Categoría (contacto, cursos, procedimientos)
    deleteExisting = true,        // Eliminar versión anterior
    chunkSize = 1000,            // Tamaño de los chunks
    chunkOverlap = 200           // Overlap entre chunks
  } = options;

  // Validar que el archivo existe
  const docPath = path.join(__dirname, '../documents', filename);
  
  if (!fs.existsSync(docPath)) {
    console.error(`❌ Error: El archivo no existe: ${docPath}`);
    console.log('\n💡 Verifica que el archivo esté en la carpeta documents/');
    return;
  }

  console.log(`📂 Archivo: ${filename}`);
  console.log(`📍 Ruta: ${docPath}`);
  console.log(`🏷️  Tipo: ${type}`);
  console.log(`⭐ Prioridad: ${priority}`);
  console.log(`📁 Categoría: ${category}`);
  console.log(`🔄 Eliminar existente: ${deleteExisting ? 'SÍ' : 'NO'}\n`);

  // Inicializar servicios
  const pinecone = new PineconeService();
  await pinecone.initialize();

  // Crear processor con el chunkSize especificado
  const processor = new DocumentProcessor(chunkSize, chunkOverlap);
  
  console.log(`⚙️  Configuración de chunks:`);
  console.log(`   Tamaño: ${chunkSize} caracteres`);
  console.log(`   Overlap: ${chunkOverlap} caracteres\n`);

  // Paso 1: Eliminar versión anterior si existe
  if (deleteExisting) {
    console.log('🗑️  Eliminando versión anterior del documento...');
    try {
      const index = pinecone.pinecone.Index(pinecone.indexName);
      
      // Buscar vectores con este source
      const queryVector = new Array(1536).fill(0); // Vector dummy
      const existingResults = await index.query({
        vector: queryVector,
        topK: 10000,
        includeMetadata: true,
        filter: { source: filename }
      });

      if (existingResults.matches && existingResults.matches.length > 0) {
        const idsToDelete = existingResults.matches.map(match => match.id);
        console.log(`   Encontrados ${idsToDelete.length} vectores previos`);
        
        // Eliminar en batches de 100
        for (let i = 0; i < idsToDelete.length; i += 100) {
          const batch = idsToDelete.slice(i, i + 100);
          await index.deleteMany(batch);
        }
        
        console.log(`   ✅ ${idsToDelete.length} vectores eliminados\n`);
      } else {
        console.log('   ℹ️  No se encontraron versiones previas\n');
      }
    } catch (error) {
      console.log(`   ⚠️  No se pudo eliminar versión anterior: ${error.message}\n`);
    }
  }

  // Paso 2: Cargar documento
  console.log('📄 Cargando documento...');
  let docs;
  
  try {
    docs = await processor.loadDocument(docPath);
    console.log(`   ✅ Cargado: ${docs.length} sección(es)\n`);
  } catch (error) {
    console.error(`   ❌ Error al cargar: ${error.message}`);
    return;
  }

  // Paso 3: Dividir en chunks
  console.log('✂️  Dividiendo en chunks...');
  const chunks = await processor.textSplitter.splitDocuments(docs);
  console.log(`   ✅ ${chunks.length} chunks creados`);
  console.log(`   📏 Tamaño promedio: ${Math.round(chunks.reduce((sum, c) => sum + c.pageContent.length, 0) / chunks.length)} caracteres\n`);

  // Paso 4: Preparar metadata especial
  console.log('🏷️  Agregando metadata de protocolo...');
  
  const texts = chunks.map(chunk => chunk.pageContent);
  const metadatas = chunks.map((chunk, index) => ({
    ...chunk.metadata,
    source: filename,
    type: type,                    // Tipo: protocol, faq, curso, etc
    priority: priority,            // Prioridad: high, medium, low
    category: category,            // Categoría: contacto, cursos, procedimientos
    chunkIndex: index,
    totalChunks: chunks.length,
    uploadedAt: new Date().toISOString(),
    version: '1.0'
  }));

  console.log(`   ✅ Metadata configurada:`);
  console.log(`      - type: "${type}"`);
  console.log(`      - priority: "${priority}"`);
  console.log(`      - category: "${category}"\n`);

  // Paso 5: Subir a Pinecone
  console.log('📤 Subiendo a Pinecone...');
  try {
    await pinecone.addDocuments(texts, metadatas);
    console.log(`   ✅ ${chunks.length} chunks subidos exitosamente\n`);
  } catch (error) {
    console.error(`   ❌ Error al subir: ${error.message}`);
    return;
  }

  // Resumen final
  console.log('═'.repeat(80));
  console.log('✅ DOCUMENTO AGREGADO EXITOSAMENTE');
  console.log('═'.repeat(80));
  console.log(`📄 Archivo: ${filename}`);
  console.log(`📦 Chunks: ${chunks.length}`);
  console.log(`🏷️  Tipo: ${type} (priorizado con boost)`);
  console.log(`⭐ Prioridad: ${priority}`);
  console.log(`📁 Categoría: ${category}`);
  console.log('\n💡 El documento ya está disponible para consultas');
  console.log('═'.repeat(80) + '\n');
}

/**
 * Listar documentos de protocolo en el índice
 */
async function listProtocolDocuments() {
  console.log('\n' + '═'.repeat(80));
  console.log('📋 DOCUMENTOS DE PROTOCOLO EN EL ÍNDICE');
  console.log('═'.repeat(80) + '\n');

  const pinecone = new PineconeService();
  await pinecone.initialize();

  const index = pinecone.pinecone.Index(pinecone.indexName);
  
  // Query dummy para obtener documentos
  const queryVector = new Array(1536).fill(0);
  const results = await index.query({
    vector: queryVector,
    topK: 10000,
    includeMetadata: true
  });

  // Filtrar documentos de protocolo
  const protocolDocs = new Map();
  
  if (results.matches) {
    results.matches.forEach(match => {
      if (match.metadata?.type === 'protocol' || 
          match.metadata?.source?.toLowerCase().includes('protocol')) {
        const source = match.metadata.source;
        if (!protocolDocs.has(source)) {
          protocolDocs.set(source, {
            source,
            type: match.metadata.type,
            priority: match.metadata.priority,
            category: match.metadata.category,
            uploadedAt: match.metadata.uploadedAt,
            chunks: 0
          });
        }
        protocolDocs.get(source).chunks++;
      }
    });
  }

  if (protocolDocs.size === 0) {
    console.log('⚠️  No se encontraron documentos de protocolo\n');
    return;
  }

  console.log(`✅ Encontrados ${protocolDocs.size} documentos de protocolo:\n`);

  let index_num = 1;
  for (const [source, info] of protocolDocs) {
    console.log(`${index_num}. ${source}`);
    console.log(`   📦 Chunks: ${info.chunks}`);
    console.log(`   🏷️  Tipo: ${info.type || 'N/A'}`);
    console.log(`   ⭐ Prioridad: ${info.priority || 'N/A'}`);
    console.log(`   📁 Categoría: ${info.category || 'N/A'}`);
    console.log(`   📅 Subido: ${info.uploadedAt ? new Date(info.uploadedAt).toLocaleString() : 'N/A'}`);
    console.log('');
    index_num++;
  }

  console.log('═'.repeat(80) + '\n');
}

// CLI
const command = process.argv[2];
const filename = process.argv[3];

if (command === 'add' && filename) {
  // Opciones desde argumentos
  const options = {};
  
  for (let i = 4; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      if (value !== undefined) {
        // Convertir a número si es chunkSize o chunkOverlap
        if (key === 'chunkSize' || key === 'chunkOverlap') {
          options[key] = parseInt(value, 10);
        } else if (value === 'true' || value === 'false') {
          options[key] = value === 'true';
        } else {
          options[key] = value;
        }
      }
    }
  }
  
  addProtocolDocument(filename, options)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });

} else if (command === 'list') {
  listProtocolDocuments()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });

} else {
  console.log('\n📄 USO DEL SCRIPT:\n');
  console.log('Agregar documento:');
  console.log('  node scripts/add_protocol_document.js add <archivo> [opciones]\n');
  console.log('Opciones:');
  console.log('  --type=protocol          Tipo de documento (default: protocol)');
  console.log('  --priority=high          Prioridad: high, medium, low (default: high)');
  console.log('  --category=contacto      Categoría del contenido');
  console.log('  --chunkSize=1000         Tamaño de chunks (default: 1000)');
  console.log('  --deleteExisting=false   No eliminar versión anterior\n');
  console.log('Ejemplos:');
  console.log('  node scripts/add_protocol_document.js add protocolo-contacto-sedes.txt');
  console.log('  node scripts/add_protocol_document.js add protocolo.docx --category=atencion');
  console.log('  node scripts/add_protocol_document.js add nuevo-faq.txt --type=faq --priority=medium\n');
  console.log('Listar documentos de protocolo:');
  console.log('  node scripts/add_protocol_document.js list\n');
  process.exit(0);
}
