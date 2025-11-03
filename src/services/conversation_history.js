import { BufferMemory, ConversationSummaryMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { ChatOpenAI } from '@langchain/openai';
import { config } from '../config/env.js';

export class ConversationHistoryManager {
  constructor(maxMessages = 10, useSummary = true) {
    this.maxMessages = maxMessages;
    this.useSummary = useSummary; // Usar summary para conversaciones largas
    this.sessions = new Map();
    this.summaries = new Map(); // Almacenar resúmenes por sesión
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
   */
  async addMessage(sessionId, userMessage, aiMessage) {
    const memory = this.getMemory(sessionId);
    await memory.saveContext({ input: userMessage }, { output: aiMessage });

    // Limpiar historial si excede el máximo
    await this.trimHistory(sessionId);
  }

  /**
   * Obtener historial de conversación
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Array>} - Array de mensajes
   */
  async getHistory(sessionId) {
    const memory = this.getMemory(sessionId);
    const history = await memory.loadMemoryVariables({});
    return history.chat_history || [];
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
      const summary = response.content;

      // Guardar o actualizar summary
      const existingSummary = this.summaries.get(sessionId);
      if (existingSummary) {
        // Si ya hay un summary, combinarlos
        const combinedPrompt = `Combina estos dos resúmenes en uno solo:

RESUMEN ANTERIOR:
${String(existingSummary)}

NUEVO RESUMEN:
${String(summary)}

RESUMEN COMBINADO:`;

        const combinedResponse = await llm.invoke(combinedPrompt);
        this.summaries.set(sessionId, combinedResponse.content);
      } else {
        this.summaries.set(sessionId, summary);
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
