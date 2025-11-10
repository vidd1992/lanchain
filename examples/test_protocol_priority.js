/**
 * Test específico para validar que el protocolo se priorice correctamente
 * Prueba la pregunta: "¿Cómo realizo el pago?"
 */

import { RAGAgent } from '../src/agent/rag_agent.js';

async function testProtocolPriority() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 TEST: PRIORIZACIÓN DEL PROTOCOLO');
  console.log('═'.repeat(80) + '\n');

  const agent = new RAGAgent('test-protocol-priority', false, 'cec-epn');
  await agent.initialize();

  // Queries que deberían usar información del protocolo
  const testQueries = [
    {
      query: '¿Cómo realizo el pago?',
      expectedKeywords: [
        'https://aps.cec-epn.edu.ec',
        'Banca Electrónica',
        'Banco Pichincha',
        'Diferido',
        'tarjeta'
      ],
      forbiddenPhrases: [
        'consultar la página del CEC',
        'según información oficial',
        'contactar al CEC'
      ],
      description: 'Métodos de pago (debe incluir URL y detalles específicos)'
    },
    {
      query: '¿Puedo tener dos descuentos?',
      expectedKeywords: [
        'no puedes',
        'aplicamos',
        'mayor porcentaje'
      ],
      forbiddenPhrases: [
        'según información oficial',
        'se aplica',
        'consultar'
      ],
      description: 'Descuentos (debe usar tono institucional - "aplicamos")'
    },
    {
      query: '¿Cuál es el horario de atención?',
      expectedKeywords: [
        'Lunes a Viernes',
        '07h00',
        '18h30',
        'Sábados',
        '08h00'
      ],
      forbiddenPhrases: [
        'consultar la página',
        'contactar al CEC'
      ],
      description: 'Horarios de atención (debe incluir horarios específicos)'
    }
  ];

  let passedTests = 0;
  let totalTests = testQueries.length;

  for (let i = 0; i < testQueries.length; i++) {
    const test = testQueries[i];
    
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`TEST ${i + 1}/${totalTests}: ${test.description}`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`📝 Query: "${test.query}"\n`);

    try {
      const response = await agent.queryCustom(test.query);
      
      console.log('\n📤 RESPUESTA GENERADA:');
      console.log('─'.repeat(80));
      console.log(response.answer);
      console.log('─'.repeat(80));

      // Validar que incluya keywords esperadas
      console.log('\n✅ VALIDACIÓN DE CONTENIDO:');
      let foundKeywords = 0;
      
      for (const keyword of test.expectedKeywords) {
        const found = response.answer.toLowerCase().includes(keyword.toLowerCase());
        if (found) {
          console.log(`   ✅ "${keyword}" - ENCONTRADO`);
          foundKeywords++;
        } else {
          console.log(`   ❌ "${keyword}" - NO ENCONTRADO`);
        }
      }

      // Validar que NO incluya frases prohibidas (tono no institucional)
      console.log('\n🚫 VALIDACIÓN DE TONO INSTITUCIONAL:');
      let forbiddenFound = 0;
      
      if (test.forbiddenPhrases) {
        for (const phrase of test.forbiddenPhrases) {
          const found = response.answer.toLowerCase().includes(phrase.toLowerCase());
          if (found) {
            console.log(`   ❌ "${phrase}" - ENCONTRADA (NO DEBERÍA ESTAR)`);
            forbiddenFound++;
          } else {
            console.log(`   ✅ "${phrase}" - NO ENCONTRADA (correcto)`);
          }
        }
      }

      // Validar fuente
      console.log(`\n📊 MÉTRICAS:`);
      console.log(`   Fuente: ${response.source}`);
      console.log(`   Keywords encontradas: ${foundKeywords}/${test.expectedKeywords.length}`);
      console.log(`   Frases prohibidas: ${forbiddenFound}/${test.forbiddenPhrases?.length || 0}`);
      
      // Check si usó protocolo
      const usedProtocol = response.ragResults?.some(doc => 
        doc.metadata?.source?.toLowerCase().includes('protocol')
      );
      console.log(`   Usó protocolo: ${usedProtocol ? '✅ SÍ' : '❌ NO'}`);

      // Test pasa si:
      // 1. Encontró al menos 60% de keywords
      // 2. NO tiene frases prohibidas (tono institucional correcto)
      const passThreshold = 0.6;
      const keywordsPassed = (foundKeywords / test.expectedKeywords.length) >= passThreshold;
      const tonePassed = forbiddenFound === 0;
      const passed = keywordsPassed && tonePassed;
      
      if (passed) {
        console.log(`\n✅ TEST PASADO`);
        console.log(`   - Keywords: ${foundKeywords}/${test.expectedKeywords.length} ✅`);
        console.log(`   - Tono institucional: ${tonePassed ? 'Correcto ✅' : 'Incorrecto ❌'}`);
        passedTests++;
      } else {
        console.log(`\n❌ TEST FALLIDO`);
        console.log(`   - Keywords: ${foundKeywords}/${test.expectedKeywords.length} ${keywordsPassed ? '✅' : '❌'}`);
        console.log(`   - Tono institucional: ${tonePassed ? 'Correcto ✅' : 'Incorrecto ❌'}`);
        if (!keywordsPassed) {
          console.log(`   Esperado: al menos ${Math.ceil(test.expectedKeywords.length * passThreshold)} keywords`);
        }
        if (!tonePassed) {
          console.log(`   El bot está usando frases de tercera persona (no habla como CEC-EPN)`);
        }
      }

    } catch (error) {
      console.error(`\n❌ ERROR EN TEST: ${error.message}`);
    }

    // Esperar 2 segundos entre tests
    if (i < testQueries.length - 1) {
      console.log('\n⏳ Esperando 2 segundos...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Resumen final
  console.log('\n' + '═'.repeat(80));
  console.log('📊 RESUMEN DE TESTS');
  console.log('═'.repeat(80));
  console.log(`✅ Tests pasados: ${passedTests}/${totalTests}`);
  console.log(`❌ Tests fallidos: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📈 Tasa de éxito: ${(passedTests / totalTests * 100).toFixed(1)}%\n`);

  if (passedTests === totalTests) {
    console.log('🎉 ¡TODOS LOS TESTS PASARON!');
    console.log('✅ El protocolo se está priorizando correctamente\n');
  } else {
    console.log('⚠️  Algunos tests fallaron');
    console.log('💡 Considera ajustar el boost del protocolo o el prompt\n');
  }

  console.log('═'.repeat(80) + '\n');
}

testProtocolPriority()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
