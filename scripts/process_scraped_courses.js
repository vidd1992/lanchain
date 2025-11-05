import fs from 'fs/promises';
import path from 'path';
import { PineconeService } from '../src/services/pinecone_service.js';
import { validateConfig } from '../src/config/env.js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../src/config/env.js';

/**
 * Script para procesar cursos scrapeados del CEC-EPN
 * y subirlos a Pinecone de forma optimizada
 */

const SCRAPED_DATA_DIR = './resultados_cec_epn';

/**
 * Formatear un curso para crear documento optimizado para RAG
 */
function formatCourseAsDocument(course, categoria) {
  // Crear texto optimizado para búsqueda semántica
  const sections = [];

  // Título y categoría (peso alto en búsqueda)
  sections.push(`CURSO: ${course.titulo}`);
  sections.push(`CATEGORÍA: ${categoria}`);

  // Información básica
  if (course.modalidad) sections.push(`MODALIDAD: ${course.modalidad}`);
  if (course.duracion) sections.push(`DURACIÓN: ${course.duracion}`);
  if (course.precio || course.costo) {
    sections.push(`PRECIO: ${course.precio || course.costo}`);
  }
  if (course.inicio) sections.push(`FECHA DE INICIO: ${course.inicio}`);
  if (course.horario) sections.push(`HORARIO: ${course.horario}`);

  // Descripción completa (contenido principal)
  if (course.descripcion_completa) {
    sections.push(`\nDESCRIPCIÓN:\n${course.descripcion_completa}`);
  }

  // Información adicional
  if (course.instructor) sections.push(`\nINSTRUCTOR: ${course.instructor}`);
  if (course.dirigido_a) sections.push(`\nDIRIGIDO A: ${course.dirigido_a}`);
  if (course.requisitos) sections.push(`\nREQUISITOS: ${course.requisitos}`);
  if (course.descuentos) sections.push(`\nDESCUENTOS: ${course.descuentos}`);
  if (course.certificacion) sections.push(`\nCERTIFICACIÓN: ${course.certificacion}`);
  if (course.finaliza) sections.push(`\nFECHA DE FINALIZACIÓN: ${course.finaliza}`);
  if (course.matriculas) sections.push(`\nPERÍODO DE MATRÍCULAS: ${course.matriculas}`);
  if (course.contacto) sections.push(`\nCONTACTO: ${course.contacto}`);
  if (course.nota) sections.push(`\nNOTA IMPORTANTE: ${course.nota}`);

  const pageContent = sections.join('\n');

  // Metadata rica para filtros y contexto
  const metadata = {
    source: 'web_scraping_cec_epn',
    tipo: 'curso',
    categoria: categoria,
    titulo: course.titulo,
    modalidad: course.modalidad || 'No especificada',
    duracion: course.duracion || 'No especificada',
    precio: course.precio || course.costo || 'Consultar',
    url: course.url,
    inicio: course.inicio || null,
    instructor: course.instructor || null,
    fecha_scraping: new Date().toISOString(),
  };

  return { pageContent, metadata };
}

/**
 * Crear chunks optimizados para cada curso
 * En lugar de dividir arbitrariamente, creamos chunks temáticos
 */
function createCourseChunks(course, categoria) {
  const chunks = [];

  // Chunk 1: Información general (siempre presente)
  const generalInfo = {
    pageContent: `CURSO: ${course.titulo}
CATEGORÍA: ${categoria}
MODALIDAD: ${course.modalidad || 'No especificada'}
DURACIÓN: ${course.duracion || 'No especificada'}
PRECIO: ${course.precio || course.costo || 'Consultar'}
INICIO: ${course.inicio || 'Por definir'}
HORARIO: ${course.horario || 'Consultar'}
URL: ${course.url}`,
    metadata: {
      source: 'web_scraping_cec_epn',
      tipo: 'curso',
      categoria: categoria,
      titulo: course.titulo,
      modalidad: course.modalidad || 'No especificada',
      precio: course.precio || course.costo || 'Consultar',
      url: course.url,
      chunkType: 'informacion_general',
    },
  };
  chunks.push(generalInfo);

  // Chunk 2: Descripción del curso (si existe)
  if (course.descripcion_completa && course.descripcion_completa.length > 50) {
    const descripcionChunk = {
      pageContent: `CURSO: ${course.titulo}
CATEGORÍA: ${categoria}

DESCRIPCIÓN DEL CURSO:
${course.descripcion_completa}`,
      metadata: {
        source: 'web_scraping_cec_epn',
        tipo: 'curso',
        categoria: categoria,
        titulo: course.titulo,
        url: course.url,
        chunkType: 'descripcion',
      },
    };
    chunks.push(descripcionChunk);
  }

  // Chunk 3: Requisitos y dirigido a (si existe)
  if (course.requisitos || course.dirigido_a) {
    const requisitosChunk = {
      pageContent: `CURSO: ${course.titulo}
CATEGORÍA: ${categoria}

${course.dirigido_a ? `DIRIGIDO A:\n${course.dirigido_a}\n\n` : ''}${
        course.requisitos ? `REQUISITOS:\n${course.requisitos}` : ''
      }`,
      metadata: {
        source: 'web_scraping_cec_epn',
        tipo: 'curso',
        categoria: categoria,
        titulo: course.titulo,
        url: course.url,
        chunkType: 'requisitos',
      },
    };
    chunks.push(requisitosChunk);
  }

  // Chunk 4: Información administrativa (si existe)
  if (
    course.descuentos ||
    course.certificacion ||
    course.matriculas ||
    course.contacto ||
    course.nota
  ) {
    const adminInfo = {
      pageContent: `CURSO: ${course.titulo}
CATEGORÍA: ${categoria}

${course.descuentos ? `DESCUENTOS:\n${course.descuentos}\n\n` : ''}${
        course.certificacion ? `CERTIFICACIÓN:\n${course.certificacion}\n\n` : ''
      }${course.matriculas ? `PERÍODO DE MATRÍCULAS:\n${course.matriculas}\n\n` : ''}${
        course.contacto ? `CONTACTO:\n${course.contacto}\n\n` : ''
      }${course.nota ? `NOTA IMPORTANTE:\n${course.nota}` : ''}`,
      metadata: {
        source: 'web_scraping_cec_epn',
        tipo: 'curso',
        categoria: categoria,
        titulo: course.titulo,
        url: course.url,
        chunkType: 'informacion_administrativa',
      },
    };
    chunks.push(adminInfo);
  }

  return chunks;
}

