import { RAGAgent, validateConfig } from '../src/index.js';

/**
 * Script de prueba del agente
 */
async function main() {
  try {
    console.log('🧪 Probando RAG Agent...\n');

    // Validar configuración
    validateConfig();

    // Crear agente
    const agent = new RAGAgent('test-session');
    await agent.initialize();

    // Prueba 1: Pregunta que debería encontrar en RAG
    console.log('\n' + '='.repeat(60));
    console.log('Prueba 1: Consulta sobre LangChain (debería usar RAG)');
    console.log('='.repeat(60));

    const response1 = await agent.query('¿Qué es LangChain?');
    console.log(`\n🤖 Respuesta (fuente: ${response1.source}):`);
    console.log(response1.answer);

    if (response1.ragResults && response1.ragResults.length > 0) {
      console.log(`\n✅ Score del mejor resultado: ${response1.ragResults[0].score.toFixed(3)}`);
    }

    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Prueba 2: Pregunta que probablemente irá a Perplexity
    console.log('\n' + '='.repeat(60));
    console.log('Prueba 2: Consulta actual (debería usar Perplexity)');
    console.log('='.repeat(60));

    const response2 = await agent.query('¿Cuál es la noticia más reciente sobre inteligencia artificial?');
    console.log(`\n🤖 Respuesta (fuente: ${response2.source}):`);
    console.log(response2.answer);

    if (response2.citations && response2.citations.length > 0) {
      console.log('\n📎 Fuentes:', response2.citations);
    }

    // Prueba 3: Continuidad de conversación
    console.log('\n' + '='.repeat(60));
    console.log('Prueba 3: Continuidad de conversación');
    console.log('='.repeat(60));

    const response3 = await agent.query('¿Puedes darme más detalles sobre lo que acabas de mencionar?');
    console.log(`\n🤖 Respuesta (fuente: ${response3.source}):`);
    console.log(response3.answer);

    // Mostrar historial
    console.log('\n' + '='.repeat(60));
    console.log('Historial de conversación');
    console.log('='.repeat(60));

    const history = await agent.getHistory();
    console.log(`\n📜 Total de mensajes: ${history.length}`);
    history.forEach((msg, idx) => {
      console.log(`${idx + 1}. ${msg.role.toUpperCase()}: ${msg.content.substring(0, 100)}...`);
    });

    console.log('\n✅ Pruebas completadas!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
