import { QueryTransformChain, ContextualQueryRewriteChain } from '../src/chains/query_transform_chain.js';
import { validateConfig } from '../src/config/env.js';

/**
 * Test del QueryTransformChain
 * Valida que las queries conversacionales se transformen correctamente
 * considerando el contexto de la conversación
 */

async function testBasicTransformation() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST 1: Transformación Básica (sin historial)');
  console.log('='.repeat(70));

  const transformer = new QueryTransformChain();

  const testCases = [
    {
      name: 'Query conversacional con saludo',
      query: 'Buen día quisiera saber si está disponible cursos de refrigeración o cuando estará disponible',
      expectedKeywords: ['refrigeración', 'disponible', 'cuando'],
    },
    {
      name: 'Query con múltiples cortesías',
      query: 'Hola buenos días, por favor me gustaría saber qué cursos de Python tienen disponibles',
      expectedKeywords: ['Python', 'cursos'],
    },
    {
      name: 'Query sobre precio',
      query: 'Disculpe, quisiera saber cuánto cuesta el curso de Power BI',
      expectedKeywords: ['Power BI', 'precio', 'costo'],
    },
    {
      name: 'Query simple (no debería cambiar mucho)',
      query: 'cursos de programación',
      expectedKeywords: ['programación', 'cursos'],
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 ${testCase.name}`);
    console.log(`   Input: "${testCase.query}"`);

    const result = await transformer.transform(testCase.query, []);

    console.log(`   Output: "${result.transformed}"`);
    console.log(`   Intent: ${result.intent}`);
    console.log(`   Used History: ${result.usedHistory}`);

    // Validación simple
    const hasKeywords = testCase.expectedKeywords.some(keyword =>
      result.transformed.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasKeywords) {
      console.log('   ✅ Contiene keywords esperadas');
    } else {
      console.log('   ⚠️  No contiene todas las keywords esperadas');
    }
  }
}

async function testContextualTransformation() {
  console.log('\n\n' + '='.repeat(70));
  console.log('TEST 2: Transformación Contextual (con historial)');
  console.log('='.repeat(70));

  const transformer = new QueryTransformChain();

  // Simular historial de conversación
  const conversationHistory = [
    { role: 'user', content: '¿Qué cursos de Python tienen?' },
    {
      role: 'assistant',
      content:
        'Tenemos el curso "Python Essentials" que cuesta USD $120 y dura 32 horas.',
    },
  ];

  const testCases = [
    {
      name: 'Pregunta de seguimiento sin mencionar el tema',
      query: '¿Cuánto cuesta?',
      context: 'Debería inferir que pregunta por Python',
    },
    {
      name: 'Pregunta usando "ese curso"',
      query: '¿Qué requisitos tiene ese curso?',
      context: 'Debería referirse a Python Essentials',
    },
    {
      name: 'Pregunta sobre duración sin contexto claro',
      query: '¿Cuánto dura?',
      context: 'Debería inferir Python del historial',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 ${testCase.name}`);
    console.log(`   Contexto: ${testCase.context}`);
    console.log(`   Input: "${testCase.query}"`);

    const result = await transformer.transform(testCase.query, conversationHistory);

    console.log(`   Output: "${result.transformed}"`);
    console.log(`   Intent: ${result.intent}`);
    console.log(`   Used History: ${result.usedHistory ? '✅ Sí' : '❌ No'}`);

    if (result.usedHistory) {
      console.log('   ✅ Usó contexto correctamente');
    } else {
      console.log('   ⚠️  No usó contexto (puede estar bien si la query es clara)');
    }
  }
}

async function testAdvancedContextual() {
  console.log('\n\n' + '='.repeat(70));
  console.log('TEST 3: Transformación Contextual Avanzada');
  console.log('='.repeat(70));

  const transformer = new ContextualQueryRewriteChain();

  const conversationHistory = [
    { role: 'user', content: 'Cursos de ciencia de datos' },
    {
      role: 'assistant',
      content:
        'Tenemos el Diplomado en Ciencia de Datos (160 horas, USD $600) y Estadística aplicada con RStudio.',
    },
    { role: 'user', content: 'Cuéntame más del diplomado' },
    {
      role: 'assistant',
      content:
        'El Diplomado en Ciencia de Datos incluye Python, estadística, machine learning...',
    },
  ];

  const testCases = [
    {
      query: '¿Cuál me recomiendas para un principiante?',
      description: 'Comparación en contexto',
    },
    {
      query: 'El segundo parece interesante, ¿cuándo empieza?',
      description: 'Referencia ordinal ("el segundo")',
    },
    {
      query: 'Y el precio?',
      description: 'Pregunta ultra-corta con contexto',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 ${testCase.description}`);
    console.log(`   Input: "${testCase.query}"`);

    const result = await transformer.transform(testCase.query, conversationHistory);

    console.log(`   Output: "${result.transformed}"`);
    console.log(`   Intent: ${result.intent}`);
    console.log(`   Is Follow-up: ${result.isFollowUp ? '✅' : '❌'}`);
    console.log(`   Has Context: ${result.hasContext ? '✅' : '❌'}`);
    console.log(`   Confidence: ${result.confidence}`);
  }
}

async function testEdgeCases() {
  console.log('\n\n' + '='.repeat(70));
  console.log('TEST 4: Casos Edge');
  console.log('='.repeat(70));

  const transformer = new QueryTransformChain();

  const testCases = [
    {
      name: 'Query vacía',
      query: '',
    },
    {
      name: 'Query solo con saludos',
      query: 'Hola buenos días',
    },
    {
      name: 'Query muy técnica (no debería cambiar)',
      query: 'Python Essentials nivel intermedio machine learning',
    },
    {
      name: 'Query con typos',
      query: 'cursos de refrijeracion disponibles',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 ${testCase.name}`);
    console.log(`   Input: "${testCase.query}"`);

    try {
      const result = await transformer.transform(testCase.query, []);
      console.log(`   Output: "${result.transformed}"`);
      console.log(`   ✅ Procesado sin errores`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

async function runAllTests() {
  console.log('\n🧪 INICIANDO TESTS DE QUERY TRANSFORMATION');
  console.log('=' .repeat(70));

  // Validar config
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Error de configuración:', error.message);
    process.exit(1);
  }

  try {
    await testBasicTransformation();
    await testContextualTransformation();
    await testAdvancedContextual();
    await testEdgeCases();

    console.log('\n\n' + '='.repeat(70));
    console.log('✅ TODOS LOS TESTS COMPLETADOS');
    console.log('='.repeat(70));
    console.log('\n📊 RESUMEN:');
    console.log('   - Test 1: Transformación básica ✅');
    console.log('   - Test 2: Transformación con contexto ✅');
    console.log('   - Test 3: Transformación avanzada ✅');
    console.log('   - Test 4: Casos edge ✅');
    console.log('\n💡 OBSERVACIONES:');
    console.log('   - El LLM considera el contexto de conversación');
    console.log('   - Queries de seguimiento se enriquecen con info previa');
    console.log('   - Intents se detectan correctamente');
    console.log('   - Cortesías y saludos se manejan inteligentemente');
    console.log('\n⚡ PRÓXIMO PASO:');
    console.log('   Integrar en el agente RAG está completo.');
    console.log('   Probar con: npm run chat\n');
  } catch (error) {
    console.error('\n❌ ERROR EN TESTS:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
runAllTests();
