import fs from 'fs/promises';
import path from 'path';

/**
 * Script para analizar los datos scrapeados del CEC-EPN
 * Genera estadísticas, detecta problemas y valida la calidad de los datos
 */

const SCRAPED_DATA_DIR = './resultados_cec_epn';

/**
 * Analizar una categoría de cursos
 */
async function analyzeCategory(categoria) {
  const detailedFilePath = path.join(
    SCRAPED_DATA_DIR,
    categoria,
    'cursos_detallados.json'
  );

  try {
    const data = await fs.readFile(detailedFilePath, 'utf-8');
    const courses = JSON.parse(data);

    const stats = {
      categoria: categoria,
      total: courses.length,
      conDescripcion: 0,
      conHorario: 0,
      conPrecio: 0,
      conInstructor: 0,
      conRequisitos: 0,
      conDescuentos: 0,
      modalidades: {},
      rangoPrecios: {
        min: Infinity,
        max: -Infinity,
        valores: [],
      },
      ejemplos: [],
    };

    // Analizar cada curso
    for (const course of courses) {
      if (course.descripcion_completa && course.descripcion_completa.length > 50) {
        stats.conDescripcion++;
      }
      if (course.horario) stats.conHorario++;
      if (course.precio || course.costo) {
        stats.conPrecio++;
        // Extraer valor numérico del precio
        const priceStr = course.precio || course.costo;
        const priceMatch = priceStr.match(/\d+/);
        if (priceMatch) {
          const price = parseInt(priceMatch[0]);
          stats.rangoPrecios.valores.push(price);
          stats.rangoPrecios.min = Math.min(stats.rangoPrecios.min, price);
          stats.rangoPrecios.max = Math.max(stats.rangoPrecios.max, price);
        }
      }
      if (course.instructor) stats.conInstructor++;
      if (course.requisitos) stats.conRequisitos++;
      if (course.descuentos) stats.conDescuentos++;

      // Modalidades
      if (course.modalidad) {
        stats.modalidades[course.modalidad] =
          (stats.modalidades[course.modalidad] || 0) + 1;
      }

      // Guardar algunos ejemplos
      if (stats.ejemplos.length < 2) {
        stats.ejemplos.push({
          titulo: course.titulo,
          modalidad: course.modalidad,
          precio: course.precio || course.costo,
          tieneDescripcion: !!course.descripcion_completa,
        });
      }
    }

    // Calcular promedio de precios
    if (stats.rangoPrecios.valores.length > 0) {
      const sum = stats.rangoPrecios.valores.reduce((a, b) => a + b, 0);
      stats.rangoPrecios.promedio = Math.round(
        sum / stats.rangoPrecios.valores.length
      );
    }

    return stats;
  } catch (error) {
    console.error(`❌ Error analizando ${categoria}:`, error.message);
    return null;
  }
}

/**
 * Calcular calidad de los datos (0-100)
 */
function calculateDataQuality(stats) {
  const weights = {
    descripcion: 30,
    horario: 15,
    precio: 20,
    instructor: 15,
    requisitos: 10,
    descuentos: 10,
  };

  let score = 0;
  score += (stats.conDescripcion / stats.total) * weights.descripcion;
  score += (stats.conHorario / stats.total) * weights.horario;
  score += (stats.conPrecio / stats.total) * weights.precio;
  score += (stats.conInstructor / stats.total) * weights.instructor;
  score += (stats.conRequisitos / stats.total) * weights.requisitos;
  score += (stats.conDescuentos / stats.total) * weights.descuentos;

  return Math.round(score);
}

/**
 * Generar reporte visual
 */
