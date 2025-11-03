import { RAGAgent, validateConfig } from '../src/index.js';

async function testOptimizations() {
  try {
    console.log('🧪 Iniciando tests de optimizaciones...\n');

    // Validar configuración
    console.log('1️⃣  Validando configuración...');
    validateConfig();
    console.log('✅ Configuración válida\n');

    // Test 1: Modo Custom (con paralelización y CoT)
    console.log('2️⃣  Test: Modo Custom (paralelización + CoT prompts)');
    console.log('='.repeat(60));
    const agentCustom = new RAGAgent('test-session-custom', false); // false = custom mode
    await agentCustom.initialize();

    console.log('\n📝 Query de prueba: "¿Qué cursos ofrecen?"');
    const startCustom = Date.now();
    const responseCustom = await agentCustom.query('¿Qué cursos ofrecen?');
    const latencyCustom = Date.now() - startCustom;

    console.log(`\n✅ Respuesta recibida en ${latencyCustom}ms`);
    console.log(`   Source: ${responseCustom.source}`);
    console.log(`   Respuesta: ${responseCustom.answer.substring(0, 150)}...`);

    // Test 2: Modo LangChain Chains
    console.log('\n\n3️⃣  Test: Modo LangChain Chains');
    console.log('='.repeat(60));
    const agentChains = new RAGAgent('test-session-chains', true); // true = chains mode
    await agentChains.initialize();

    console.log('\n📝 Query de prueba: "¿Qué cursos ofrecen?"');
    const startChains = Date.now();
    const responseChains = await agentChains.query('¿Qué cursos ofrecen?');
    const latencyChains = Date.now() - startChains;

    console.log(`\n✅ Respuesta recibida en ${latencyChains}ms`);
    console.log(`   Source: ${responseChains.source}`);
    console.log(`   Respuesta: ${responseChains.answer.substring(0, 150)}...`);

    // Test 3: Intenciones simples
    console.log('\n\n4️⃣  Test: Detección de intenciones simples');
    console.log('='.repeat(60));
    console.log('\n📝 Query de prueba: "Hola"');
    const startIntent = Date.now();
    const responseIntent = await agentCustom.query('Hola');
    const latencyIntent = Date.now() - startIntent;

    console.log(`\n✅ Respuesta recibida en ${latencyIntent}ms (debería ser muy rápida)`);
    console.log(`   Source: ${responseIntent.source}`);
    console.log(`   Intent: ${responseIntent.intent}`);
    console.log(`   Respuesta: ${responseIntent.answer}`);

    // Test 4: Múltiples queries para probar historial y métricas
    console.log('\n\n5️⃣  Test: Historial conversacional y métricas');
    console.log('='.repeat(60));
    const queries = [
      '¿Tienen cursos de Python?',
      '¿Cuál es el precio?',
      'Gracias por la información',
    ];

    for (const query of queries) {
      console.log(`\n📝 Query: "${query}"`);
      const response = await agentCustom.query(query);
      console.log(`   ✅ Source: ${response.source}`);
    }

    // Test 5: Métricas
    console.log('\n\n6️⃣  Test: Sistema de métricas');
    console.log('='.repeat(60));
    agentCustom.printMetricsReport();

    // Test 6: Exportar métricas
    console.log('\n7️⃣  Test: Exportar métricas a JSON');
    console.log('='.repeat(60));
    const metricsPath = './metrics_report.json';
    await agentCustom.exportMetrics(metricsPath);
    console.log(`✅ Métricas exportadas a ${metricsPath}`);

    // Resumen comparativo
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 RESUMEN COMPARATIVO');
    console.log('='.repeat(60));
    console.log(`Custom Mode latency: ${latencyCustom}ms`);
    console.log(`Chains Mode latency: ${latencyChains}ms`);
    console.log(`Intent detection latency: ${latencyIntent}ms (esperado: <100ms)`);
    console.log('\n✅ Todos los tests completados exitosamente!');
  } catch (error) {
    console.error('\n❌ Error en tests:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar tests
testOptimizations();
