import { RAGAgent, validateConfig } from '../src/index.js';
import readline from 'readline';

async function main() {
  try {
    // Validar configuración
    console.log('🔧 Validando configuración...');
    validateConfig();

    // Crear agente
    const agent = new RAGAgent('user-session-1');
    await agent.initialize();

    console.log('\n' + '='.repeat(60));
    console.log('💬 Chat con RAG Agent (escribe "salir" para terminar)');
    console.log('='.repeat(60) + '\n');

    // Configurar readline para interacción
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = () => {
      rl.question('\n👤 Tú: ', async (input) => {
        const query = input.trim();

        if (query.toLowerCase() === 'salir' || query.toLowerCase() === 'exit') {
          console.log('\n👋 ¡Hasta luego!');
          rl.close();
          process.exit(0);
        }

        if (!query) {
          askQuestion();
          return;
        }

        try {
          const response = await agent.query(query);

          console.log('\n' + '-'.repeat(60));

          // Mostrar fuente de manera descriptiva
          let sourceLabel = response.source;
          if (response.source === 'direct') {
            sourceLabel = `respuesta directa - ${response.intent}`;
          } else if (response.source === 'rag') {
            sourceLabel = 'RAG (base de conocimiento)';
          } else if (response.source === 'perplexity') {
            sourceLabel = 'Perplexity (búsqueda web)';
          }

          console.log(`🤖 Asistente (fuente: ${sourceLabel}):\n`);
          console.log(response.answer);

          if (response.citations && response.citations.length > 0) {
            console.log('\n📎 Fuentes:');
            response.citations.forEach((citation, idx) => {
              console.log(`  ${idx + 1}. ${citation}`);
            });
          }

          if (response.ragResults && response.ragResults.length > 0) {
            console.log(`\n📊 Documentos RAG usados: ${response.ragResults.length}`);
            console.log(`   Score más alto: ${response.ragResults[0].score.toFixed(3)}`);
          }

          console.log('-'.repeat(60));
        } catch (error) {
          console.error('\n❌ Error:', error.message);
        }

        askQuestion();
      });
    };

    askQuestion();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
