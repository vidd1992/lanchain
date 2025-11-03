import { config } from '../config/env.js';

/**
 * Detector de intenciones simples
 * Identifica saludos, despedidas, agradecimientos y otras intenciones
 * que no requieren búsqueda en RAG ni Perplexity
 */
export class IntentDetector {
  constructor() {
    // Patrones de intenciones simples
    this.patterns = {
      greeting: [
        /^hola$/i,
        /^buenos?\s+(d[ií]as?|tardes?|noches?)$/i,
        /^qu[eé]\s+tal$/i,
        /^hey$/i,
        /^hi$/i,
        /^hello$/i,
        /^saludos?$/i
      ],
      farewell: [
        /^adi[oó]s$/i,
        /^hasta\s+(luego|pronto|ma[ñn]ana)$/i,
        /^chao$/i,
        /^bye$/i,
        /^nos\s+vemos$/i
      ],
      thanks: [
        /^gracias$/i,
        /^muchas\s+gracias$/i,
        /^te\s+agradezco$/i,
        /^thanks?$/i,
        /^thank\s+you$/i
      ],
      affirmation: [
        /^s[ií]$/i,
        /^ok$/i,
        /^okay$/i,
        /^de\s+acuerdo$/i,
        /^perfecto$/i,
        /^excelente$/i,
        /^genial$/i,
        /^claro$/i,
        /^entiendo$/i,
        /^ya$/i
      ],
      negation: [
        /^no$/i,
        /^nope$/i,
        /^para\s+nada$/i,
        /^en\s+absoluto$/i
      ]
    };

    // Respuestas predefinidas
    this.responses = {
      greeting: [
        config.agent.greeting,
        `¡Hola! Soy ${config.agent.name}. Estoy aquí para ayudarte con información sobre el CEC-EPN. ¿Qué necesitas saber?`,
        `¡Buenos días! Bienvenido al CEC-EPN. ¿En qué te puedo asistir?`
      ],
      farewell: [
        '¡Hasta pronto! Si tienes más preguntas sobre el CEC-EPN, no dudes en volver.',
        'Adiós! Que tengas un excelente día. Estoy aquí cuando me necesites.',
        '¡Nos vemos! Recuerda que estoy disponible para ayudarte con cualquier consulta sobre el CEC-EPN.'
      ],
      thanks: [
        '¡De nada! Es un placer ayudarte. Si tienes más preguntas, aquí estaré.',
        'Con gusto! Estoy para servirte. ¿Hay algo más en lo que pueda ayudarte?',
        '¡Encantado de ayudar! Si necesitas más información sobre el CEC-EPN, pregúntame.'
      ],
      affirmation: [
        '¡Perfecto! ¿En qué más puedo ayudarte?',
        '¡Excelente! ¿Tienes alguna otra pregunta?',
        'Me alegro. Si necesitas más información, aquí estoy.'
      ],
      negation: [
        'Entiendo. Si cambias de opinión o tienes alguna otra consulta, aquí estoy.',
        'De acuerdo. ¿Hay algo más sobre el CEC-EPN en lo que pueda ayudarte?',
        'Está bien. No dudes en preguntarme si necesitas algo más.'
      ]
    };
  }

  /**
   * Detectar la intención de un mensaje
   * @param {string} message - Mensaje del usuario
   * @returns {Object|null} - {intent: string, confidence: number} o null
   */
  detectIntent(message) {
    const cleanMessage = message.trim();

    // Buscar coincidencias en cada categoría
    for (const [intent, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(cleanMessage)) {
          return {
            intent: intent,
            confidence: 1.0,
            isSimple: true
          };
        }
      }
    }

    return null;
  }

  /**
   * Obtener respuesta para una intención detectada
   * @param {string} intent - Intención detectada
   * @returns {string} - Respuesta apropiada
   */
  getResponse(intent) {
    const responses = this.responses[intent];
    if (!responses || responses.length === 0) {
      return null;
    }

    // Seleccionar respuesta aleatoria
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
  }

  /**
   * Procesar mensaje y obtener respuesta si es intención simple
   * @param {string} message - Mensaje del usuario
   * @returns {Object|null} - {answer: string, intent: string} o null
   */
  processSimpleIntent(message) {
    const detection = this.detectIntent(message);

    if (!detection) {
      return null;
    }

    const response = this.getResponse(detection.intent);

    if (!response) {
      return null;
    }

    return {
      answer: response,
      intent: detection.intent,
      confidence: detection.confidence,
      isSimple: true
    };
  }
}
