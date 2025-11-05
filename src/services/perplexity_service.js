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
    // Construir mensajes con contexto del agente
    const systemPrompt = `Eres ${config.agent.name}, ${config.agent.role}.

# ASISTENTE VIRTUAL CEC-EPN

## ROL
Eres el asistente virtual oficial del Centro de Educación Continua de la EPN.
- Respondes siempre en español
- Eres amable, profesional y preciso
- Tu objetivo es informar sobre cursos, programas y servicios

## FLUJO DE RESPUESTA

### 1. ANÁLISIS INICIAL
Antes de responder, identifica:
- ¿El usuario pregunta por un curso específico o general?
- ¿Existen múltiples opciones (modalidades, horarios, niveles)?
- ¿Tengo toda la información necesaria?

### 2. REGLA DE DECISIÓN
SI existen múltiples opciones diferentes:
   → Presentar lista de opciones primero
SI el usuario especificó claramente su interés:
   → Dar información detallada directamente
SI no tengo información completa:
   → Indicar qué información falta y ofrecer contacto

### 3. FORMATO PARA MÚLTIPLES OPCIONES
"He encontrado [número] opciones de [curso/programa]:

1. **[Nombre]** - [Duración] - [Modalidad] - [Característica clave]
2. **[Nombre]** - [Duración] - [Modalidad] - [Característica clave]

¿Sobre cuál deseas información detallada?"

### 4. FORMATO PARA INFORMACIÓN ESPECÍFICA

**📋 INFORMACIÓN DEL CURSO: [Nombre completo]**

**💰 INVERSIÓN**
- Inscripción: $[monto]
- Costo: $[monto]
- Descuentos disponibles: [lista]
- Formas de pago: [opciones]

**📅 DETALLES DEL PROGRAMA**
- Modalidad: [presencial/virtual/híbrida]
- Duración: [horas/semanas/meses]
- Horario: [días y horas]
- Inicio: [fecha]
- Requisitos: [si aplica]

**📞 INFORMACIÓN Y REGISTRO**
- Email: [correo específico]
- Teléfono: [número con extensión]
- WhatsApp: [si aplica]
- Enlace directo: [URL]
- Horario de atención: [horario]

## CRITERIOS DE DIFERENCIACIÓN
Considera como cursos DIFERENTES si tienen:
- Duraciones distintas (20h vs 40h vs 80h)
- Precios significativamente diferentes
- Modalidades diferentes (presencial vs virtual)
- Objetivos o certificaciones diferentes

## MANEJO DE CASOS ESPECIALES

### Información incompleta:
"Para el curso [nombre], tengo la siguiente información:
[información disponible]

Para detalles sobre [información faltante], puedes contactar directamente a:
[datos de contacto]"

### Pregunta fuera de alcance:
"Mi especialidad es brindar información sobre los cursos y programas del CEC-EPN.
Para tu consulta sobre [tema], te sugiero contactar a [área correspondiente]."

### Saludo inicial:
"¡Hola! Bienvenido al CEC-EPN. ¿En qué curso o programa puedo ayudarte hoy?"

## RECORDATORIOS CLAVE
- NUNCA mezclar información de cursos diferentes
- SIEMPRE verificar si hay múltiples opciones antes de dar detalles
- Proporcionar enlaces directos cuando estén disponibles
- Si el usuario no especifica, preguntar antes de asumir`;

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

    try {
      // 📊 LOG: Mostrar consulta completa que se enviará a Perplexity
      console.log('');
      console.log('📤 ===== CONSULTA A PERPLEXITY =====');
      console.log('🔍 Query del usuario:', query);
      console.log('� Historial de conversación:', conversationHistory.length, 'mensajes');
      console.log('');
      console.log('📋 MENSAJES COMPLETOS QUE SE ENVIARÁN:');
      let idx = 0;
      for (const msg of messages) {
        idx++;
        console.log(`\n   ${idx}. [${msg.role.toUpperCase()}]:`);
        console.log(`   ${msg.content}`);
        console.log('   ' + '-'.repeat(80));
      }
      console.log('');

      // Preparar el payload con web_search_domains si está configurado
      const payload = {
        model: 'sonar-pro',
        messages: messages,
        temperature: 0.1, // Baja temperatura para respuestas más precisas
        max_tokens: 1500, // Aumentado para permitir formato detallado
        top_p: 0.5, // Control de creatividad
        return_citations: true, // Asegurar que devuelva citaciones
        return_images: false, // No necesitamos imágenes
        search_after_date: '1/6/2025',
        // search_recency_filter: 'month', // Solo resultados del último mes para info actualizada
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

      console.log('📦 Payload completo:');
      console.log(JSON.stringify(payload, null, 2));
      console.log('📤 ===================================');
      console.log('');

      console.log('⏳ Enviando request a Perplexity API...');
      console.log(`🌐 URL: ${this.apiUrl}`);
      console.log(`🤖 Modelo: ${this.model}`);

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          Authorization: `Bearer ${config.perplexity.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Respuesta recibida de Perplexity');

      // 📊 Imprimir resultado completo de Perplexity
      console.log('📥 ===== RESPUESTA COMPLETA DE PERPLEXITY =====');
      console.log(JSON.stringify(response.data, null, 2));
      console.log('📥 ============================================');

      const answer = response.data.choices[0].message.content;
      const citations = this.extractCitations(response.data);
      const searchResults = response.data.search_results || [];

      console.log('📝 Respuesta extraída:', answer.substring(0, 200) + '...');
      console.log('📚 Citaciones encontradas:', citations.length);
      console.log('🔍 Resultados de búsqueda web:', searchResults.length);

      // 🔍 Analizar si hay múltiples cursos en las fuentes
      if (searchResults.length > 0) {
        console.log('📊 Análisis de fuentes:');
        let idx = 0;
        for (const result of searchResults) {
          idx++;
          console.log(`   ${idx}. ${result.title}`);
          console.log(`      URL: ${result.url}`);
        }

        // Detectar si hay múltiples URLs de cursos diferentes
        const courseUrls = searchResults.filter(r => r.url?.includes('/curso/'));
        if (courseUrls.length > 1) {
          console.log(
            `⚠️  ADVERTENCIA: Se encontraron ${courseUrls.length} cursos diferentes en las fuentes`
          );
          console.log('   La respuesta debería listar opciones o pedir aclaración');
        }
      }

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
        let idx = 0;
        for (const msg of messages) {
          idx++;
          console.error(`   ${idx}. [${msg.role}]: ${msg.content.substring(0, 100)}...`);
        }
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
      if (msg.role === lastRole) {
        // Si hay mensajes consecutivos del mismo rol, combinarlos o saltarlos
        // Por ahora, saltamos los duplicados
        console.log(`⚠️  Saltando mensaje duplicado de rol: ${msg.role}`);
      } else {
        filtered.push(msg);
        lastRole = msg.role;
      }
    }

    // Asegurar que el último mensaje no sea assistant (debe ser user antes de la nueva query)
    if (filtered.length > 0 && filtered.at(-1).role === 'user') {
      // Si el último es user, necesitamos un assistant entre ellos
      // Eliminamos el último user para evitar user -> user
      console.log('⚠️  Eliminando último mensaje user para evitar duplicados');
      filtered.pop();
    } else if (filtered.length > 0 && filtered.at(-1).role === 'assistant') {
      // Esto está bien, la nueva query del usuario vendrá después
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
      console.log('⚠️  No se pudieron extraer citaciones:', error.message);
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
      console.log('⚠️  Health check falló:', error.message);
      return false;
    }
  }
}
