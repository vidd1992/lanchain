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

      // Asegurar que los mensajes alternen entre user y assistant
      const filteredHistory = this.ensureAlternatingMessages(conversationHistory);

      const messages = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...filteredHistory,
        {
          role: 'user',
          content: query,
        },
      ];

      // Debug: mostrar mensajes que se enviarán
      if (process.env.DEBUG_MODE === 'true') {
        console.log('📤 Mensajes a Perplexity:');
        messages.forEach((msg, idx) => {
          console.log(`   ${idx + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
        });
      }

      // Preparar el payload con web_search_domains si está configurado
      const payload = {
        model: this.model,
        messages: messages,
        temperature: 0.2,
        max_tokens: 1000,
      };

      // Agregar dominios de búsqueda si están configurados en el .env
      if (config.perplexity.searchDomains && config.perplexity.searchDomains.length > 0) {
        payload.search_domain_filter = config.perplexity.searchDomains;
        console.log(
          `🔍 Perplexity buscará en dominios específicos: ${config.perplexity.searchDomains.join(
            ', '
          )}`
        );
      }

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          Authorization: `Bearer ${config.perplexity.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const answer = response.data.choices[0].message.content;
      const citations = this.extractCitations(response.data);

      return {
        answer: answer,
        citations: citations,
        source: 'perplexity',
        model: this.model,
      };
    } catch (error) {
      const errorData = error.response?.data || error.message;
      console.error('Error al consultar Perplexity:', errorData);

      // Si es un error de mensaje alternado, mostrar más detalles
      if (error.response?.status === 400) {
        console.error('❌ Error 400 - Verifica que los mensajes alternen correctamente');
        console.error('📋 Mensajes enviados:');
        messages.forEach((msg, idx) => {
          console.error(
            `   ${idx + 1}. [${msg.role}]: ${msg.content.substring(0, 100)}...`
          );
        });
      }

      throw new Error(`Perplexity API error: ${error.message}`);
    }
  }

  /**
   * Asegurar que los mensajes alternen entre user y assistant
   * Perplexity requiere que después del system message, los mensajes alternen
   * @param {Array} history - Historial de conversación
   * @returns {Array} - Historial filtrado con mensajes alternados
   */
  ensureAlternatingMessages(history) {
    if (!history || history.length === 0) {
      return [];
    }

    const filtered = [];
    let lastRole = 'system'; // Comenzamos después del system message

    for (const msg of history) {
      // Solo agregar si el rol es diferente al último
      if (msg.role !== lastRole) {
        filtered.push(msg);
        lastRole = msg.role;
      } else {
        // Si hay mensajes consecutivos del mismo rol, combinarlos o saltarlos
        // Por ahora, saltamos los duplicados
        console.log(`⚠️  Saltando mensaje duplicado de rol: ${msg.role}`);
      }
    }

    // Asegurar que el último mensaje no sea assistant (debe ser user antes de la nueva query)
    if (filtered.length > 0 && filtered[filtered.length - 1].role === 'assistant') {
      // Esto está bien, la nueva query del usuario vendrá después
    } else if (filtered.length > 0 && filtered[filtered.length - 1].role === 'user') {
      // Si el último es user, necesitamos un assistant entre ellos
      // Eliminamos el último user para evitar user -> user
      console.log('⚠️  Eliminando último mensaje user para evitar duplicados');
      filtered.pop();
    }

    return filtered;
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
