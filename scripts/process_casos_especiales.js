import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PineconeService } from '../src/services/pinecone_service.js';
import { DocumentProcessor } from '../src/utils/document_processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CASOS_ESPECIALES_DIR = path.join(__dirname, '../documents/casos-especiales');
const STATE_FILE = path.join(__dirname, '../documents/casos-especiales/.state.json');

/**
 * Leer el archivo de estados guardado
 */
async function readStateFile() {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Si no existe, retornar objeto vacío
    return {};
  }
}

/**
 * Guardar el archivo de estados
 */
async function writeStateFile(states) {
  await fs.writeFile(STATE_FILE, JSON.stringify(states, null, 2));
}

/**
 * Extraer el estado de un archivo (primera línea con # ESTADO:)
 */
function extractState(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ESTADO:')) {
      return line.replace('# ESTADO:', '').trim();
    }
  }
  return null;
}

/**
 * Extraer metadata del archivo
 */
function extractMetadata(content, filename) {
  const metadata = {
    source: `caso-especial-${filename}`,
    tipo: 'caso-especial',
    estado: null,
    fecha_actualizacion: null,
    descripcion: null,
  };

  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ESTADO:')) {
      metadata.estado = line.replace('# ESTADO:', '').trim();
    } else if (line.startsWith('# FECHA_ACTUALIZACION:')) {
      metadata.fecha_actualizacion = line.replace('# FECHA_ACTUALIZACION:', '').trim();
    } else if (line.startsWith('# DESCRIPCION:')) {
      metadata.descripcion = line.replace('# DESCRIPCION:', '').trim();
    }
  }

  return metadata;
}

/**
 * Procesar casos especiales y subirlos a Pinecone
 */
async function processCasosEspeciales() {
  console.log('🔍 Procesando casos especiales...\n');

  const pineconeService = new PineconeService();
  await pineconeService.initialize();

  const documentProcessor = new DocumentProcessor();

  // Leer estado actual
  const currentStates = await readStateFile();
  const newStates = {};

  // Leer todos los archivos .txt en la carpeta
  const files = await fs.readdir(CASOS_ESPECIALES_DIR);
  const txtFiles = files.filter(f => f.endsWith('.txt'));

  console.log(`📁 Encontrados ${txtFiles.length} archivos de casos especiales\n`);

  for (const file of txtFiles) {
    const filePath = path.join(CASOS_ESPECIALES_DIR, file);
    const filename = path.basename(file, '.txt');

    console.log(`📄 Procesando: ${file}`);

    // Leer contenido
    const content = await fs.readFile(filePath, 'utf-8');

    // Extraer estado actual
    const fileState = extractState(content);
    if (!fileState) {
      console.log(`⚠️  No se encontró ESTADO en ${file}, saltando...`);
      continue;
    }

    // Verificar si cambió el estado
    const previousState = currentStates[file];
    if (previousState === fileState) {
      console.log(`✓ Estado sin cambios (${fileState}), saltando...`);
      newStates[file] = fileState;
      continue;
    }

    console.log(`🔄 Cambio detectado: ${previousState || 'NUEVO'} → ${fileState}`);

    // Extraer metadata
    const metadata = extractMetadata(content, filename);

    console.log(`📊 Metadata:`, metadata);

    // Si hay estado anterior, eliminar documentos antiguos de este caso especial
    if (previousState) {
      console.log(`🗑️  Eliminando versión anterior del índice...`);
      // TODO: Implementar eliminación por metadata en Pinecone
      // Por ahora, los documentos nuevos simplemente se agregarán
    }

    // Para casos especiales, NO dividir en chunks - subir documento completo
    // Esto asegura que toda la información relacionada esté junta
    console.log(`📄 Subiendo documento completo (sin dividir)`);

    const timestamp = new Date().toISOString();
    const texts = [content]; // Documento completo
    const metadatas = [
      {
        ...metadata,
        chunkIndex: 0,
        originalFile: file,
        timestamp: timestamp,
        uploadDate: timestamp,
        totalChunks: 1,
        isComplete: true, // Marca que es documento completo
      },
    ];

    await pineconeService.addDocuments(texts, metadatas);
    console.log(`✅ Subido a Pinecone: ${file}`);

    // Guardar nuevo estado
    newStates[file] = fileState;
    console.log('');
  }

  // Guardar estados actualizados
  await writeStateFile(newStates);

  console.log('✅ Procesamiento completado\n');
  console.log('📋 Resumen:');
  console.log(`   Total archivos: ${txtFiles.length}`);
  console.log(`   Procesados: ${Object.keys(newStates).length}`);
  console.log(
    `   Actualizados: ${
      Object.keys(newStates).filter(k => currentStates[k] !== newStates[k]).length
    }`
  );
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  processCasosEspeciales()
    .then(() => {
      console.log('\n🎉 Proceso finalizado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

export { processCasosEspeciales };
