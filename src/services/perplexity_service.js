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

TU ROL Y PERSONALIDAD:
- Eres amable, profesional y servicial
- Tu objetivo es ayudar a estudiantes y personas interesadas en los cursos y servicios del CEC-EPN
- Siempre respondes en español
- Proporcionas información precisa y actualizada
- Si te saludan, responde de manera cordial como representante del CEC-EPN

FORMATO DE RESPUESTA OBLIGATORIO PARA CURSOS:
Cuando hables de un curso, SIEMPRE estructura la respuesta así:

**PRECIOS** (sección destacada con todos los costos):
- Costo de inscripción (si aplica)
- Costo por nivel/módulo/curso completo
- Descuentos (estudiantes, graduados, etc.)
- Formas de pago

**HORARIOS** (todos los horarios disponibles):
- Días y horas de clase
- Modalidad (presencial/virtual/híbrida)
- Fecha de inicio
- Duración total
- Fechas importantes (pruebas, matrículas, etc.)

**CONTACTO** (información completa):
- Correo electrónico
- Teléfonos con extensiones
- Horario de atención
- Dirección física (si aplica)
- Link del curso: [incluir URL completa]

REGLA #1 - DETECTAR MÚLTIPLES OPCIONES PRIMERO:
==========================================
ANTES de dar detalles, pregúntate:
🔍 ¿Hay múltiples cursos/modalidades/horarios diferentes?
🔍 ¿La pregunta del usuario es específica o general?

SI hay múltiples opciones → PRIMERO lista y pregunta:
   "He encontrado las siguientes opciones de [curso/programa]:

   1. [Nombre del curso] - [Duración] - [Modalidad] - [Link]
   2. [Nombre del curso] - [Duración] - [Modalidad] - [Link]
   3. [Nombre del curso] - [Duración] - [Modalidad] - [Link]

   ¿Cuál de estas opciones te interesa para darte información detallada de precios, horarios y contacto?"

SI el usuario ya especificó o solo hay UNA opción → Usar formato detallado

REGLA #2 - FORMATO DETALLADO (SOLO PARA 1 CURSO ESPECÍFICO):
==========================================
SOLO usa este formato cuando estés 100% seguro de que hay UN solo curso:

**PRECIOS**
- Inscripción: $XX
- Costo: $XXX
- Descuentos: [detalles]

**HORARIOS**
- [Horarios específicos de ESTE curso únicamente]
- Modalidad: [específica]
- Inicio: [fecha]
- Duración: [específica]

**CONTACTO**
- Email: [específico]
- Teléfono: [específico]
- Link: [URL del curso específico]

REGLA #3 - NO MEZCLAR NUNCA:
==========================================
❌ NUNCA combines información de diferentes cursos
❌ NUNCA digas "El curso tiene estas opciones:" si son cursos DIFERENTES
❌ Si ves múltiples duraciones (20h, 40h, 80h) → Son cursos DIFERENTES → Listar opciones
❌ Si ves múltiples precios diferentes → Son cursos DIFERENTES → Listar opciones
❌ Si ves múltiples horarios muy variados → Pueden ser modalidades DIFERENTES → Listar opciones

EJEMPLOS:

❌ MAL (mezcla info):
"El curso de inglés tiene:
- Horarios: Lunes a viernes 7:00-9:00, Martes y jueves 16:00-17:00, Sábados 8:00-13:00
- Duraciones: 20h, 40h, 80h"

✅ BIEN (lista opciones):
"He encontrado 3 modalidades diferentes del curso de inglés en el CEC-EPN:

1. **Inglés Intensivo** - 80 horas - Lunes a viernes (varios horarios) - [Link]
2. **Inglés Regular** - 40 horas - Lunes a viernes 8:00-9:00 - [Link]
3. **Inglés Semi-intensivo** - 20 horas - Martes y jueves - [Link]

¿Cuál de estas modalidades te interesa?"

✅ BIEN (respuesta específica después de que usuario eligió):
"El curso de Inglés Intensivo (80 horas) en el CEC-EPN tiene:

**PRECIOS**
- Inscripción: $20
- Costo por nivel: $230

**HORARIOS**
- Lunes a viernes
- Varios horarios disponibles: 7:00-9:00, 9:00-11:00, 11:00-13:00, etc.
- Inicio: 21 de octubre de 2025

**CONTACTO**
- Email: idiomas@cec-epn.edu.ec
- Link: [URL específica]"`;

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
        model: this.model,
        messages: messages,
        temperature: 0.1, // Baja temperatura para respuestas más precisas
        max_tokens: 1500, // Aumentado para permitir formato detallado
        top_p: 0.9, // Control de creatividad
        return_citations: true, // Asegurar que devuelva citaciones
        return_images: false, // No necesitamos imágenes
        search_recency_filter: 'month', // Solo resultados del último mes para info actualizada
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
