import { ChatOpenAI } from '@langchain/openai';
import { PineconeService } from '../services/pinecone_service.js';
import { PerplexityService } from '../services/perplexity_service.js';
import { ConversationHistoryManager } from '../services/conversation_history.js';
import { IntentDetector } from '../utils/intent_detector.js';
import { ConversationalRAGChain } from '../chains/conversational_rag_chain.js';
import { QueryTransformChain } from '../chains/query_transform_chain.js';
import { MetricsTracker } from '../utils/metrics_tracker.js';
import { debugLogger } from '../utils/debug_logger.js';
import { ragLogger } from '../utils/rag_logger.js';
import { langChainCallbacks } from '../utils/langchain_callbacks.js';
import { config } from '../config/env.js';
import { formatResponse } from '../utils/response_formatter.js';

export class RAGAgent {
  constructor(sessionId = 'default', useLangChainChains = false, idEmpresa = 'default') {
    this.sessionId = sessionId;
    this.idEmpresa = idEmpresa; // ID de la empresa
    this.pineconeService = new PineconeService();
    this.perplexityService = new PerplexityService();
    this.historyManager = new ConversationHistoryManager(10, true, idEmpresa); // Pasar idEmpresa
    this.intentDetector = new IntentDetector();
    this.queryTransformer = new QueryTransformChain(); // Query transformation con LLM
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
      console.log(`📇 Índice de Pinecone: "${this.pineconeService.indexName}"`);

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
          answer: formatResponse(ragResponse.answer), // Aplicar formato HTML si está habilitado
          source: 'rag-chain',
          query,
          ragResults: ragResponse.sourceDocuments,
          citations: [],
          sessionId: this.sessionId,
          idEmpresa: this.idEmpresa,
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

        let finalAnswer = perplexityResponse.answer;

        // Si está habilitado, procesar respuesta con GPT-4
        if (config.perplexity.useGptProcessing) {
          const processedResponse = await this.processPerplexityWithGPT(
            perplexityResponse.answer,
            query,
            conversationHistory
          );
          finalAnswer = processedResponse.answer;
          console.log('✅ Respuesta de Perplexity procesada por GPT-4');
        } else {
          console.log(
            'ℹ️  Usando respuesta directa de Perplexity (sin procesamiento GPT)'
          );
        }

        debugLogger.logResponse('Perplexity', finalAnswer);

        const response = {
          answer: formatResponse(finalAnswer), // Aplicar formato HTML si está habilitado
          source: config.perplexity.useGptProcessing ? 'perplexity+gpt' : 'perplexity',
          query,
          ragResults: [],
          citations: perplexityResponse.citations,
          sessionId: this.sessionId,
          idEmpresa: this.idEmpresa,
          timestamp: new Date().toISOString(),
        };

        // Guardar en historial de forma NO BLOQUEANTE (en background)
        this.historyManager
          .addMessage(this.sessionId, query, finalAnswer)
          .catch(error =>
            console.error('❌ Error guardando en historial:', error.message)
          );

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
      // Log inicial de la query
      ragLogger.startQuery(query, this.sessionId);

      // Detectar intenciones simples
      const simpleIntent = this.intentDetector.processSimpleIntent(query);

      if (simpleIntent) {
        const response = await this.handleSimpleIntent(simpleIntent, query);
        const latency = Date.now() - startTime;
        this.metricsTracker.trackQuery(query, response, latency);
        return response;
      }

      // Paso 1: Cargar historial primero (necesario para transformación contextual)
      const conversationHistory = await this.historyManager.getFormattedHistory(
        this.sessionId
      );

      // Log del contexto cargado (incluyendo resumen si existe)
      const hasSummary = conversationHistory.some(msg => msg.role === 'system' && msg.content.includes('Resumen'));
      const summaryContent = hasSummary ? conversationHistory.find(msg => msg.role === 'system')?.content || '' : '';
      ragLogger.logContext(conversationHistory, hasSummary, summaryContent);

      // Paso 2: Transformar query con contexto usando LangChain
      const queryTransform = await this.queryTransformer.transform(
        query,
        conversationHistory
      );

      // Log de transformación
      ragLogger.logQueryTransform(
        queryTransform.original,
        queryTransform.transformed,
        queryTransform.intent
      );

      // Paso 3: Búsqueda en RAG con query transformada
      const ragResults = await this.pineconeService.searchSimilarDocuments(
        queryTransform.transformed // ← Usar query transformada
      );

      // Log de búsqueda en Pinecone
      ragLogger.logPineconeSearch(
        queryTransform.transformed,
        ragResults,
        config.rag.similarityThreshold
      );

      // Paso 2: Evaluar si los resultados del RAG son adecuados
      const hasRelevantResults = this.pineconeService.hasRelevantResults(ragResults);
      const bestScore = ragResults.length > 0 ? ragResults[0].score : null;

      // Log de evaluación de resultados
      ragLogger.logRAGDecision(
        hasRelevantResults,
        config.rag.similarityThreshold,
        bestScore
      );

      let answer,
        source,
        citations = [],
        relevantDocs = [];

      if (hasRelevantResults) {
        // Log de generación RAG
        const contextSize = ragResults.reduce((sum, doc) => sum + doc.content.length, 0);
        ragLogger.logRAGGeneration(ragResults.length, contextSize, conversationHistory.length);

        const ragAnswer = await this.generateAnswerFromRAG(
          query,
          ragResults,
          conversationHistory
        );

        // ⚠️ VALIDACIÓN DESACTIVADA TEMPORALMENTE PARA TESTING
        // Usar directamente la respuesta del RAG sin validación adicional
        answer = ragAnswer.answer;
        source = 'rag';
        relevantDocs = ragResults;
        
        // Calcular score promedio
        const avgScore = ragResults.length > 0 
          ? ragResults.reduce((sum, doc) => sum + doc.score, 0) / ragResults.length
          : null;

        /* VALIDACIÓN COMENTADA - Descomentar si se necesita validación estricta
        const isRagResponseReliable = await this.validateRagResponse(
          ragAnswer.answer,
          query,
          ragResults
        );

        if (isRagResponseReliable) {
          answer = ragAnswer.answer;
          source = 'rag';
          relevantDocs = ragResults;
          debugLogger.logResponse('RAG (OpenAI)', answer);
          console.log('✅ Respuesta RAG validada como confiable');
          console.log('📚 Respondiendo desde RAG');
        } else {
          console.log('⚠️  Respuesta RAG no es suficientemente confiable');
          console.log('🌐 Buscando información actualizada en Perplexity...');

          const perplexityResponse = await this.perplexityService.query(
            query,
            conversationHistory
          );

          // Si está habilitado, procesar respuesta con GPT-4
          if (config.perplexity.useGptProcessing) {
            const processedResponse = await this.processPerplexityWithGPT(
              perplexityResponse.answer,
              query,
              conversationHistory
            );
            answer = processedResponse.answer;
            source = 'rag-fallback-perplexity+gpt';
            console.log('✅ Usando Perplexity (procesado por GPT-4) como fallback');
          } else {
            answer = perplexityResponse.answer;
            source = 'rag-fallback-perplexity';
            console.log('✅ Usando Perplexity directo como fallback');
          }

          citations = perplexityResponse.citations;
          relevantDocs = ragResults; // Mantener los docs que se intentaron usar

          debugLogger.logResponse('Perplexity (Fallback)', answer);
          console.log('🌐 Respondiendo desde Perplexity (fallback inteligente)');
        }
        */
      } else {
        // Fallback a Perplexity (historial ya está cargado)
        debugLogger.logMemory(conversationHistory);

        const perplexityResponse = await this.perplexityService.query(
          query,
          conversationHistory
        );

        // Si está habilitado, procesar respuesta con GPT-4
        if (config.perplexity.useGptProcessing) {
          const processedResponse = await this.processPerplexityWithGPT(
            perplexityResponse.answer,
            query,
            conversationHistory
          );
          answer = processedResponse.answer;
          source = 'perplexity+gpt';
        } else {
          answer = perplexityResponse.answer;
          source = 'perplexity';
        }

        citations = perplexityResponse.citations;
        debugLogger.logResponse('Perplexity', answer);
      }

      // Paso 3: Preparar respuesta (retornar rápido)
      const response = {
        answer: formatResponse(answer), // Aplicar formato HTML si está habilitado
        source,
        query,
        ragResults: relevantDocs,
        citations,
        sessionId: this.sessionId,
        idEmpresa: this.idEmpresa,
        timestamp: new Date().toISOString(),
      };

      // Log final de respuesta
      const avgScore = relevantDocs.length > 0
        ? relevantDocs.reduce((sum, doc) => sum + doc.score, 0) / relevantDocs.length
        : null;
      ragLogger.logResponse(source, answer, avgScore);

      // Guardar en historial de forma NO BLOQUEANTE (en background)
      // Esto permite que el summary se ejecute sin retrasar la respuesta al usuario
      this.historyManager
        .addMessage(this.sessionId, query, answer)
        .catch(error => console.error('❌ Error guardando en historial:', error.message));

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

    // Logging del contexto que se enviará al agente
    console.log('\n' + '═'.repeat(80));
    console.log('📝 CONTEXTO ENVIADO AL AGENTE (RAG)');
    console.log('═'.repeat(80));
    console.log(`📊 Total de documentos: ${documents.length}`);
    console.log(`📏 Tamaño del contexto: ${context.length} caracteres`);
    console.log('\n🔍 CONTENIDO COMPLETO DEL CONTEXTO:');
    console.log('-'.repeat(80));
    console.log(context);
    console.log('-'.repeat(80));
    console.log('═'.repeat(80) + '\n');

    // Formatear historial de conversación (ya viene cargado)
    const historyText = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
      .join('\n');

    // Detectar si es el primer mensaje de la conversación
    const isFirstMessage = conversationHistory.length === 0;

    // Crear prompt con Chain of Thought y Few-Shot examples
    const systemContext = `Eres ${config.agent.name}, ${config.agent.role}.

TU ROL Y PERSONALIDAD:
- Eres amable, profesional y servicial
- Tu objetivo es ayudar a estudiantes y personas interesadas en los cursos y servicios del CEC-EPN
- Siempre respondes en español
- Si no tienes información específica, indícalo honestamente

⚠️ IMPORTANTE - SALUDOS:
${
  isFirstMessage
    ? '- Este es el PRIMER mensaje de la conversación, saluda cordialmente al usuario'
    : '- Ya hay mensajes previos en la conversación, NO vuelvas a saludar con "Hola"'
}
- Si el usuario te saluda o se despide, responde apropiadamente sin importar si es el primer mensaje o no

⚠️ CRÍTICO - PRIORIDAD DEL PROTOCOLO DE ATENCIÓN:
Si el contexto incluye información de "protocolo.docx":
- ✅ PRIORIZA esta información sobre cualquier otra fuente
- ✅ USA detalles EXACTOS: URLs, números de teléfono, procedimientos específicos
- ✅ NO parafrasees ni inventes: copia la información tal cual está
- ✅ El protocolo contiene lineamientos oficiales y procedimientos autorizados
- ✅ Menciona explícitamente que la información viene del protocolo oficial
Ejemplos de info del protocolo:
- Portal de pagos: https://aps.cec-epn.edu.ec/
- Métodos de pago: tarjeta débito/crédito, banca electrónica, ventanillas
- Contactos oficiales: idiomas@cec-epn.edu.ec, ventas@cec-epn.edu.ec
- Horarios de atención, sedes, procedimientos de matrícula

⚠️ IMPORTANTE - TIPOS DE CURSOS:
El CEC-EPN maneja DOS tipos de cursos:

1. CURSOS PROGRAMADOS (con fechas específicas):
   - Tienen fecha de inicio y fin definida
   - Tienen horarios establecidos (ej: "Sábados 08:00-14:00")
   - Tienen período de matrículas específico
   - Precio fijo publicado
   - Se pueden inscribir directamente

2. CURSOS BAJO DEMANDA (sin fechas fijas):
   - Indican: "Se oferta bajo pedido", "Bajo demanda", "Para grupos e instituciones"
   - NO tienen fecha de inicio programada
   - Se coordinan según necesidad del cliente
   - Pueden ser para grupos empresariales o instituciones
   - Requieren contacto previo (ventas@cec-epn.edu.ec)

⚠️ CÓMO RESPONDER SEGÚN EL TIPO:
- Si es CURSO PROGRAMADO: Indica fechas, horarios, costo, período de matrícula
- Si es BAJO DEMANDA: Indica que se coordina según necesidad, proporciona contacto
- Si preguntan por fechas de un curso BAJO DEMANDA: Explica que no tiene fechas fijas y que deben contactar

METODOLOGÍA DE RESPUESTA (Chain of Thought):
1. ANALIZAR: Identifica qué información específica busca el usuario
2. IDENTIFICAR TIPO: Determina si el curso es programado o bajo demanda
3. BUSCAR: Revisa el contexto para encontrar información relevante
4. SINTETIZAR: Combina información de múltiples fuentes si es necesario
5. VERIFICAR: Asegúrate de que tu respuesta es consistente y precisa
6. RESPONDER: Genera una respuesta clara adaptada al tipo de curso

FORMATO DE RESPUESTA:
- Responde de forma directa y concisa
- SIEMPRE identifica si el curso es programado o bajo demanda
- Si hay múltiples opciones, lístalas claramente
- Incluye detalles importantes (precios, fechas, requisitos, contactos)
- Si la información está incompleta, indícalo y sugiere cómo obtener más detalles`;

    // Few-Shot Examples para mejorar calidad
    const fewShotExamples = `
EJEMPLOS DE RESPUESTAS CORRECTAS:

Ejemplo 1 - CURSO PROGRAMADO:
Usuario: "¿Cuándo inicia el curso de Excel 2?"
Análisis: Busca fecha de inicio
Tipo: CURSO PROGRAMADO (tiene fechas específicas)
Contexto encontrado: "Inicio: 8 noviembre 2025, Finaliza: 22 noviembre 2025, Horario: Sábados 08:00-14:00, Costo: $79"
Respuesta: "El curso de Excel 2: Funciones y Análisis de Datos es un curso PROGRAMADO que:
• Inicia: 8 de noviembre de 2025
• Finaliza: 22 de noviembre de 2025
• Horario: Sábados de 08:00 a 14:00
• Costo: USD $79.00
• Matrículas: Del 29 de septiembre al 5 de noviembre de 2025
¿Te gustaría inscribirte?"

Ejemplo 2 - CURSO BAJO DEMANDA:
Usuario: "¿Cuándo inicia el curso de Android Avanzado?"
Análisis: Busca fecha de inicio
Tipo: BAJO DEMANDA (sin fechas fijas)
Contexto encontrado: "Este curso se oferta bajo pedido, para grupos e instituciones"
Respuesta: "El curso de Android Avanzado es un curso BAJO DEMANDA, lo que significa que:
• NO tiene fecha de inicio programada
• Se coordina según las necesidades de grupos o instituciones
• Duración: 32 horas presenciales
• Se puede solicitar para grupos empresariales o instituciones

Para coordinar una capacitación, contáctanos en:
📧 ventas@cec-epn.edu.ec
📞 2525766 Ext. 122, 114, 156, 145"

Ejemplo 3 - USO DEL PROTOCOLO (PRIORIDAD):
Usuario: "¿Cómo realizo el pago del curso?"
Análisis: Pregunta sobre procedimiento de pago
Fuente: Protocolo de atención (protocolo.docx)
Respuesta: "Según el protocolo oficial de atención del CEC-EPN, puedes realizar el pago del curso de las siguientes maneras:

*Opciones de pago:*
- Tarjeta de débito o crédito en el portal en línea https://aps.cec-epn.edu.ec/
- A través de la Banca Electrónica del Banco Pichincha con número de contrapartida
- Mi vecino Pichincha con número de contrapartida
- Ventanillas del Banco Pichincha o Banco de Guayaquil con número de contrapartida

*Tipos de diferido con tarjeta de crédito:*
- Diferido Propio: sin intereses hacia el cliente
- Diferido Especial o plan pagos especial: sin intereses
- Diferido Preferente: con intereses pero con factor de interés menor

*Tarjetas aceptadas en ventanilla:*
Diners Club, Discover, Mastercard Pichincha, Visa Pichincha, Pacificard, American Express

Puedes ver el proceso completo en este video: https://www.youtube.com/watch?v=Hjb_f41_mQk

¿Necesitas ayuda con algún paso específico?"

Ejemplo 4 - COMPARACIÓN DE CURSOS:
Usuario: "¿Qué cursos de programación tienen?"
Respuesta: "Tenemos varios cursos de programación:

📅 CURSOS PROGRAMADOS (con fechas específicas):
• Python Essentials - Inicia: 5 nov - $120
• JavaScript Avanzado - Inicia: 10 dic - $150

📋 CURSOS BAJO DEMANDA (a coordinar):
• Android Avanzado - Para grupos/instituciones
• Java Empresarial - Para grupos/instituciones

¿Te interesa alguno en particular?"`;

    const prompt = `${systemContext}

${fewShotExamples}

HISTORIAL DE CONVERSACIÓN:
${historyText || 'Esta es la primera interacción.'}

CONTEXTO DISPONIBLE:
${context}

PREGUNTA DEL USUARIO: ${query}

RESPUESTA (sigue la metodología Chain of Thought - piensa paso a paso antes de responder):`;

    // Logging del prompt completo
    console.log('\n' + '═'.repeat(80));
    console.log('🤖 PROMPT COMPLETO ENVIADO A GPT-4');
    console.log('═'.repeat(80));
    console.log(`📏 Tamaño total del prompt: ${prompt.length} caracteres`);
    console.log(`📊 Historial incluido: ${conversationHistory.length} mensajes`);
    console.log(`❓ Query del usuario: "${query}"`);
    console.log('\n💬 PROMPT COMPLETO:');
    console.log('-'.repeat(80));
    console.log(prompt);
    console.log('-'.repeat(80));
    console.log('═'.repeat(80) + '\n');

    debugLogger.logPrompt('RAG con CoT', prompt);

    // Generar respuesta con OpenAI usando callbacks de LangChain
    // Temperatura más baja para mayor precisión y menos alucinaciones
    const response = await this.llm.invoke(prompt, {
      callbacks: langChainCallbacks.getCallbacks(),
      temperature: 0.3,
    });

    // Logging de la respuesta generada
    console.log('\n' + '═'.repeat(80));
    console.log('✅ RESPUESTA GENERADA POR GPT-4');
    console.log('═'.repeat(80));
    console.log(`📏 Tamaño de la respuesta: ${response.content.length} caracteres`);
    console.log(`📊 Documentos utilizados: ${documents.length}`);
    console.log('\n💬 RESPUESTA COMPLETA:');
    console.log('-'.repeat(80));
    console.log(response.content);
    console.log('-'.repeat(80));
    console.log('═'.repeat(80) + '\n');

    return {
      answer: response.content,
      documentsUsed: documents.length,
    };
  }

