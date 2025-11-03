import { RAGAgent, validateConfig } from '../src/index.js';

/**
 * Script para agregar documentos de ejemplo a Pinecone
 */
async function main() {
  try {
    console.log('📚 Agregando documentos de ejemplo a Pinecone...\n');

    // Validar configuración
    validateConfig();

    // Crear agente
    const agent = new RAGAgent();
    await agent.initialize();

    // Documentos de ejemplo
    const documents = [
      {
        text: 'LangChain es un framework para desarrollar aplicaciones potenciadas por modelos de lenguaje. Permite encadenar diferentes componentes para crear aplicaciones más complejas.',
        metadata: { category: 'langchain', topic: 'intro' }
      },
      {
        text: 'Pinecone es una base de datos vectorial que permite búsquedas de similitud de alta velocidad. Es ideal para aplicaciones de RAG (Retrieval-Augmented Generation).',
        metadata: { category: 'pinecone', topic: 'intro' }
      },
      {
        text: 'OpenAI proporciona modelos de lenguaje como GPT-4 que pueden ser utilizados para generar texto, responder preguntas y realizar tareas de procesamiento de lenguaje natural.',
        metadata: { category: 'openai', topic: 'intro' }
      },
      {
        text: 'Perplexity AI es un motor de búsqueda conversacional que utiliza inteligencia artificial para proporcionar respuestas con fuentes citadas y actualizadas.',
        metadata: { category: 'perplexity', topic: 'intro' }
      },
      {
        text: 'RAG (Retrieval-Augmented Generation) combina la búsqueda de información con la generación de texto. Primero busca documentos relevantes y luego genera respuestas basadas en ese contexto.',
        metadata: { category: 'rag', topic: 'concept' }
      }
    ];

    // Agregar documentos
    await agent.addDocuments(
      documents.map(d => d.text),
      documents.map(d => d.metadata)
    );

    console.log('\n✅ Documentos agregados exitosamente!');
    console.log(`📊 Total: ${documents.length} documentos`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
