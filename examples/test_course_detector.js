import { CourseTypeDetector } from '../src/utils/course_type_detector.js';

console.log('🧪 Probando detector de tipo de curso\n');
console.log('='.repeat(70));

// Ejemplo 1: Curso BAJO DEMANDA (Android Avanzado)
const onDemandExample = `
Android Avanzado
Modalidad: Presencial
Duración: 32 horas
Inicio: Este curso se oferta bajo pedido, para grupos e instituciones públicas o privadas
Requisitos: Conocimientos en Java Básico y Android Básico
Contacto: ventas@cec-epn.edu.ec
`;

console.log('\n1️⃣  CURSO BAJO DEMANDA (Android Avanzado):\n');
const result1 = CourseTypeDetector.detectCourseType(onDemandExample);
console.log('Resultado:', JSON.stringify(result1, null, 2));
console.log('\nMensaje formateado:');
console.log(
  CourseTypeDetector.formatCourseResponse('Android Avanzado', result1.type, {})
);

console.log('\n' + '='.repeat(70));

// Ejemplo 2: Curso PROGRAMADO (Excel 2)
const scheduledExample = `
Excel 2: Funciones y Análisis de Datos
Costo: USD $79.00
Modalidad: Presencial
Duración: 24 horas
Inicio: 8 noviembre, 2025
Finaliza: 22 noviembre, 2025
Matrículas: 29 septiembre, 2025 - 5 noviembre, 2025
Horario: Sábados de 08:00 a 14:00 - (clases presenciales)
Instructor: Ing. Eduardo Patricio Rosero Vaca, MSc.
`;

console.log('\n2️⃣  CURSO PROGRAMADO (Excel 2):\n');
const result2 = CourseTypeDetector.detectCourseType(scheduledExample);
console.log('Resultado:', JSON.stringify(result2, null, 2));

console.log('\nDetalles extraídos:');
const details = CourseTypeDetector.extractScheduledDetails(scheduledExample);
console.log(JSON.stringify(details, null, 2));

console.log('\nMensaje formateado:');
console.log(
  CourseTypeDetector.formatCourseResponse(
    'Excel 2: Funciones y Análisis de Datos',
    result2.type,
    details
  )
);

console.log('\n' + '='.repeat(70));
console.log('\n✅ Tests completados\n');
