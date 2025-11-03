import dotenv from 'dotenv';

dotenv.config();

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  },
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    indexName: process.env.PINECONE_INDEX_NAME,
    environment: process.env.PINECONE_ENVIRONMENT,
    dimension: parseInt(process.env.PINECONE_DIMENSION) || 1536,
    metric: process.env.PINECONE_METRIC || 'cosine',
    cloud: process.env.PINECONE_CLOUD || 'aws',
    region: process.env.PINECONE_REGION || 'us-east-1'
  },
  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY,
    model: process.env.PERPLEXITY_MODEL || 'sonar',
    searchDomains: process.env.PERPLEXITY_SEARCH_DOMAINS
      ? process.env.PERPLEXITY_SEARCH_DOMAINS.split(',').map(d => d.trim())
      : []
  },
  rag: {
    similarityThreshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.7,
    topK: parseInt(process.env.RAG_TOP_K) || 3
  },
  processing: {
    chunkSize: parseInt(process.env.CHUNK_SIZE) || 1000,
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 200
  },
  agent: {
    name: process.env.AGENT_NAME || 'Asistente Virtual',
    role: process.env.AGENT_ROLE || 'asistente de ayuda',
    greeting: process.env.AGENT_GREETING || '¡Hola! ¿En qué puedo ayudarte?'
  }
};

// Validar configuración
export function validateConfig() {
  const required = [
    'OPENAI_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_INDEX_NAME',
    'PERPLEXITY_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Faltan las siguientes variables de entorno: ${missing.join(', ')}\n` +
      'Por favor, copia .env.example a .env y completa los valores.'
    );
  }
}
