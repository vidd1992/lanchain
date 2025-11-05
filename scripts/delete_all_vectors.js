import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../src/config/env.js';
import readline from 'readline';

/**
 * Script para eliminar TODOS los vectores de un índice de Pinecone
 * ADVERTENCIA: Esta operación es irreversible
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function deleteAllVectors() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🗑️  ELIMINAR TODOS LOS VECTORES DE PINECONE');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`⚠️  ADVERTENCIA: Vas a eliminar TODOS los vectores del índice:`);
  console.log(`   📊 Índice: "${config.pinecone.indexName}"`);
  console.log(`   🔴 Esta operación es IRREVERSIBLE\n`);

  // Confirmar acción
  const confirm1 = await askQuestion(
    '¿Estás seguro que quieres continuar? (escribe "SI" para confirmar): '
  );

  if (confirm1.toUpperCase() !== 'SI') {
    console.log('\n❌ Operación cancelada');
    rl.close();
    process.exit(0);
  }

  const confirm2 = await askQuestion(
    '\n🔴 ÚLTIMA CONFIRMACIÓN - ¿Eliminar TODOS los vectores? (escribe "ELIMINAR" para confirmar): '
  );

  if (confirm2.toUpperCase() !== 'ELIMINAR') {
    console.log('\n❌ Operación cancelada');
    rl.close();
    process.exit(0);
  }

  rl.close();

  console.log('\n🔄 Conectando a Pinecone...\n');

  // Inicializar Pinecone
  const pinecone = new Pinecone({
    apiKey: config.pinecone.apiKey,
  });

  const index = pinecone.Index(config.pinecone.indexName);

  // Obtener estadísticas antes de eliminar
  console.log('📊 Obteniendo estadísticas del índice...\n');
  const statsBefore = await index.describeIndexStats();

  console.log('Estado ANTES de eliminar:');
  console.log(`   📦 Total de vectores: ${statsBefore.totalRecordCount || 0}`);
  console.log(`   🔢 Dimensiones: ${statsBefore.dimension || 'N/A'}`);

  if (statsBefore.namespaces) {
    console.log(`   📁 Namespaces:`);
    for (const [ns, info] of Object.entries(statsBefore.namespaces)) {
      console.log(`      - ${ns || '(default)'}: ${info.recordCount} vectores`);
    }
  }

  // Eliminar todos los vectores del namespace por defecto
  console.log('\n🗑️  Eliminando vectores...\n');

  try {
    // Pinecone permite eliminar todos los vectores usando deleteAll
    await index.namespace('').deleteAll();
    console.log('✅ Vectores eliminados del namespace por defecto');

    // Si hay otros namespaces, eliminarlos también
    if (statsBefore.namespaces) {
      for (const ns of Object.keys(statsBefore.namespaces)) {
        if (ns && ns !== '') {
          await index.namespace(ns).deleteAll();
          console.log(`✅ Vectores eliminados del namespace: ${ns}`);
        }
      }
    }

    // Esperar un momento para que se propaguen los cambios
    console.log('\n⏳ Esperando propagación de cambios...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verificar estado después de eliminar
    const statsAfter = await index.describeIndexStats();

    console.log('\n📊 Estado DESPUÉS de eliminar:');
    console.log(`   📦 Total de vectores: ${statsAfter.totalRecordCount || 0}`);

    if ((statsAfter.totalRecordCount || 0) === 0) {
      console.log('\n✅ ÉXITO: Todos los vectores han sido eliminados');
      console.log('\n📋 Próximos pasos:');
      console.log('   1. Ejecutar: npm run setup (para reprocesar todos los documentos)');
      console.log(
        '   2. Ejecutar: npm run process-especiales (para cargar casos especiales)'
      );
    } else {
      console.log('\n⚠️  Aún quedan algunos vectores. Puede tomar unos momentos más.');
    }
  } catch (error) {
    console.error('\n❌ Error al eliminar vectores:', error.message);
    process.exit(1);
  }
}

// Ejecutar
deleteAllVectors()
  .then(() => {
    console.log('\n🎉 Proceso completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
