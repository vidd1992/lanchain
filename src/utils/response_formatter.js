/**
 * Formateador de respuestas para convertir Markdown a HTML
 * Configurable mediante variable de entorno ENABLE_HTML_FORMATTING
 */

export class ResponseFormatter {
  constructor(enableFormatting = false) {
    this.enableFormatting = enableFormatting;
  }

  /**
   * Formatea una respuesta según la configuración
   * @param {string} text - Texto en Markdown
   * @returns {string} - Texto formateado (HTML si está habilitado, Markdown si no)
   */
  format(text) {
    if (!this.enableFormatting) {
      return text;
    }

    return this.convertToHtml(text);
  }

  /**
   * Convierte Markdown a HTML con estilos personalizados
   * @param {string} markdown - Texto en Markdown
   * @returns {string} - HTML formateado
   */
  convertToHtml(markdown) {
    let html = markdown;

    // Eliminar referencias de citación [1][2][3] etc.
    html = this.removeCitations(html);

    // Convertir títulos ## a HTML con tamaño más grande
    html = html.replace(
      /^## (.+)$/gm,
      '<h2 style="font-size: 1.5em; font-weight: bold; margin: 1em 0 0.5em 0;">$1</h2>'
    );

    // Convertir títulos ### a HTML
    html = html.replace(
      /^### (.+)$/gm,
      '<h3 style="font-size: 1.2em; font-weight: bold; margin: 0.8em 0 0.4em 0;">$1</h3>'
    );

    // Convertir listas con viñetas
    html = this.convertLists(html);

    // Convertir texto en negrita **texto** a HTML
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convertir texto en cursiva *texto* a HTML (solo si no es parte de **)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Convertir saltos de línea dobles a párrafos
    html = html
      .split('\n\n')
      .map(para => {
        if (para.trim() && !para.trim().startsWith('<')) {
          return `<p>${para.trim()}</p>`;
        }
        return para;
      })
      .join('');

    // Limpiar saltos de línea simples que quedaron
    html = html.replace(/\n/g, '');

    return html;
  }

  /**
   * Elimina las referencias de citación como [1], [2][3], etc.
   * @param {string} text - Texto con citaciones
   * @returns {string} - Texto sin citaciones
   */
  removeCitations(text) {
    // Eliminar referencias tipo [1], [2], [3][4][5], etc.
    return text.replace(/(\[\d+\])+/g, '');
  }

  /**
   * Convierte listas de Markdown a HTML
   * @param {string} text - Texto con listas
   * @returns {string} - Texto con listas en HTML
   */
  convertLists(text) {
    const lines = text.split('\n');
    let inList = false;
    let result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detectar inicio de lista con viñetas (- item)
      if (line.match(/^-\s+(.+)$/)) {
        if (!inList) {
          result.push('<ul style="margin: 0.5em 0; padding-left: 2em;">');
          inList = true;
        }
        const content = line.replace(/^-\s+/, '');
        result.push(`  <li>${content}</li>`);
      }
      // Detectar fin de lista
      else if (inList && (!line.trim() || !line.match(/^-\s+/))) {
        result.push('</ul>');
        inList = false;
        result.push(line);
      } else {
        result.push(line);
      }
    }

    // Cerrar lista si quedó abierta
    if (inList) {
      result.push('</ul>');
    }

    return result.join('\n');
  }

  /**
   * Valida si el HTML generado es válido
   * @param {string} html - HTML a validar
   * @returns {boolean} - true si es válido
   */
  isValidHtml(html) {
    // Verificar que todas las etiquetas estén cerradas
    const openTags = (html.match(/<(h[1-6]|p|ul|li|strong|em)[\s>]/g) || []).length;
    const closeTags = (html.match(/<\/(h[1-6]|p|ul|li|strong|em)>/g) || []).length;

    return openTags === closeTags;
  }

  /**
   * Limpia el HTML de etiquetas no permitidas (sanitización básica)
   * @param {string} html - HTML a limpiar
   * @returns {string} - HTML limpio
   */
  sanitize(html) {
    // Lista blanca de etiquetas permitidas
    const allowedTags = ['h2', 'h3', 'p', 'ul', 'li', 'strong', 'em', 'br'];

    // Eliminar cualquier etiqueta no permitida
    const regex = new RegExp(
      `<(?!/?(?:${allowedTags.join('|')})(?:[\\s/>]))([^>]+)>`,
      'gi'
    );
    return html.replace(regex, '');
  }

  /**
   * Aplica formato completo con sanitización
   * @param {string} text - Texto original
   * @returns {string} - Texto formateado y sanitizado
   */
  formatSafe(text) {
    if (!this.enableFormatting) {
      return text;
    }

    const html = this.convertToHtml(text);
    const sanitized = this.sanitize(html);

    if (!this.isValidHtml(sanitized)) {
      console.warn('⚠️  HTML generado no es válido, devolviendo texto original');
      return text;
    }

    return sanitized;
  }
}

/**
 * Obtiene una instancia del formateador según la configuración
 * @returns {ResponseFormatter}
 */
export function getFormatter() {
  const enableFormatting = process.env.ENABLE_HTML_FORMATTING === 'true';
  return new ResponseFormatter(enableFormatting);
}

/**
 * Función helper para formatear texto directamente
 * @param {string} text - Texto a formatear
 * @returns {string} - Texto formateado
 */
export function formatResponse(text) {
  const formatter = getFormatter();
  return formatter.formatSafe(text);
}
