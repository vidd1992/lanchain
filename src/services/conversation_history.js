import { BufferMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';
import { SupabaseService } from './supabase_service.js';

export class ConversationHistoryManager {
  constructor(maxMessages = 10, useSummary = true, idEmpresa = 'default') {
    this.maxMessages = maxMessages;
    this.useSummary = useSummary;
    this.idEmpresa = idEmpresa; // ID de la empresa
    this.sessions = new Map(); // Caché en memoria
    this.summaries = new Map();
    this.supabase = new SupabaseService(); // Servicio de Supabase
    this.supabase.initialize(); // Inicializar Supabase
  }

  /**
   * Obtener o crear memoria para una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {BufferMemory} - Memoria de la sesión
   */
  getMemory(sessionId) {
    if (!this.sessions.has(sessionId)) {
      const chatHistory = new ChatMessageHistory();
      const memory = new BufferMemory({
        chatHistory: chatHistory,
        returnMessages: true,
        memoryKey: 'chat_history',
        inputKey: 'input',
        outputKey: 'output',
      });
      this.sessions.set(sessionId, memory);
    }
    return this.sessions.get(sessionId);
  }

  /**
   * Agregar mensaje al historial
   * @param {string} sessionId - ID de la sesión
   * @param {string} userMessage - Mensaje del usuario
   * @param {string} aiMessage - Respuesta del AI
   * @param {Object} metadata - Metadata adicional (source, score, etc.)
   */
  async addMessage(sessionId, userMessage, aiMessage, metadata = {}) {
    // 1. Guardar en memoria (caché rápido)
    const memory = this.getMemory(sessionId);
    await memory.saveContext({ input: userMessage }, { output: aiMessage });

    // 2. Guardar en Supabase (persistencia) - async, no bloquea
    if (this.supabase.initialized) {
      // Guardar mensaje del usuario
      this.supabase
        .saveMessage(sessionId, this.idEmpresa, 'user', userMessage, {})
        .catch(err => console.error('Error guardando mensaje usuario:', err.message));

      // Guardar respuesta del asistente
      this.supabase
        .saveMessage(sessionId, this.idEmpresa, 'assistant', aiMessage, metadata)
        .catch(err => console.error('Error guardando mensaje asistente:', err.message));
    }

    // 3. Limpiar historial si excede el máximo
    await this.trimHistory(sessionId);
  }

  /**
   * Obtener historial de conversación (caché + Supabase)
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Array>} - Array de mensajes
   */
  async getHistory(sessionId) {
    // 1. Intentar obtener desde caché en memoria
    const memory = this.getMemory(sessionId);
    const history = await memory.loadMemoryVariables({});
    const cachedMessages = history.chat_history || [];

    // Si hay mensajes en caché, retornarlos
    if (cachedMessages.length > 0) {
      return cachedMessages;
    }

    // 2. Si no hay en caché y Supabase está habilitado, cargar desde DB
    if (this.supabase.initialized) {
      try {
        const dbMessages = await this.supabase.getHistory(
          sessionId,
          this.idEmpresa,
          this.maxMessages
        );

        // Cargar mensajes en el caché
        if (dbMessages.length > 0) {
          const chatHistory = new ChatMessageHistory();
          for (const msg of dbMessages) {
            if (msg.role === 'user') {
              await chatHistory.addMessage({
                content: msg.content,
                _getType: () => 'human',
              });
            } else {
              await chatHistory.addMessage({
                content: msg.content,
                _getType: () => 'ai',
              });
            }
          }

          // Actualizar memoria con mensajes de DB
          const newMemory = new BufferMemory({
            chatHistory: chatHistory,
            returnMessages: true,
            memoryKey: 'chat_history',
            inputKey: 'input',
            outputKey: 'output',
          });
          this.sessions.set(sessionId, newMemory);

          // Retornar el historial
          const loaded = await newMemory.loadMemoryVariables({});
          return loaded.chat_history || [];
        }
      } catch (error) {
        console.error('Error cargando historial desde Supabase:', error.message);
      }
    }

    // 3. Si no hay nada, retornar array vacío
    return [];
  }

  /**
   * Obtener historial en formato para Perplexity/OpenAI
   * Incluye el summary de conversaciones anteriores si existe
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Array>} - Array de mensajes en formato API
   */
  async getFormattedHistory(sessionId) {
    const messages = await this.getHistory(sessionId);

    const formatted = messages.map(msg => {
      if (msg._getType() === 'human') {
        return { role: 'user', content: msg.content };
      } else if (msg._getType() === 'ai') {
        return { role: 'assistant', content: msg.content };
      }
      return { role: 'system', content: msg.content };
    });

    // Agregar summary al principio si existe
    const summary = this.summaries.get(sessionId);
    if (summary) {
      formatted.unshift({
        role: 'system',
        content: `📝 Resumen de conversación anterior: ${summary}`,
      });
    }

    return formatted;
  }

  /**
   * Limpiar historial antiguo, creando summary si está habilitado
   * @param {string} sessionId - ID de la sesión
   */
  async trimHistory(sessionId) {
    const messages = await this.getHistory(sessionId);

    if (messages.length > this.maxMessages) {
      if (this.useSummary) {
        // Crear resumen de mensajes antiguos antes de eliminarlos
        await this.createSummary(sessionId, messages);
      }

      const toKeep = messages.slice(-this.maxMessages);

      // Recrear la memoria con solo los mensajes recientes
      const chatHistory = new ChatMessageHistory();
      for (const msg of toKeep) {
        await chatHistory.addMessage(msg);
      }

      const newMemory = new BufferMemory({
        chatHistory: chatHistory,
        returnMessages: true,
        memoryKey: 'chat_history',
        inputKey: 'input',
        outputKey: 'output',
      });

      this.sessions.set(sessionId, newMemory);
      console.log(
        `📝 Historial de sesión ${sessionId} recortado (${messages.length} → ${toKeep.length} mensajes)`
      );
    }
  }

  /**
   * Crear resumen de conversación para mensajes antiguos
   * @param {string} sessionId - ID de la sesión
   * @param {Array} messages - Mensajes a resumir
   */
  async createSummary(sessionId, messages) {
    try {
      const messagesToSummarize = messages.slice(0, messages.length - this.maxMessages);

      if (messagesToSummarize.length === 0) {
        return;
      }

      console.log(
        `📄 Creando resumen de ${messagesToSummarize.length} mensajes antiguos...`
      );

      // Crear LLM para generar summary
      const llm = new ChatOpenAI({
        openAIApiKey: config.openai.apiKey,
        modelName: 'gpt-4o-mini', // Modelo más económico para summaries
        temperature: 0.3,
      });

      // Formatear mensajes para el prompt
      const conversationText = messagesToSummarize
        .map(msg => {
          const role = msg._getType() === 'human' ? 'Usuario' : 'Asistente';
          return `${role}: ${msg.content}`;
        })
        .join('\n');

      // Prompt para generar summary
      const summaryPrompt = `Resume de forma concisa la siguiente conversación, enfocándote en:
- Temas principales discutidos
- Preguntas clave del usuario
- Información importante proporcionada
- Cualquier decisión o acción pendiente

CONVERSACIÓN:
${conversationText}

RESUMEN CONCISO:`;

      const response = await llm.invoke(summaryPrompt);
      const summary =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      // Guardar o actualizar summary (memoria + Supabase)
      const existingSummary = this.summaries.get(sessionId);
      let finalSummary = summary;

      if (existingSummary) {
        // Si ya hay un summary, combinarlos
        const combinedPrompt = `Combina estos dos resúmenes en uno solo:

RESUMEN ANTERIOR:
${existingSummary}

NUEVO RESUMEN:
${summary}

RESUMEN COMBINADO:`;

        const combinedResponse = await llm.invoke(combinedPrompt);
        finalSummary = combinedResponse.content;
        this.summaries.set(sessionId, finalSummary);
      } else {
        this.summaries.set(sessionId, finalSummary);
      }

      // Guardar en Supabase
      if (this.supabase.initialized) {
        await this.supabase.saveSummary(sessionId, this.idEmpresa, finalSummary);
      }

      console.log(`✅ Resumen creado para sesión ${sessionId}`);
    } catch (error) {
      console.error('❌ Error al crear summary:', error.message);
    }
  }

  /**
   * Limpiar historial de una sesión
   * @param {string} sessionId - ID de la sesión
   */
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
    this.summaries.delete(sessionId); // También limpiar summary
  }

  /**
   * Limpiar todas las sesiones
   */
  clearAll() {
    this.sessions.clear();
    this.summaries.clear(); // También limpiar todos los summaries
  }

  /**
   * Obtener resumen del historial
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Object>} - Resumen de la sesión
   */
  async getSessionSummary(sessionId) {
    const messages = await this.getHistory(sessionId);
    return {
      sessionId,
      messageCount: messages.length,
      lastUpdate: new Date().toISOString(),
    };
  }
}
