import { ChatOpenAI } from '@langchain/openai';
import { PineconeService } from '../services/pinecone_service.js';
import { PerplexityService } from '../services/perplexity_service.js';
import { ConversationHistoryManager } from '../services/conversation_history.js';
import { IntentDetector } from '../utils/intent_detector.js';
import { debugLogger } from '../utils/debug_logger.js';
import { langChainCallbacks } from '../utils/langchain_callbacks.js';
import { config } from '../config/env.js';

export class RAGAgent {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.pineconeService = new PineconeService();
    this.perplexityService = new PerplexityService();
    this.historyManager = new ConversationHistoryManager();
    this.intentDetector = new IntentDetector();

    // Configurar LLM con verbose si está activado
    this.llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: config.openai.model,
      temperature: 0.7,
      verbose: process.env.LANGCHAIN_VERBOSE === 'true'
    });
    this.initialized = false;
  }

  /**
   * Inicializar el agente
   */
  async initialize() {
    try {
      console.log('🚀 Inicializando RAG Agent...');
      await this.pineconeService.initialize();
      this.initialized = true;
      console.log('✅ RAG Agent listo');
    } catch (error) {
      console.error('❌ Error al inicializar RAG Agent:', error.message);
      throw error;
    }
  }

  /**
   * Procesar una consulta del usuario
   * @param {string} query - La pregunta del usuario
   * @returns {Promise<Object>} - Respuesta del agente
   */
  async query(query) {
    if (!this.initialized) {
      throw new Error('Agente no inicializado. Llama a initialize() primero.');
    }

    try {
      debugLogger.startTimer();
      console.log(`\n📝 Consulta: "${query}"`);

      // Paso 0: Detectar intenciones simples (saludos, despedidas, etc.)
      const simpleIntent = this.intentDetector.processSimpleIntent(query);

      if (simpleIntent) {
        debugLogger.logIntent(simpleIntent.intent, simpleIntent.confidence);
        console.log(`💬 Intención simple detectada: ${simpleIntent.intent}`);
        console.log('✨ Respondiendo directamente (sin búsqueda)');

        // Guardar en historial
        await this.historyManager.addMessage(this.sessionId, query, simpleIntent.answer);

        debugLogger.logResponse('Respuesta Directa', simpleIntent.answer);

        return {
          answer: simpleIntent.answer,
          source: 'direct',
          intent: simpleIntent.intent,
          query,
          ragResults: [],
          citations: [],
          sessionId: this.sessionId,
          timestamp: new Date().toISOString()
        };
      }

      // Paso 1: Buscar en RAG (Pinecone)
      console.log('🔍 Buscando en RAG...');
      const ragResults = await this.pineconeService.searchSimilarDocuments(query);

      debugLogger.logRAGSearch(query, ragResults);

      // Paso 2: Evaluar si los resultados del RAG son adecuados
      const hasRelevantResults = this.pineconeService.hasRelevantResults(ragResults);
      const bestScore = ragResults.length > 0 ? ragResults[0].score : null;

      debugLogger.logRAGDecision(hasRelevantResults, config.rag.similarityThreshold, bestScore);

      let answer, source, citations = [], relevantDocs = [];

      if (hasRelevantResults) {
        // Usar RAG para responder
        console.log(`✅ Encontrados ${ragResults.length} documentos relevantes (score: ${ragResults[0].score.toFixed(3)})`);

        const ragAnswer = await this.generateAnswerFromRAG(query, ragResults);
        answer = ragAnswer.answer;
        source = 'rag';
        relevantDocs = ragResults;

        debugLogger.logResponse('RAG (OpenAI)', answer);
        console.log('📚 Respondiendo desde RAG');
      } else {
        // Fallback a Perplexity
        console.log('⚠️  No se encontraron resultados relevantes en RAG');
        console.log('🌐 Consultando Perplexity...');

        const conversationHistory = await this.historyManager.getFormattedHistory(this.sessionId);
        debugLogger.logMemory(conversationHistory);

        const perplexityResponse = await this.perplexityService.query(query, conversationHistory);

        answer = perplexityResponse.answer;
        source = 'perplexity';
        citations = perplexityResponse.citations;

        debugLogger.logResponse('Perplexity', answer);
        console.log('🌐 Respondiendo desde Perplexity');
      }

      // Paso 3: Guardar en historial
      await this.historyManager.addMessage(this.sessionId, query, answer);

      return {
        answer,
        source,
        query,
        ragResults: relevantDocs,
        citations,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      debugLogger.logError(error, 'al procesar consulta');
      console.error('❌ Error al procesar consulta:', error.message);
      throw error;
    }
  }

  /**
   * Generar respuesta usando RAG
   * @param {string} query - Pregunta del usuario
   * @param {Array} documents - Documentos relevantes
   * @returns {Promise<Object>} - Respuesta generada
   */
  async generateAnswerFromRAG(query, documents) {
    // Construir contexto de documentos
    const context = documents
      .map((doc, idx) => `[Documento ${idx + 1}] ${doc.content}`)
      .join('\n\n');

    // Obtener historial de conversación
    const history = await this.historyManager.getFormattedHistory(this.sessionId);
    const historyText = history
      .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
      .join('\n');

    // Crear prompt con contexto del agente
    const systemContext = `Eres ${config.agent.name}, ${config.agent.role}.

TU ROL Y PERSONALIDAD:
- Eres amable, profesional y servicial
- Tu objetivo es ayudar a estudiantes y personas interesadas en los cursos y servicios del CEC-EPN
- Siempre respondes en español
- Si te saludan, responde de manera cordial como representante del CEC-EPN
- Si no tienes información específica, indícalo honestamente

INSTRUCCIONES:
- Usa el contexto proporcionado para responder con precisión
- Mantén la continuidad con el historial de conversación
- Si la información no está en el contexto, puedes usar tu conocimiento general del CEC-EPN`;

    const prompt = `${systemContext}

HISTORIAL DE CONVERSACIÓN:
${historyText || 'Esta es la primera interacción.'}

CONTEXTO DISPONIBLE:
${context}

PREGUNTA DEL USUARIO: ${query}

RESPUESTA (como ${config.agent.name}):`;

    debugLogger.logPrompt('RAG', prompt);

    // Generar respuesta con OpenAI usando callbacks de LangChain
    const response = await this.llm.invoke(prompt, {
      callbacks: langChainCallbacks.getCallbacks()
    });

    return {
      answer: response.content,
      documentsUsed: documents.length
    };
  }

  /**
   * Obtener historial de la sesión
   * @returns {Promise<Array>} - Historial de mensajes
   */
  async getHistory() {
    return await this.historyManager.getFormattedHistory(this.sessionId);
  }

  /**
   * Limpiar historial de la sesión
   */
  clearHistory() {
    this.historyManager.clearSession(this.sessionId);
  }

  /**
   * Agregar documentos al RAG
   * @param {Array<string>} texts - Textos a agregar
   * @param {Array<Object>} metadatas - Metadatos opcionales
   */
  async addDocuments(texts, metadatas = []) {
    if (!this.initialized) {
      throw new Error('Agente no inicializado');
    }
    return await this.pineconeService.addDocuments(texts, metadatas);
  }
}
