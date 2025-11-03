import { BufferMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';

export class ConversationHistoryManager {
  constructor(maxMessages = 10) {
    this.maxMessages = maxMessages;
    this.sessions = new Map();
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
        outputKey: 'output'
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
    await memory.saveContext(
      { input: userMessage },
      { output: aiMessage }
    );

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
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<Array>} - Array de mensajes en formato API
   */
  async getFormattedHistory(sessionId) {
    const messages = await this.getHistory(sessionId);

    return messages.map(msg => {
      if (msg._getType() === 'human') {
        return { role: 'user', content: msg.content };
      } else if (msg._getType() === 'ai') {
        return { role: 'assistant', content: msg.content };
      }
      return { role: 'system', content: msg.content };
    });
  }

  /**
   * Limpiar historial antiguo
   * @param {string} sessionId - ID de la sesión
   */
  async trimHistory(sessionId) {
    const messages = await this.getHistory(sessionId);

    if (messages.length > this.maxMessages) {
      const memory = this.getMemory(sessionId);
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
        outputKey: 'output'
      });

      this.sessions.set(sessionId, newMemory);
    }
  }

  /**
   * Limpiar historial de una sesión
   * @param {string} sessionId - ID de la sesión
   */
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Limpiar todas las sesiones
   */
  clearAll() {
    this.sessions.clear();
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
      lastUpdate: new Date().toISOString()
    };
  }
}
