import fs from 'fs/promises';
import path from 'path';
import { PineconeService } from '../src/services/pinecone_service.js';
import { validateConfig } from '../src/config/env.js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../src/config/env.js';

/**
 * ESTRATEGIA A: UN CHUNK COMPLETO POR CURSO
 * 
 * Ventajas:
 * - Un curso = un resultado en búsqueda
 * - Sin duplicados
 * - Contexto completo
 * - Simple de entender y mantener
 */

const SCRAPED_DATA_DIR = './resultados_cec_epn';

/**
 * Crear UN SOLO documento completo por curso
 */
function createSingleChunkPerCourse(course, categoria) {
  // Construir documento con TODA la información
  const sections = [];

  // === SECCIÓN 1: INFORMACIÓN BÁSICA (SIEMPRE) ===
  sections.push(`=== CURSO DEL CEC-EPN ===`);
  sections.push(`TÍTULO: ${course.titulo}`);
  sections.push(`CATEGORÍA: ${categoria}`);
  sections.push(`URL: ${course.url}`);
  sections.push(``);

  // Información clave para búsqueda
  if (course.modalidad) {
    sections.push(`MODALIDAD: ${course.modalidad}`);
  }
  if (course.duracion) {
    sections.push(`DURACIÓN: ${course.duracion}`);
  }
  if (course.precio || course.costo) {
    sections.push(`PRECIO: ${course.precio || course.costo}`);
  }
  if (course.inicio) {
    sections.push(`FECHA DE INICIO: ${course.inicio}`);
  }
  if (course.finaliza) {
    sections.push(`FECHA DE FINALIZACIÓN: ${course.finaliza}`);
  }
  if (course.horario) {
    sections.push(`HORARIO: ${course.horario}`);
  }
  sections.push(``);

  // === SECCIÓN 2: DESCRIPCIÓN (SI EXISTE) ===
  if (course.descripcion_completa && course.descripcion_completa.length > 50) {
    sections.push(`=== DESCRIPCIÓN DEL CURSO ===`);
    sections.push(course.descripcion_completa);
    sections.push(``);
  }

  // === SECCIÓN 3: PERFIL Y REQUISITOS ===
  if (course.dirigido_a || course.requisitos) {
    sections.push(`=== PERFIL Y REQUISITOS ===`);
    
    if (course.dirigido_a) {
      sections.push(`DIRIGIDO A:`);
      sections.push(course.dirigido_a);
      sections.push(``);
    }

    if (course.requisitos) {
      sections.push(`REQUISITOS:`);
      sections.push(course.requisitos);
      sections.push(``);
    }
  }

  // === SECCIÓN 4: INSTRUCTOR ===
  if (course.instructor) {
    sections.push(`INSTRUCTOR: ${course.instructor}`);
    sections.push(``);
  }

  // === SECCIÓN 5: INFORMACIÓN ADMINISTRATIVA ===
  const adminInfo = [];
  
  if (course.matriculas) {
    adminInfo.push(`PERÍODO DE MATRÍCULAS: ${course.matriculas}`);
  }
  if (course.descuentos) {
    adminInfo.push(`DESCUENTOS DISPONIBLES: ${course.descuentos}`);
  }
  if (course.certificacion) {
    adminInfo.push(`CERTIFICACIÓN: ${course.certificacion}`);
  }
  if (course.contacto) {
    adminInfo.push(`CONTACTO: ${course.contacto}`);
  }
  if (course.nota) {
    adminInfo.push(`NOTA IMPORTANTE: ${course.nota}`);
  }

  if (adminInfo.length > 0) {
    sections.push(`=== INFORMACIÓN ADMINISTRATIVA ===`);
    sections.push(adminInfo.join('\n'));
    sections.push(``);
  }

  // === SECCIÓN 6: LLAMADO A LA ACCIÓN ===
  sections.push(`Para más información e inscripciones, visite: ${course.url}`);

  const pageContent = sections.join('\n');

  // Metadata RICA para filtros
  const metadata = {
    source: 'web_scraping_cec_epn',
    tipo: 'curso',
    categoria: categoria,
    titulo: course.titulo,
    modalidad: course.modalidad || 'No especificada',
    duracion: course.duracion || 'Consultar',
    precio_raw: course.precio || course.costo || 'Consultar',
    url: course.url,
    inicio: course.inicio || null,
    instructor: course.instructor || null,
    tiene_descripcion: !!(course.descripcion_completa && course.descripcion_completa.length > 50),
    tiene_requisitos: !!course.requisitos,
    tiene_descuentos: !!course.descuentos,
    fecha_scraping: new Date().toISOString(),
  };

  // Extraer precio numérico para filtros
  if (course.precio || course.costo) {
    const priceStr = course.precio || course.costo;
    const priceMatch = priceStr.match(/\d+/);
    if (priceMatch) {
      metadata.precio_numerico = parseInt(priceMatch[0]);
    }
  }

  return { pageContent, metadata };
}

