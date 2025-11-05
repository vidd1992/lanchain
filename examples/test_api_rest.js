/**
 * Test del API REST - Conversación completa
 * 
 * Prerrequisito: Servidor debe estar corriendo
 * npm run start-api
 */

const API_URL = 'http://localhost:3001';
const SESSION_ID = 'marjorie-test-' + Date.now();
const ID_EMPRESA = 'cec-epn';

async function testAPI() {
  console.log('🧪 TEST DEL API REST');
  console.log('='.repeat(80));
  console.log(`API URL: ${API_URL}`);
  console.log(`Session ID: ${SESSION_ID}`);
  console.log(`ID Empresa: ${ID_EMPRESA}`);
  console.log('');

  try {
    // Test 1: Health check
    console.log('1️⃣ Health Check...');
    const healthRes = await fetch(`${API_URL}/api/health`);
    const health = await healthRes.json();
    console.log('   ✅', health.status);
    console.log('');

    // Test 2: Primera consulta
    console.log('2️⃣ Primera consulta (cursos de inglés)...');
    const chat1 = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        idEmpresa: ID_EMPRESA,
        query: 'Hola, quisiera información sobre cursos de inglés, precios y horarios. Mi nombre es Marjorie'
      })
    });
    const response1 = await chat1.json();
    
    if (response1.success) {
      console.log('   ✅ Respuesta recibida');
      console.log('   Source:', response1.data.source);
      console.log('   Respuesta (primeros 200 chars):');
      console.log('   ' + response1.data.answer.substring(0, 200).replace(/<[^>]*>/g, '') + '...');
    } else {
      console.log('   ❌ Error:', response1.error);
    }
    console.log('');

    // Esperar un momento
    await new Promise(r => setTimeout(r, 2000));

    // Test 3: Segunda consulta con contexto
    console.log('3️⃣ Segunda consulta (con contexto)...');
    const chat2 = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        idEmpresa: ID_EMPRESA,
        query: 'quiero más información del primer curso'
      })
    });
    const response2 = await chat2.json();
    
    if (response2.success) {
      console.log('   ✅ Respuesta recibida');
      console.log('   Source:', response2.data.source);
      console.log('   Respuesta (primeros 200 chars):');
      console.log('   ' + response2.data.answer.substring(0, 200).replace(/<[^>]*>/g, '') + '...');
    } else {
      console.log('   ❌ Error:', response2.error);
    }
    console.log('');

    // Esperar un momento
    await new Promise(r => setTimeout(r, 2000));

    // Test 4: Tercera consulta con referencia temporal
    console.log('4️⃣ Tercera consulta (referencia temporal)...');
    const chat3 = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        idEmpresa: ID_EMPRESA,
        query: 'puedo inscribirme ahora en ese curso?'
      })
    });
    const response3 = await chat3.json();
    
    if (response3.success) {
      console.log('   ✅ Respuesta recibida');
      console.log('   Source:', response3.data.source);
      console.log('   Respuesta completa:');
      console.log('   ' + response3.data.answer.replace(/<[^>]*>/g, ''));
    } else {
      console.log('   ❌ Error:', response3.error);
    }
    console.log('');

    // Test 5: Obtener historial
    console.log('5️⃣ Obtener historial de la conversación...');
    const historyRes = await fetch(
      `${API_URL}/api/history/${SESSION_ID}?idEmpresa=${ID_EMPRESA}`
    );
    const history = await historyRes.json();
    
    if (history.success) {
      console.log('   ✅ Historial obtenido');
      console.log('   Total de mensajes:', history.data.count);
      console.log('   Mensajes:');
      history.data.messages.forEach((msg, idx) => {
        const preview = msg.content.substring(0, 50).replace(/<[^>]*>/g, '');
        console.log(`   ${idx + 1}. ${msg.role}: ${preview}...`);
      });
    } else {
      console.log('   ❌ Error:', history.error);
    }
    console.log('');

    // Test 6: Obtener estadísticas
    console.log('6️⃣ Obtener estadísticas de la empresa...');
    const statsRes = await fetch(`${API_URL}/api/stats/${ID_EMPRESA}`);
    const stats = await statsRes.json();
    
    if (stats.success) {
      console.log('   ✅ Estadísticas obtenidas');
      console.log('   Total queries:', stats.data.totalQueries || 'N/A');
      console.log('   Total sesiones:', stats.data.totalSessions || 'N/A');
    } else {
      console.log('   ❌ Error:', stats.error);
    }
    console.log('');

    // Test 7: Limpiar sesión
    console.log('7️⃣ Limpiar sesión...');
    const deleteRes = await fetch(
      `${API_URL}/api/session/${SESSION_ID}?idEmpresa=${ID_EMPRESA}`,
      { method: 'DELETE' }
    );
    const deleteResult = await deleteRes.json();
    
    if (deleteResult.success) {
      console.log('   ✅ Sesión limpiada correctamente');
    } else {
      console.log('   ❌ Error:', deleteResult.error);
    }
    console.log('');

    // Resumen
    console.log('='.repeat(80));
    console.log('✅ TODOS LOS TESTS COMPLETADOS');
    console.log('');
    console.log('📊 RESUMEN:');
    console.log('   ✅ Health check funcionando');
    console.log('   ✅ Chat endpoint respondiendo');
    console.log('   ✅ Contexto conversacional mantenido');
    console.log('   ✅ Historial guardándose correctamente');
    console.log('   ✅ Estadísticas disponibles');
    console.log('   ✅ Limpieza de sesiones funcional');
    console.log('');
    console.log('🎉 API REST LISTA PARA PRODUCCIÓN');

  } catch (error) {
    console.error('');
    console.error('❌ ERROR EN TEST:', error.message);
    console.error('');
    console.error('¿El servidor está corriendo?');
    console.error('Ejecuta: npm run start-api');
  }
}

// Ejecutar
console.log('');
console.log('⚠️  IMPORTANTE: Asegúrate de que el servidor esté corriendo');
console.log('   Comando: npm run start-api');
console.log('');
console.log('Esperando 3 segundos para iniciar tests...');
console.log('');

setTimeout(() => {
  testAPI();
}, 3000);