/**
 * Procesar una categoría completa
 */
async function processCategory(categoria, useChunking = true) {
  console.log(`\n📁 Procesando categoría: ${categoria}`);

  const detailedFilePath = path.join(
    SCRAPED_DATA_DIR,
    categoria,
    'cursos_detallados.json'
  );

  try {
    const data = await fs.readFile(detailedFilePath, 'utf-8');
    const courses = JSON.parse(data);

    console.log(`   📚 Encontrados ${courses.length} cursos`);

    const allDocuments = [];

    for (const course of courses) {
      if (useChunking) {
        // Estrategia de chunks temáticos
        const chunks = createCourseChunks(course, categoria);
        allDocuments.push(...chunks);
      } else {
        // Estrategia de documento único por curso
        const doc = formatCourseAsDocument(course, categoria);
        allDocuments.push(doc);
      }
    }

    console.log(
      `   ✅ Generados ${allDocuments.length} documentos para indexar`
    );
    return allDocuments;
  } catch (error) {
    console.error(`   ❌ Error procesando ${categoria}:`, error.message);
    return [];
  }
}

/**
 * Subir documentos a Pinecone en batches
 */
async function uploadToPinecone(documents, batchSize = 50) {
  console.log(`\n📤 Subiendo ${documents.length} documentos a Pinecone...`);

  const pineconeService = new PineconeService();
  await pineconeService.initialize();

  // Generar embeddings y subir en batches
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openai.apiKey,
    modelName: 'text-embedding-3-small',
  });

  let uploaded = 0;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    try {
      console.log(
        `   📦 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          documents.length / batchSize
        )} (${batch.length} docs)...`
      );

      // Usar el vectorStore de Pinecone para agregar documentos
      await pineconeService.vectorStore.addDocuments(batch);

      uploaded += batch.length;
      console.log(`   ✅ Subidos ${uploaded}/${documents.length} documentos`);

      // Pequeña pausa entre batches para no saturar la API
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`   ❌ Error en batch ${i / batchSize + 1}:`, error.message);
    }
  }

  console.log(`\n✅ Proceso completado: ${uploaded} documentos subidos`);
}

/**
 * Main: Procesar todas las categorías
 */
async function main() {
  console.log('🚀 Iniciando procesamiento de cursos scrapeados del CEC-EPN\n');

  // Validar configuración
  validateConfig();

  // Leer resumen para obtener categorías
  const resumenPath = path.join(SCRAPED_DATA_DIR, 'resumen.json');
  const resumenData = await fs.readFile(resumenPath, 'utf-8');
  const resumen = JSON.parse(resumenData);

  console.log(`📊 Total de cursos en fuente: ${resumen.total_cursos}`);
  console.log(`📁 Categorías a procesar: ${resumen.por_categoria.length}\n`);

  // Leer categorías desde categorias.json
  const categoriasPath = path.join(SCRAPED_DATA_DIR, 'categorias.json');
  const categoriasData = await fs.readFile(categoriasPath, 'utf-8');
  const categorias = JSON.parse(categoriasData);

  // Procesar cada categoría
  const allDocuments = [];

  for (const cat of categorias) {
    const docs = await processCategory(cat.slug, true); // useChunking = true
    allDocuments.push(...docs);
  }

  console.log(`\n📊 RESUMEN:`);
  console.log(`   Total de documentos generados: ${allDocuments.length}`);

  // Preguntar si desea subir a Pinecone
  console.log(
    `\n⚠️  ¿Deseas subir estos documentos a Pinecone? (esto reemplazará los datos actuales)`
  );
  console.log(
    `   Para confirmar, ejecuta: node scripts/process_scraped_courses.js --upload`
  );

  // Si se pasa el flag --upload, subir a Pinecone
  if (process.argv.includes('--upload')) {
    await uploadToPinecone(allDocuments);

    // Exportar métricas
    const metricsPath = path.join('./', 'scraping_upload_metrics.json');
    await fs.writeFile(
      metricsPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          totalDocuments: allDocuments.length,
          totalCourses: resumen.total_cursos,
          categoriesProcessed: categorias.length,
          strategy: 'chunked_by_theme',
        },
        null,
        2
      )
    );
    console.log(`\n📊 Métricas exportadas a: ${metricsPath}`);
  } else {
    // Solo mostrar preview
    console.log(`\n📄 PREVIEW de los primeros 3 documentos:\n`);
    for (let i = 0; i < Math.min(3, allDocuments.length); i++) {
      const doc = allDocuments[i];
      console.log(`\n--- Documento ${i + 1} ---`);
      console.log(`Metadata:`, JSON.stringify(doc.metadata, null, 2));
      console.log(`Contenido (primeros 300 chars):`);
      console.log(doc.pageContent.substring(0, 300) + '...\n');
    }

    console.log(
      `\n✅ Para subir a Pinecone, ejecuta:\n   node scripts/process_scraped_courses.js --upload`
    );
  }
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