  /**
   * Validar si la respuesta del RAG es confiable o necesita fallback a Perplexity
   * @param {string} ragAnswer - Respuesta generada por RAG
   * @param {string} query - Query original del usuario
   * @param {Array} documents - Documentos recuperados
   * @returns {Promise<boolean>} - True si es confiable, False si necesita fallback
   */
  async validateRagResponse(ragAnswer, query, documents) {
    console.log('\n🔍 Validando confiabilidad de respuesta RAG...');

    // Construir contexto de los documentos
    const docsContext = documents
      .map((doc, idx) => `[Doc ${idx + 1}] ${doc.content.substring(0, 300)}...`)
      .join('\n\n');

    const validationPrompt = `Eres un validador de respuestas. Tu trabajo es determinar si una respuesta generada a partir de documentos es CONFIABLE o NO.

PREGUNTA DEL USUARIO: ${query}

DOCUMENTOS DISPONIBLES:
${docsContext}

RESPUESTA GENERADA:
${ragAnswer}

CRITERIOS DE VALIDACIÓN:
1. ¿La respuesta está basada en información presente en los documentos?
2. ¿La respuesta responde directamente a la pregunta del usuario?
3. ¿La respuesta contiene información específica (precios, fechas, horarios) que SÍ está en los documentos?
4. ¿La respuesta evita inventar o asumir información no presente?

CASOS DONDE NO ES CONFIABLE:
- Si la pregunta es sobre precios/fechas/horarios pero los documentos solo mencionan el tema superficialmente
- Si la respuesta tiene detalles específicos que NO aparecen en los documentos
- Si los documentos solo tienen información parcial o tangencial al tema
- Si la respuesta parece genérica o mezclada con información de otros temas

Responde SOLO con "CONFIABLE" o "NO_CONFIABLE" seguido de una breve razón (máximo 20 palabras).

Formato: CONFIABLE | razón
o
NO_CONFIABLE | razón`;

    try {
      const validation = await this.llm.invoke(validationPrompt, {
        temperature: 0.1,
      });

      const validationText = validation.content.trim().toUpperCase();
      const isReliable = validationText.startsWith('CONFIABLE');

      console.log(`📋 Validación: ${validation.content.trim()}`);

      return isReliable;
    } catch (error) {
      console.error('❌ Error en validación, usando RAG por defecto:', error.message);
      // En caso de error, confiar en el RAG (comportamiento actual)
      return true;
    }
  }

