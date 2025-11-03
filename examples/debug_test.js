import { RAGAgent } from '../src/agent/rag_agent.js';
import { validateConfig } from '../src/config/env.js';

/**
 * Script de prueba para el debug logger
 *
 * Para activar el debug mode, asegúrate de tener en tu .env:
 * DEBUG_MODE=true
 * LANGCHAIN_VERBOSE=true
 *
 * Ejecutar con: node examples/debug_test.js
 */

async function testDebug() {
  try {
    console.log('🔧 Validando configuración...');
    validateConfig();

    const agent = new RAGAgent('test-session');
    await agent.initialize();

    console.log('\n' + '='.repeat(60));
    console.log('🧪 Test 1: Saludo (Intención simple)');
    console.log('='.repeat(60));

    const response1 = await agent.query('Hola');
    console.log('\n📋 Resultado:');
    console.log(`   Respuesta: ${response1.answer}`);
    console.log(`   Fuente: ${response1.source}`);

    console.log('\n' + '='.repeat(60));
    console.log('🧪 Test 2: Pregunta sobre CEC-EPN (RAG)');
    console.log('='.repeat(60));

    const response2 = await agent.query('¿Qué es el CEC-EPN?');
    console.log('\n📋 Resultado:');
    console.log(`   Respuesta: ${response2.answer.substring(0, 100)}...`);
    console.log(`   Fuente: ${response2.source}`);

    console.log('\n' + '='.repeat(60));
    console.log('🧪 Test 3: Pregunta no relacionada (Perplexity)');
    console.log('='.repeat(60));

    const response3 = await agent.query('¿Quién ganó el mundial de fútbol 2022?');
    console.log('\n📋 Resultado:');
    console.log(`   Respuesta: ${response3.answer.substring(0, 100)}...`);
    console.log(`   Fuente: ${response3.source}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Tests completados');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testDebug();
