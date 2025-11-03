import axios from 'axios';
import { config } from '../config/env.js';

export class PerplexityService {
  constructor() {
    this.apiUrl = 'https://api.perplexity.ai/chat/completions';
    this.model = config.perplexity.model;
  }

  /**
   * Realizar una consulta a Perplexity
   * @param {string} query - La pregunta del usuario
   * @param {Array} conversationHistory - Historial de conversación (opcional)
   * @returns {Promise<Object>} - Respuesta de Perplexity
   */
  async query(query, conversationHistory = []) {
    try {
      // Construir mensajes con contexto del agente
      const systemPrompt = `Eres ${config.agent.name}, ${config.agent.role}.

TU ROL Y PERSONALIDAD:
- Eres amable, profesional y servicial
- Tu objetivo es ayudar a estudiantes y personas interesadas en los cursos y servicios del CEC-EPN
- Siempre respondes en español
- Proporcionas información precisa y actualizada usando búsqueda web
- Si te saludan, responde de manera cordial como representante del CEC-EPN

INSTRUCCIONES:
- Responde de manera clara y concisa
- Si la pregunta es sobre el CEC-EPN y no tienes información específica, indícalo
- Mantén un tono profesional pero cercano`;

      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...conversationHistory,
        {
          role: 'user',
          content: query
        }
      ];

      // Preparar el payload con web_search_domains si está configurado
      const payload = {
        model: this.model,
        messages: messages,
        temperature: 0.2,
        max_tokens: 1000
      };

      // Agregar dominios de búsqueda si están configurados en el .env
      if (config.perplexity.searchDomains && config.perplexity.searchDomains.length > 0) {
        payload.search_domain_filter = config.perplexity.searchDomains;
        console.log(`🔍 Perplexity buscará en dominios específicos: ${config.perplexity.searchDomains.join(', ')}`);
      }

      const response = await axios.post(
        this.apiUrl,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${config.perplexity.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const answer = response.data.choices[0].message.content;
      const citations = this.extractCitations(response.data);

      return {
        answer: answer,
        citations: citations,
        source: 'perplexity',
        model: this.model
      };
    } catch (error) {
      console.error('Error al consultar Perplexity:', error.response?.data || error.message);
      throw new Error(`Perplexity API error: ${error.message}`);
    }
  }

  /**
   * Extraer citas de la respuesta de Perplexity
   * @param {Object} responseData - Datos de respuesta de Perplexity
   * @returns {Array} - Array de citas
   */
  extractCitations(responseData) {
    try {
      // Perplexity incluye citations en algunos modelos
      if (responseData.citations) {
        return responseData.citations;
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Verificar si el servicio está disponible
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await this.query('test');
      return true;
    } catch (error) {
      return false;
    }
  }
}
