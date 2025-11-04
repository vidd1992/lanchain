/**
 * Script de prueba del formateador de respuestas HTML
 */

import { ResponseFormatter } from '../src/utils/response_formatter.js';

// Texto de ejemplo similar a las respuestas de Perplexity
const ejemploRespuesta = `¡Gracias por tu interés! Aquí tienes la información actualizada sobre los cursos de Android en el CEC-EPN:

## Cursos de Android en el CEC-EPN

El CEC-EPN ofrece cursos de **Android Básico** y **Android Avanzado**, ambos en modalidad presencial[5][8]. Estos cursos están diseñados para quienes desean aprender a desarrollar aplicaciones móviles para dispositivos Android, desde los fundamentos hasta temas más avanzados.

**Características principales:**

- **Modalidad:** Presencial (se ofertan bajo pedido para grupos o instituciones públicas/privadas)[3][5][8].
- **Duración:** Variable según el nivel y las necesidades del grupo.
- **Contenido:** Desde conceptos básicos de programación Android hasta desarrollo de aplicaciones complejas.

### ¿Por qué elegir estos cursos?

- Docentes especializados en desarrollo móvil
- Prácticas con proyectos reales
- Certificación del CEC-EPN

Si estás interesado en estos cursos, te recomiendo contactar directamente al CEC-EPN para consultar sobre próximas convocatorias o para solicitar un curso personalizado para tu grupo o institución.`;

console.log('🧪 Prueba del Formateador de Respuestas HTML');
console.log('═'.repeat(80));

// Prueba 1: Sin formateo (Markdown original)
console.log('\n📝 PRUEBA 1: Sin formateo (ENABLE_HTML_FORMATTING=false)');
console.log('─'.repeat(80));
const formatter1 = new ResponseFormatter(false);
const sinFormato = formatter1.format(ejemploRespuesta);
console.log(sinFormato);

console.log('\n\n' + '═'.repeat(80));

// Prueba 2: Con formateo HTML
console.log('\n✨ PRUEBA 2: Con formateo HTML (ENABLE_HTML_FORMATTING=true)');
console.log('─'.repeat(80));
const formatter2 = new ResponseFormatter(true);
const conFormato = formatter2.formatSafe(ejemploRespuesta);
console.log(conFormato);

console.log('\n\n' + '═'.repeat(80));

// Prueba 3: Comparación de longitud
console.log('\n📊 ESTADÍSTICAS:');
console.log('─'.repeat(80));
console.log(`Texto original:    ${ejemploRespuesta.length} caracteres`);
console.log(`Sin formateo:      ${sinFormato.length} caracteres`);
console.log(`Con formato HTML:  ${conFormato.length} caracteres`);
console.log(
  `Citaciones eliminadas: ${(ejemploRespuesta.match(/\[\d+\]/g) || []).length}`
);

// Prueba 4: Validación HTML
console.log('\n✅ VALIDACIÓN:');
console.log('─'.repeat(80));
const isValid = formatter2.isValidHtml(conFormato);
console.log(`HTML válido: ${isValid ? '✅ Sí' : '❌ No'}`);

// Prueba 5: Mostrar características detectadas
console.log('\n🔍 TRANSFORMACIONES APLICADAS:');
console.log('─'.repeat(80));
console.log(`- Títulos H2 (##):     ${(conFormato.match(/<h2/g) || []).length}`);
console.log(`- Títulos H3 (###):    ${(conFormato.match(/<h3/g) || []).length}`);
console.log(`- Textos en negrita:   ${(conFormato.match(/<strong>/g) || []).length}`);
console.log(`- Listas:              ${(conFormato.match(/<ul/g) || []).length}`);
console.log(`- Items de lista:      ${(conFormato.match(/<li>/g) || []).length}`);
console.log(`- Párrafos:            ${(conFormato.match(/<p>/g) || []).length}`);

console.log('\n' + '═'.repeat(80));
console.log('✅ Pruebas completadas\n');

// Ejemplo de cómo se vería renderizado (simulado)
console.log('\n🌐 VISTA PREVIA (Renderizado simulado):');
console.log('─'.repeat(80));
console.log('');
console.log('¡Gracias por tu interés! Aquí tienes la información actualizada sobre');
console.log('los cursos de Android en el CEC-EPN:');
console.log('');
console.log('═══════════════════════════════════════');
console.log('   Cursos de Android en el CEC-EPN    ');
console.log('═══════════════════════════════════════');
console.log('');
console.log('El CEC-EPN ofrece cursos de Android Básico y Android Avanzado, ambos');
console.log('en modalidad presencial. Estos cursos están diseñados para quienes desean');
console.log('aprender a desarrollar aplicaciones móviles para dispositivos Android,');
console.log('desde los fundamentos hasta temas más avanzados.');
console.log('');
console.log('Características principales:');
console.log('');
console.log('  • Modalidad: Presencial (se ofertan bajo pedido para grupos o');
console.log('    instituciones públicas/privadas).');
console.log('  • Duración: Variable según el nivel y las necesidades del grupo.');
console.log('  • Contenido: Desde conceptos básicos de programación Android hasta');
console.log('    desarrollo de aplicaciones complejas.');
console.log('');
console.log('───────────────────────────────────────');
console.log('      ¿Por qué elegir estos cursos?    ');
console.log('───────────────────────────────────────');
console.log('');
console.log('  • Docentes especializados en desarrollo móvil');
console.log('  • Prácticas con proyectos reales');
console.log('  • Certificación del CEC-EPN');
console.log('');
console.log('═'.repeat(80));
console.log('\n💡 Nota: Las citaciones [1][2][3] se eliminan automáticamente\n');
