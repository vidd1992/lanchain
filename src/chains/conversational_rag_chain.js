import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { config } from '../config/env.js';

/**
 * Chain de RAG conversacional optimizado con LangChain
 * Usa LCEL (LangChain Expression Language) para crear un chain moderno
 */
export class ConversationalRAGChain {
  constructor(llm, vectorStore, historyManager) {
    this.llm = llm;
    this.vectorStore = vectorStore;
    this.historyManager = historyManager;
    this.chain = null;
    this.retriever = null;
  }

  /**
   * Crear el chain conversacional con prompts optimizados usando LCEL
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
    this.retriever = this.vectorStore.asRetriever({
      k: config.rag.topK,
      searchType: 'similarity',
    });

    // Crear chain usando LCEL (LangChain Expression Language)
    // Este es el approach moderno y no deprecado
    this.chain = RunnableSequence.from([
      {
        context: input => {
          // Formatear documentos recuperados
          return input.sourceDocuments.map(doc => doc.pageContent).join('\n\n');
        },
        question: input => input.question,
        chat_history: input => input.chat_history || [],
      },
      qaPrompt,
      this.llm,
      new StringOutputParser(),
    ]);

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

    // Obtener historial de la sesión (retorna array de mensajes de LangChain)
    const chatHistory = await this.historyManager.getHistory(sessionId);

    // Asegurarse de que chat_history sea un array (vacío si no hay historial)
    const chatHistoryArray = Array.isArray(chatHistory) ? chatHistory : [];

    // Recuperar documentos usando el retriever
    const sourceDocuments = await this.retriever.getRelevantDocuments(question);

    // Ejecutar el chain con LCEL
    const answer = await this.chain.invoke({
      question: question,
      chat_history: chatHistoryArray,
      sourceDocuments: sourceDocuments,
    });

    // Guardar en el historial
    await this.historyManager.addMessage(sessionId, 'user', question);
    await this.historyManager.addMessage(sessionId, 'assistant', answer);

    // Extraer scores de los documentos si están disponibles
    const formattedDocs = sourceDocuments.map(doc => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      score: doc.metadata.score || null,
    }));

    return {
      answer: answer,
      sourceDocuments: formattedDocs,
      hasRelevantDocs: formattedDocs.length > 0,
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
