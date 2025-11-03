/**
 * Detector de tipo de curso (Programado vs Bajo Demanda)
 */
export class CourseTypeDetector {
  /**
   * Detectar si un curso es bajo demanda o programado
   * @param {string} content - Contenido del documento/curso
   * @returns {Object} - { type: 'scheduled'|'on-demand', confidence: number, indicators: [] }
   */
  static detectCourseType(content) {
    const lowerContent = content.toLowerCase();

    // Indicadores de curso BAJO DEMANDA
    const onDemandIndicators = [
      'bajo demanda',
      'bajo pedido',
      'se oferta bajo pedido',
      'para grupos e instituciones',
      'para grupos empresariales',
      'para instituciones públicas o privadas',
      'coordinar con',
      'solicitar cotización',
      'sin fecha programada',
    ];

    // Indicadores de curso PROGRAMADO
    const scheduledIndicators = [
      /inicio\s*:\s*\d+/i, // "Inicio: 8 noviembre"
      /inicia\s*:\s*\d+/i,
      /finaliza\s*:\s*\d+/i,
      /matr[íi]culas?\s*:/i,
      /horario\s*:\s*[a-z]+\s+de\s+\d+/i, // "Horario: Sábados de 08:00"
      /costo\s*:\s*usd?\s*\$?\d+/i, // "Costo: USD $79"
      /precio\s*:\s*\$?\d+/i,
    ];

    // Contar indicadores
    let onDemandCount = 0;
    let scheduledCount = 0;
    const foundIndicators = [];

    // Buscar indicadores de bajo demanda
    for (const indicator of onDemandIndicators) {
      if (lowerContent.includes(indicator)) {
        onDemandCount++;
        foundIndicators.push(`On-demand: "${indicator}"`);
      }
    }

    // Buscar indicadores de programado
    for (const pattern of scheduledIndicators) {
      if (pattern.test(content)) {
        scheduledCount++;
        const match = pattern.exec(content);
        foundIndicators.push(`Scheduled: "${match?.[0] || pattern}"`);
      }
    }

    // Determinar tipo
    let type;
    let confidence;

    if (onDemandCount > scheduledCount) {
      type = 'on-demand';
      confidence = Math.min(onDemandCount / 3, 1); // Normalizar a 0-1
    } else if (scheduledCount > onDemandCount) {
      type = 'scheduled';
      confidence = Math.min(scheduledCount / 4, 1);
    } else if (scheduledCount === 0 && onDemandCount === 0) {
      type = 'unknown';
      confidence = 0;
    } else {
      // Empate, priorizar programado si tiene fecha de inicio
      const hasStartDate = /inicio\s*:\s*\d+|inicia\s*:\s*\d+/i.test(content);
      type = hasStartDate ? 'scheduled' : 'on-demand';
      confidence = 0.5;
    }

    return {
      type,
      confidence,
      indicators: foundIndicators,
      onDemandCount,
      scheduledCount,
    };
  }

  /**
   * Generar mensaje apropiado según el tipo de curso
   * @param {string} courseName - Nombre del curso
   * @param {string} type - Tipo de curso
   * @param {Object} details - Detalles del curso
   * @returns {string} - Mensaje formateado
   */
  static formatCourseResponse(courseName, type, details) {
    if (type === 'on-demand') {
      return `🔔 **${courseName}** es un curso BAJO DEMANDA

Esto significa que:
• NO tiene fecha de inicio programada
• Se coordina según necesidades de grupos o instituciones
• Se puede solicitar para capacitaciones empresariales

Para solicitar este curso, contáctanos en:
📧 ventas@cec-epn.edu.ec
📞 2525766 Ext. 122, 114, 156, 145`;
    } else if (type === 'scheduled') {
      const parts = [];
      parts.push(`📅 **${courseName}** es un curso PROGRAMADO\n`);

      if (details.startDate) {
        parts.push(`• Inicia: ${details.startDate}`);
      }
      if (details.endDate) {
        parts.push(`• Finaliza: ${details.endDate}`);
      }
      if (details.schedule) {
        parts.push(`• Horario: ${details.schedule}`);
      }
      if (details.cost) {
        parts.push(`• Costo: ${details.cost}`);
      }
      if (details.enrollment) {
        parts.push(`• Matrículas: ${details.enrollment}`);
      }

      return parts.join('\n');
    } else {
      return `ℹ️ **${courseName}**\n\nPara información sobre fechas y disponibilidad, por favor contacta:\n📧 ventas@cec-epn.edu.ec`;
    }
  }

  /**
   * Extraer detalles de un curso programado
   * @param {string} content - Contenido del curso
   * @returns {Object} - Detalles extraídos
   */
  static extractScheduledDetails(content) {
    const details = {};

    // Extraer fecha de inicio
    const startPattern = /inicio\s*:\s*(\d+\s+\w+,?\s*\d+)/i;
    const startMatch = startPattern.exec(content);
    if (startMatch) {
      details.startDate = startMatch[1];
    }

    // Extraer fecha de fin
    const endPattern = /finaliza\s*:\s*(\d+\s+\w+,?\s*\d+)/i;
    const endMatch = endPattern.exec(content);
    if (endMatch) {
      details.endDate = endMatch[1];
    }

    // Extraer horario
    const schedulePattern = /horario\s*:\s*([^\n]+)/i;
    const scheduleMatch = schedulePattern.exec(content);
    if (scheduleMatch) {
      details.schedule = scheduleMatch[1].trim();
    }

    // Extraer costo
    const costPattern = /costo\s*:\s*(usd?\s*\$?\d+\.?\d*)/i;
    const costMatch = costPattern.exec(content);
    if (costMatch) {
      details.cost = costMatch[1];
    }

    // Extraer período de matrículas
    const enrollPattern = /matr[íi]culas?\s*:\s*([^\n]+)/i;
    const enrollMatch = enrollPattern.exec(content);
    if (enrollMatch) {
      details.enrollment = enrollMatch[1].trim();
    }

    return details;
  }
}