function printCategoryReport(stats) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📁 CATEGORÍA: ${stats.categoria.toUpperCase()}`);
  console.log(`${'='.repeat(70)}`);

  console.log(`\n📊 COMPLETITUD DE DATOS:`);
  console.log(`   Total de cursos: ${stats.total}`);
  console.log(
    `   Con descripción completa: ${stats.conDescripcion} (${Math.round(
      (stats.conDescripcion / stats.total) * 100
    )}%)`
  );
  console.log(
    `   Con horario: ${stats.conHorario} (${Math.round(
      (stats.conHorario / stats.total) * 100
    )}%)`
  );
  console.log(
    `   Con precio: ${stats.conPrecio} (${Math.round(
      (stats.conPrecio / stats.total) * 100
    )}%)`
  );
  console.log(
    `   Con instructor: ${stats.conInstructor} (${Math.round(
      (stats.conInstructor / stats.total) * 100
    )}%)`
  );
  console.log(
    `   Con requisitos: ${stats.conRequisitos} (${Math.round(
      (stats.conRequisitos / stats.total) * 100
    )}%)`
  );

  console.log(`\n💰 ANÁLISIS DE PRECIOS:`);
  if (stats.rangoPrecios.valores.length > 0) {
    console.log(`   Precio mínimo: USD $${stats.rangoPrecios.min}`);
    console.log(`   Precio máximo: USD $${stats.rangoPrecios.max}`);
    console.log(`   Precio promedio: USD $${stats.rangoPrecios.promedio}`);
  } else {
    console.log(`   No hay datos de precios disponibles`);
  }

  console.log(`\n📌 MODALIDADES:`);
  for (const [modalidad, count] of Object.entries(stats.modalidades)) {
    console.log(`   ${modalidad}: ${count} cursos`);
  }

  const quality = calculateDataQuality(stats);
  const qualityEmoji =
    quality >= 80 ? '🟢' : quality >= 60 ? '🟡' : quality >= 40 ? '🟠' : '🔴';
  console.log(`\n${qualityEmoji} CALIDAD DE DATOS: ${quality}/100`);

  console.log(`\n📄 EJEMPLOS:`);
  for (const ejemplo of stats.ejemplos) {
    console.log(`   • ${ejemplo.titulo}`);
    console.log(`     Modalidad: ${ejemplo.modalidad || 'N/A'}`);
    console.log(`     Precio: ${ejemplo.precio || 'N/A'}`);
    console.log(
      `     Descripción: ${ejemplo.tieneDescripcion ? '✅' : '❌'}`
    );
  }
}

/**
 * Main: Analizar todas las categorías
 */
async function main() {
  console.log('🔍 ANÁLISIS DE DATOS SCRAPEADOS DEL CEC-EPN\n');

  // Leer resumen
  const resumenPath = path.join(SCRAPED_DATA_DIR, 'resumen.json');
  const resumenData = await fs.readFile(resumenPath, 'utf-8');
  const resumen = JSON.parse(resumenData);

  console.log(`📊 RESUMEN GENERAL:`);
  console.log(`   Total de cursos: ${resumen.total_cursos}`);
  console.log(`   Categorías: ${resumen.por_categoria.length}\n`);

  // Leer categorías
  const categoriasPath = path.join(SCRAPED_DATA_DIR, 'categorias.json');
  const categoriasData = await fs.readFile(categoriasPath, 'utf-8');
  const categorias = JSON.parse(categoriasData);

  // Analizar cada categoría
  const allStats = [];
  for (const cat of categorias) {
    const stats = await analyzeCategory(cat.slug);
    if (stats) {
      printCategoryReport(stats);
      allStats.push(stats);
    }
  }

  // Resumen global
  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`📊 RESUMEN GLOBAL DE CALIDAD DE DATOS`);
  console.log(`${'='.repeat(70)}\n`);

  const totalCourses = allStats.reduce((sum, s) => sum + s.total, 0);
  const totalConDescripcion = allStats.reduce(
    (sum, s) => sum + s.conDescripcion,
    0
  );
  const totalConPrecio = allStats.reduce((sum, s) => sum + s.conPrecio, 0);
  const totalConInstructor = allStats.reduce(
    (sum, s) => sum + s.conInstructor,
    0
  );

  console.log(`📈 COMPLETITUD GLOBAL:`);
  console.log(
    `   Cursos con descripción: ${totalConDescripcion}/${totalCourses} (${Math.round(
      (totalConDescripcion / totalCourses) * 100
    )}%)`
  );
  console.log(
    `   Cursos con precio: ${totalConPrecio}/${totalCourses} (${Math.round(
      (totalConPrecio / totalCourses) * 100
    )}%)`
  );
  console.log(
    `   Cursos con instructor: ${totalConInstructor}/${totalCourses} (${Math.round(
      (totalConInstructor / totalCourses) * 100
    )}%)`
  );

  // Calcular calidad promedio
  const avgQuality = Math.round(
    allStats.reduce((sum, s) => sum + calculateDataQuality(s), 0) /
      allStats.length
  );

  const qualityEmoji =
    avgQuality >= 80
      ? '🟢'
      : avgQuality >= 60
      ? '🟡'
      : avgQuality >= 40
      ? '🟠'
      : '🔴';
  console.log(`\n${qualityEmoji} CALIDAD PROMEDIO: ${avgQuality}/100`);

  // Recomendaciones
  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`💡 RECOMENDACIONES`);
  console.log(`${'='.repeat(70)}\n`);

  if (avgQuality >= 70) {
    console.log(`✅ La calidad de los datos es BUENA`);
    console.log(
      `   Los cursos tienen suficiente información para indexar en Pinecone.`
    );
    console.log(`   Recomendación: Proceder con la indexación.`);
  } else if (avgQuality >= 50) {
    console.log(`⚠️  La calidad de los datos es ACEPTABLE`);
    console.log(
      `   Algunos cursos tienen información incompleta pero son usables.`
    );
    console.log(`   Recomendación: Revisar cursos con datos faltantes.`);
  } else {
    console.log(`❌ La calidad de los datos es BAJA`);
    console.log(
      `   Muchos cursos tienen información incompleta o faltante.`
    );
    console.log(
      `   Recomendación: Mejorar el scraping o complementar datos manualmente.`
    );
  }

  console.log(`\n📝 SIGUIENTE PASO:`);
  console.log(`   Para procesar e indexar estos datos en Pinecone, ejecuta:`);
  console.log(`   npm run process-scraped    # Ver preview de documentos`);
  console.log(`   npm run upload-scraped     # Subir a Pinecone\n`);

  // Exportar reporte JSON
  const reportPath = './scraping_analysis_report.json';
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalCourses: totalCourses,
        categoriesAnalyzed: allStats.length,
        globalQuality: avgQuality,
        categoryStats: allStats,
      },
      null,
      2
    )
  );
  console.log(`📄 Reporte detallado exportado a: ${reportPath}\n`);
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