  /**
   * Procesar respuesta de Perplexity con GPT-4 para formateo y validación
   * @param {string} perplexityAnswer - Respuesta cruda de Perplexity
   * @param {string} originalQuery - Query original del usuario
   * @param {Array} conversationHistory - Historial de conversación
   * @returns {Promise<Object>} - Respuesta procesada
   */
  async processPerplexityWithGPT(
    perplexityAnswer,
    originalQuery,
    conversationHistory = []
  ) {
    console.log('🤖 Procesando respuesta de Perplexity con GPT-4...');

    const historyText = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `Eres ${config.agent.name}, ${config.agent.role}.

Tu trabajo es PROCESAR y FORMATEAR la información que Perplexity encontró en la web del CEC-EPN.

REGLAS CRÍTICAS:
1. NO inventes información - Usa SOLO lo que Perplexity proporcionó
2. Si Perplexity mencionó múltiples cursos/opciones, mantenlos separados (NO agrupes)
3. Organiza la información de forma clara y estructurada
4. Si hay información confusa o contradictoria, indícalo
5. Si faltan datos importantes, sugiere contactar al CEC-EPN

FORMATO PREFERIDO:
- Si hay MÚLTIPLES opciones: Lista cada una claramente con sus características
- Si es UN SOLO curso: Presenta todos los detalles disponibles
- Siempre incluye: nombre, precio, duración, modalidad (si están disponibles)
- Termina preguntando si necesita más información específica

NO HAGAS:
- ❌ Cambiar nombres de cursos
- ❌ Agrupar cursos diferentes como uno solo
- ❌ Inventar información que no está en la respuesta de Perplexity
- ❌ Decir "no se especifica" si el dato está presente`;

    const prompt = `${systemPrompt}

HISTORIAL DE CONVERSACIÓN:
${historyText || 'Esta es la primera interacción.'}

PREGUNTA ORIGINAL DEL USUARIO: ${originalQuery}

INFORMACIÓN QUE PERPLEXITY ENCONTRÓ EN LA WEB:
${perplexityAnswer}

Tu tarea: Procesa y formatea esta información de manera clara para el usuario. Responde directamente:`;

    debugLogger.logPrompt('Perplexity+GPT', prompt);

    const response = await this.llm.invoke(prompt, {
      callbacks: langChainCallbacks.getCallbacks(),
      temperature: 0.2, // Temperatura muy baja para ser fiel a la fuente
    });

    console.log('✅ Respuesta procesada por GPT-4');

    return {
      answer: response.content,
      processedByGPT: true,
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

    debugLogger.logResponse('Respuesta Directa', simpleIntent.answer);

    const response = {
      answer: formatResponse(simpleIntent.answer), // Aplicar formato HTML si está habilitado
      source: 'direct',
      intent: simpleIntent.intent,
      query,
      ragResults: [],
      citations: [],
      sessionId: this.sessionId,
      idEmpresa: this.idEmpresa,
      timestamp: new Date().toISOString(),
    };

    // Guardar en historial de forma NO BLOQUEANTE (en background)
    this.historyManager
      .addMessage(this.sessionId, query, simpleIntent.answer)
      .catch(error => console.error('❌ Error guardando en historial:', error.message));

    return response;
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