/**
 * Procesar una categoría completa
 */
async function processCategory(categoria) {
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

    const documents = courses.map(course => 
      createSingleChunkPerCourse(course, categoria)
    );

    console.log(`   ✅ Generados ${documents.length} documentos (1 por curso)`);
    return documents;
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

  let uploaded = 0;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    try {
      console.log(
        `   📦 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          documents.length / batchSize
        )} (${batch.length} docs)...`
      );

      await pineconeService.vectorStore.addDocuments(batch);

      uploaded += batch.length;
      console.log(`   ✅ Subidos ${uploaded}/${documents.length} documentos`);

      // Pausa entre batches
      if (i + batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`   ❌ Error en batch:`, error.message);
    }
  }

  console.log(`\n✅ Proceso completado: ${uploaded} documentos subidos`);
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Procesamiento de cursos CEC-EPN - ESTRATEGIA: 1 CHUNK POR CURSO\n');

  validateConfig();

  // Leer categorías
  const categoriasPath = path.join(SCRAPED_DATA_DIR, 'categorias.json');
  const categoriasData = await fs.readFile(categoriasPath, 'utf-8');
  const categorias = JSON.parse(categoriasData);

  console.log(`📊 Categorías a procesar: ${categorias.length}`);

  // Procesar todas las categorías
  const allDocuments = [];
  for (const cat of categorias) {
    const docs = await processCategory(cat.slug);
    allDocuments.push(...docs);
  }

  console.log(`\n📊 RESUMEN:`);
  console.log(`   Total de documentos: ${allDocuments.length}`);
  console.log(`   Ratio: 1 documento = 1 curso (sin fragmentación)`);

  // Preview o upload
  if (process.argv.includes('--upload')) {
    await uploadToPinecone(allDocuments);

    // Métricas
    const metricsPath = './scraping_upload_metrics_single_chunk.json';
    await fs.writeFile(
      metricsPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          strategy: 'single_chunk_per_course',
          totalDocuments: allDocuments.length,
          totalCourses: allDocuments.length,
          chunksPerCourse: 1,
        },
        null,
        2
      )
    );
    console.log(`\n📊 Métricas exportadas a: ${metricsPath}`);
  } else {
    // Preview
    console.log(`\n📄 PREVIEW de los primeros 2 cursos:\n`);
    for (let i = 0; i < Math.min(2, allDocuments.length); i++) {
      const doc = allDocuments[i];
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Curso ${i + 1}: ${doc.metadata.titulo}`);
      console.log(`${'='.repeat(70)}`);
      console.log(`Metadata:`, JSON.stringify(doc.metadata, null, 2));
      console.log(`\nContenido (primeros 500 chars):`);
      console.log(doc.pageContent.substring(0, 500));
      console.log(`\n[... contenido total: ${doc.pageContent.length} caracteres]`);
    }

    console.log(`\n✅ Para subir a Pinecone, ejecuta:`);
    console.log(`   node scripts/process_scraped_courses_SINGLE_CHUNK.js --upload`);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
