import { ChatOpenAI } from '@langchain/openai';
import { PineconeService } from '../services/pinecone_service.js';
import { PerplexityService } from '../services/perplexity_service.js';
import { ConversationHistoryManager } from '../services/conversation_history.js';
import { IntentDetector } from '../utils/intent_detector.js';
import { ConversationalRAGChain } from '../chains/conversational_rag_chain.js';
import { MetricsTracker } from '../utils/metrics_tracker.js';
import { debugLogger } from '../utils/debug_logger.js';
import { langChainCallbacks } from '../utils/langchain_callbacks.js';
import { config } from '../config/env.js';

export class RAGAgent {
  constructor(sessionId = 'default', useLangChainChains = false) {
    this.sessionId = sessionId;
    this.pineconeService = new PineconeService();
    this.perplexityService = new PerplexityService();
    this.historyManager = new ConversationHistoryManager();
    this.intentDetector = new IntentDetector();
    this.metricsTracker = new MetricsTracker(); // Sistema de métricas
    this.useLangChainChains = useLangChainChains; // Flag para usar chains

    // Configurar LLM con verbose si está activado
    this.llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: config.openai.model,
      temperature: 0.3, // Temperatura más baja para mayor precisión
      verbose: process.env.LANGCHAIN_VERBOSE === 'true',
    });

    this.ragChain = null; // Chain de RAG conversacional (si se usa)
    this.initialized = false;
  }
  /**
   * Inicializar el agente
   */
  async initialize() {
    try {
      console.log('🚀 Inicializando RAG Agent...');
      await this.pineconeService.initialize();

      // Si se configuró para usar LangChain Chains, crear el chain
      if (this.useLangChainChains) {
        console.log('⛓️  Creando LangChain ConversationalRetrievalChain...');
        this.ragChain = new ConversationalRAGChain(
          this.llm,
          this.pineconeService.vectorStore,
          this.historyManager
        );
        this.ragChain.createChain();
        console.log('✅ Chain de RAG conversacional creado');
      }

      this.initialized = true;
      const mode = this.useLangChainChains
        ? '(modo: LangChain Chains)'
        : '(modo: Custom)';
      console.log(`✅ RAG Agent listo ${mode}`);
    } catch (error) {
      console.error('❌ Error al inicializar RAG Agent:', error.message);
      throw error;
    }
  }

  /**
   * Procesar una consulta del usuario
   * Delega a la implementación con o sin LangChain Chains según configuración
   * @param {string} query - La pregunta del usuario
   * @returns {Promise<Object>} - Respuesta del agente
   */
  async query(query) {
    if (!this.initialized) {
      throw new Error('Agente no inicializado. Llama a initialize() primero.');
    }

    // Delegar según el modo configurado
    if (this.useLangChainChains) {
      return await this.queryWithChains(query);
    } else {
      return await this.queryCustom(query);
    }
  }

  /**
   * Procesar consulta usando LangChain Chains (ConversationalRetrievalQAChain)
   * @param {string} query - La pregunta del usuario
   * @returns {Promise<Object>} - Respuesta del agente
   */
  async queryWithChains(query) {
    const startTime = Date.now(); // Iniciar tracking de latencia

    try {
      debugLogger.startTimer();
      console.log(`\n📝 Consulta: "${query}" [Chain Mode]`);

      // Paso 1: Detectar intenciones simples (saludos, despedidas, etc.)
      const simpleIntent = this.intentDetector.processSimpleIntent(query);

      if (simpleIntent) {
        const response = await this.handleSimpleIntent(simpleIntent, query);
        const latency = Date.now() - startTime;
        this.metricsTracker.trackQuery(query, response, latency);
        return response;
      }

      // Paso 2: Usar RAG Chain
      console.log('⛓️  Procesando con ConversationalRetrievalChain...');
      const ragResponse = await this.ragChain.invoke(this.sessionId, query);

      // Paso 3: Evaluar calidad de respuesta RAG
      const hasGoodResults = this.ragChain.hasGoodResults(ragResponse.sourceDocuments);

      if (hasGoodResults) {
        console.log(
          `✅ Chain respondió con ${ragResponse.sourceDocuments.length} documentos`
        );

        // El historial ya fue guardado dentro de ragChain.invoke()
        debugLogger.logResponse('RAG Chain', ragResponse.answer);

        const response = {
          answer: ragResponse.answer,
          source: 'rag-chain',
          query,
          ragResults: ragResponse.sourceDocuments,
          citations: [],
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
        };

        // Trackear métricas
        const latency = Date.now() - startTime;
        this.metricsTracker.trackQuery(query, response, latency);

        return response;
      } else {
        // Fallback a Perplexity
        console.log('⚠️  Chain sin resultados relevantes, usando Perplexity...');
        const conversationHistory = await this.historyManager.getFormattedHistory(
          this.sessionId
        );
        const perplexityResponse = await this.perplexityService.query(
          query,
          conversationHistory
        );

        await this.historyManager.addMessage(
          this.sessionId,
          query,
          perplexityResponse.answer
        );

        debugLogger.logResponse('Perplexity', perplexityResponse.answer);

        const response = {
          answer: perplexityResponse.answer,
          source: 'perplexity',
          query,
          ragResults: [],
          citations: perplexityResponse.citations,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
        };

        // Trackear métricas
        const latency = Date.now() - startTime;
        this.metricsTracker.trackQuery(query, response, latency);

        return response;
      }
    } catch (error) {
      // Trackear error
      this.metricsTracker.trackError(error, { query, mode: 'chains' });
      debugLogger.logError(error, 'al procesar consulta con chains');
      console.error('❌ Error al procesar consulta:', error.message);
      throw error;
    }
  }

  /**
   * Procesar consulta con implementación custom (mejorada con paralelización y CoT)
   * @param {string} query - La pregunta del usuario
   * @returns {Promise<Object>} - Respuesta del agente
   */
  async queryCustom(query) {
    const startTime = Date.now(); // Iniciar tracking de latencia

    try {
      debugLogger.startTimer();
      console.log(`\n📝 Consulta: "${query}" [Custom Mode]`);

      // Paso 0: Detectar intenciones simples (saludos, despedidas, etc.)
      const simpleIntent = this.intentDetector.processSimpleIntent(query);

      if (simpleIntent) {
        const response = await this.handleSimpleIntent(simpleIntent, query);
        const latency = Date.now() - startTime;
        this.metricsTracker.trackQuery(query, response, latency);
        return response;
      }

      // Paso 1: PARALELIZAR búsqueda RAG + obtención de historial
      console.log('🔍 Buscando en RAG y cargando historial (paralelo)...');
      const [ragResults, conversationHistory] = await Promise.all([
        this.pineconeService.searchSimilarDocuments(query),
        this.historyManager.getFormattedHistory(this.sessionId),
      ]);

      debugLogger.logRAGSearch(query, ragResults);

      // Paso 2: Evaluar si los resultados del RAG son adecuados
      const hasRelevantResults = this.pineconeService.hasRelevantResults(ragResults);
      const bestScore = ragResults.length > 0 ? ragResults[0].score : null;

      debugLogger.logRAGDecision(
        hasRelevantResults,
        config.rag.similarityThreshold,
        bestScore
      );

      let answer,
        source,
        citations = [],
        relevantDocs = [];

      if (hasRelevantResults) {
        // Usar RAG para responder (historial ya está cargado)
        console.log(
          `✅ Encontrados ${
            ragResults.length
          } documentos relevantes (score: ${ragResults[0].score.toFixed(3)})`
        );

        const ragAnswer = await this.generateAnswerFromRAG(
          query,
          ragResults,
          conversationHistory
        );
        answer = ragAnswer.answer;
        source = 'rag';
        relevantDocs = ragResults;

        debugLogger.logResponse('RAG (OpenAI)', answer);
        console.log('📚 Respondiendo desde RAG');
      } else {
        // Fallback a Perplexity (historial ya está cargado)
        console.log('⚠️  No se encontraron resultados relevantes en RAG');
        console.log('🌐 Consultando Perplexity...');

        debugLogger.logMemory(conversationHistory);

        const perplexityResponse = await this.perplexityService.query(
          query,
          conversationHistory
        );

        answer = perplexityResponse.answer;
        source = 'perplexity';
        citations = perplexityResponse.citations;

        debugLogger.logResponse('Perplexity', answer);
        console.log('🌐 Respondiendo desde Perplexity');
      }

      // Paso 3: Guardar en historial
      await this.historyManager.addMessage(this.sessionId, query, answer);

      const response = {
        answer,
        source,
        query,
        ragResults: relevantDocs,
        citations,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
      };

      // Trackear métricas
      const latency = Date.now() - startTime;
      this.metricsTracker.trackQuery(query, response, latency);

      return response;
    } catch (error) {
      // Trackear error
      this.metricsTracker.trackError(error, { query, mode: 'custom' });
      debugLogger.logError(error, 'al procesar consulta');
      console.error('❌ Error al procesar consulta:', error.message);
      throw error;
    }
  }

  /**
   * Generar respuesta usando RAG
   * @param {string} query - Pregunta del usuario
   * @param {Array} documents - Documentos relevantes
   * @param {Array} conversationHistory - Historial de conversación (pre-cargado)
   * @returns {Promise<Object>} - Respuesta generada
   */
  async generateAnswerFromRAG(query, documents, conversationHistory = []) {
    // Construir contexto de documentos
    const context = documents
      .map((doc, idx) => `[Documento ${idx + 1}] ${doc.content}`)
      .join('\n\n');

    // Formatear historial de conversación (ya viene cargado)
    const historyText = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
      .join('\n');

    // Crear prompt con Chain of Thought y Few-Shot examples
    const systemContext = `Eres ${config.agent.name}, ${config.agent.role}.

TU ROL Y PERSONALIDAD:
- Eres amable, profesional y servicial
- Tu objetivo es ayudar a estudiantes y personas interesadas en los cursos y servicios del CEC-EPN
- Siempre respondes en español
- Si te saludan, responde de manera cordial como representante del CEC-EPN
- Si no tienes información específica, indícalo honestamente

METODOLOGÍA DE RESPUESTA (Chain of Thought):
1. ANALIZAR: Identifica qué información específica busca el usuario
2. BUSCAR: Revisa el contexto para encontrar información relevante
3. SINTETIZAR: Combina información de múltiples fuentes si es necesario
4. VERIFICAR: Asegúrate de que tu respuesta es consistente y precisa
5. RESPONDER: Genera una respuesta clara, completa y útil

FORMATO DE RESPUESTA:
- Responde de forma directa y concisa
- Si hay múltiples opciones, lístalas claramente
- Incluye detalles importantes (precios, fechas, requisitos, contactos)
- Si la información está incompleta, indícalo y sugiere cómo obtener más detalles`;

    // Few-Shot Examples para mejorar calidad
    const fewShotExamples = `
EJEMPLOS DE RESPUESTAS CORRECTAS:

Ejemplo 1:
Usuario: "¿Cuánto cuesta el curso de Python?"
Análisis: Busca precio de curso específico
Contexto encontrado: Documento menciona "Python Básico $300, Python Avanzado $500"
Respuesta: "Tenemos dos cursos de Python disponibles:
• Python Básico: $300
• Python Avanzado: $500
¿Te gustaría conocer más detalles sobre alguno de ellos?"

Ejemplo 2:
Usuario: "¿Qué horarios tienen?"
Análisis: Busca disponibilidad de horarios
Contexto encontrado: Info general de horarios pero sin especificar curso
Respuesta: "Ofrecemos cursos en horarios matutinos y nocturnos. Los horarios específicos dependen del curso que te interese. ¿Qué curso estás buscando?"`;

    const prompt = `${systemContext}

${fewShotExamples}

HISTORIAL DE CONVERSACIÓN:
${historyText || 'Esta es la primera interacción.'}

CONTEXTO DISPONIBLE:
${context}

PREGUNTA DEL USUARIO: ${query}

RESPUESTA (sigue la metodología Chain of Thought - piensa paso a paso antes de responder):`;

    debugLogger.logPrompt('RAG con CoT', prompt);

    // Generar respuesta con OpenAI usando callbacks de LangChain
    // Temperatura más baja para mayor precisión y menos alucinaciones
    const response = await this.llm.invoke(prompt, {
      callbacks: langChainCallbacks.getCallbacks(),
      temperature: 0.3,
    });

    return {
      answer: response.content,
      documentsUsed: documents.length,
    };
  }

  /**
   * Manejar intenciones simples (saludos, despedidas, etc.)
   * @param {Object} simpleIntent - Intención detectada
   * @param {string} query - Query original del usuario
   * @returns {Promise<Object>} - Respuesta directa
   */
  async handleSimpleIntent(simpleIntent, query) {
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
      timestamp: new Date().toISOString(),
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

  /**
   * Obtener reporte de métricas
   * @returns {Object} - Reporte consolidado de métricas
   */
  getMetricsReport() {
    return this.metricsTracker.getReport();
  }

  /**
   * Imprimir reporte de métricas en consola
   */
  printMetricsReport() {
    this.metricsTracker.printReport();
  }

  /**
   * Exportar métricas a archivo JSON
   * @param {string} filePath - Ruta del archivo de salida
   */
  async exportMetrics(filePath) {
    return await this.metricsTracker.exportToJSON(filePath);
  }

  /**
   * Resetear métricas
   */
  resetMetrics() {
    this.metricsTracker.reset();
  }
}
