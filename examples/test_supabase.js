import { SupabaseService } from '../src/services/supabase_service.js';

console.log('🧪 Probando conexión a Supabase...\n');

async function test() {
  try {
    const supabase = new SupabaseService();
    supabase.initialize();

    console.log('1️⃣  Insertando sesión de prueba...');
    const { data: session, error: sessionError } = await supabase.client
      .from('conversation_sessions')
      .insert({
        session_id: 'test-session-' + Date.now(),
        id_empresa: 'empresa-001',
        user_id: 'test-user',
      })
      .select()
      .single();

    if (sessionError) {
      throw sessionError;
    }

    console.log('✅ Sesión creada:', session.session_id);

    console.log('\n2️⃣  Insertando mensaje de prueba...');
    const { data: message, error: messageError } = await supabase.client
      .from('conversation_messages')
      .insert({
        session_id: session.session_id,
        id_empresa: 'empresa-001',
        role: 'user',
        content: '¿Qué cursos ofrecen?',
      })
      .select()
      .single();

    if (messageError) {
      throw messageError;
    }

    console.log('✅ Mensaje creado:', message.id);

    console.log('\n3️⃣  Consultando mensajes...');
    const { data: messages, error: queryError } = await supabase.client
      .from('conversation_messages')
      .select('*')
      .eq('session_id', session.session_id)
      .eq('id_empresa', 'empresa-001')
      .order('created_at', { ascending: false });

    if (queryError) {
      throw queryError;
    }

    console.log('✅ Mensajes encontrados:', messages.length);
    console.log('\n📋 Mensajes:');
    for (const msg of messages) {
      console.log(`   ${msg.role}: ${msg.content}`);
    }

    console.log('\n✅ ¡Supabase funcionando correctamente!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Asegúrate de:');
    console.error('   1. Haber ejecutado el SQL en Supabase');
    console.error('   2. Tener las credenciales correctas en .env');
    console.error(
      '   3. Que las tablas conversation_sessions y conversation_messages existan'
    );
  }
}

await test();
