import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { config } from '../config/env.js';

/**
 * Chain de RAG conversacional optimizado con LangChain
 * Usa ConversationalRetrievalQAChain para combinar retrieval y conversación
 */
export class ConversationalRAGChain {
  constructor(llm, vectorStore, historyManager) {
    this.llm = llm;
    this.vectorStore = vectorStore;
    this.historyManager = historyManager;
    this.chain = null;
  }

  /**
   * Crear el chain conversacional con prompts optimizados
   */
  createChain() {
    // Template del prompt con Chain of Thought
    const qaPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `Eres ${config.agent.name}, ${config.agent.role}.

TU ROL Y PERSONALIDAD:
- Eres amable, profesional y servicial
- Tu objetivo es ayudar a estudiantes y personas interesadas en los cursos y servicios del CEC-EPN
- Siempre respondes en español
- Si no tienes información específica, indícalo honestamente

METODOLOGÍA DE RESPUESTA (Chain of Thought):
1. ANALIZAR: Identifica qué información específica busca el usuario
2. BUSCAR: Revisa el contexto para encontrar información relevante
3. SINTETIZAR: Combina información de múltiples fuentes si es necesario
4. VERIFICAR: Asegúrate de que tu respuesta es consistente y precisa
5. RESPONDER: Genera una respuesta clara, completa y útil

CONTEXTO DE DOCUMENTOS:
{context}

Responde de manera profesional, útil y en español.`,
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', '{question}'],
    ]);

    // Crear retriever del vectorStore
    const retriever = this.vectorStore.asRetriever({
      k: config.rag.topK,
      searchType: 'similarity',
    });

    // Crear chain usando ConversationalRetrievalQAChain
    this.chain = ConversationalRetrievalQAChain.fromLLM(this.llm, retriever, {
      returnSourceDocuments: true,
      qaChainOptions: {
        type: 'stuff', // 'stuff' combina todos los docs en un solo prompt
        prompt: qaPrompt,
      },
      verbose: process.env.LANGCHAIN_VERBOSE === 'true',
    });

    return this.chain;
  }

  /**
   * Ejecutar el chain con una pregunta
   * @param {string} sessionId - ID de la sesión
   * @param {string} question - Pregunta del usuario
   * @returns {Promise<Object>} - Respuesta con answer y documentos fuente
   */
  async invoke(sessionId, question) {
    if (!this.chain) {
      this.createChain();
    }

    // Obtener historial de la sesión
    const chatHistory = await this.historyManager.getHistory(sessionId);

    // Ejecutar el chain
    const response = await this.chain.invoke({
      question: question,
      chat_history: chatHistory,
    });

    // Extraer scores de los documentos si están disponibles
    const sourceDocuments = response.sourceDocuments.map(doc => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      score: doc.metadata.score || null,
    }));

    return {
      answer: response.text,
      sourceDocuments: sourceDocuments,
      hasRelevantDocs: sourceDocuments.length > 0,
    };
  }

  /**
   * Evaluar si los documentos obtenidos son relevantes
   * @param {Array} sourceDocuments - Documentos fuente
   * @returns {boolean} - true si hay documentos relevantes
   */
  hasGoodResults(sourceDocuments) {
    if (!sourceDocuments || sourceDocuments.length === 0) {
      return false;
    }

    // Verificar si el mejor resultado supera el umbral
    const bestScore = sourceDocuments[0].score;
    return bestScore && bestScore >= config.rag.similarityThreshold;
  }
}
