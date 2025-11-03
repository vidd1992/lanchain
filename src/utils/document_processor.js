import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { JSONLoader } from 'langchain/document_loaders/fs/json';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';

/**
 * Procesador de documentos con LangChain
 */
export class DocumentProcessor {
  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize,
      chunkOverlap: chunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
  }

  /**
   * Cargar documento según su tipo
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<Array>} - Documentos cargados
   */
  async loadDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    try {
      let loader;

      switch (ext) {
        case '.txt':
        case '.md':
          loader = new TextLoader(filePath);
          break;

        case '.pdf':
          loader = new PDFLoader(filePath);
          break;

        case '.docx':
          loader = new DocxLoader(filePath);
          break;

        case '.csv':
          loader = new CSVLoader(filePath);
          break;

        case '.json':
          loader = new JSONLoader(filePath);
          break;

        default:
          // Intentar cargar como texto plano
          loader = new TextLoader(filePath);
      }

      const docs = await loader.load();
      console.log(`✅ Cargado: ${path.basename(filePath)} (${docs.length} documentos)`);
      return docs;
    } catch (error) {
      console.error(`❌ Error cargando ${filePath}:`, error.message);
      return [];
    }
  }

  /**
   * Procesar documento de FAQ con formato especial
   * Formato esperado:
   * Q: Pregunta aquí
   * A: Respuesta aquí
   *
   * Q: Otra pregunta
   * A: Otra respuesta
   *
   * @param {string} filePath - Ruta del archivo FAQ
   * @returns {Promise<Array>} - Documentos procesados
   */
  async loadFAQDocument(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const faqs = this.parseFAQ(content);

      const documents = faqs.map(faq => ({
        pageContent: `Pregunta: ${faq.question}\n\nRespuesta: ${faq.answer}`,
        metadata: {
          source: path.basename(filePath),
          type: 'faq',
          question: faq.question,
          category: faq.category || 'general',
        },
      }));

      console.log(`✅ Procesadas ${documents.length} preguntas frecuentes`);
      return documents;
    } catch (error) {
      console.error('Error procesando FAQ:', error.message);
      return [];
    }
  }

  /**
   * Detectar categoría automáticamente del contenido
   * @param {string} text - Texto (pregunta + respuesta)
   * @returns {string} - Categoría detectada
   */
  detectCategory(text) {
    const lowerText = text.toLowerCase();

    // Categorías con palabras clave
    const categories = {
      curso: [
        'curso',
        'cursos',
        'capacitación',
        'capacitacion',
        'formación',
        'formacion',
        'programa',
        'programas',
        'certificado',
        'certificación',
      ],
      precio: [
        'precio',
        'precios',
        'costo',
        'costos',
        'valor',
        'pagar',
        'pago',
        'inversión',
        'inversion',
        'tarifa',
      ],
      horarios: [
        'horario',
        'horarios',
        'hora',
        'horas',
        'cuándo',
        'cuando',
        'fecha',
        'fechas',
        'calendario',
        'inicio',
      ],
      inscripcion: [
        'inscripción',
        'inscripcion',
        'matrícula',
        'matricula',
        'inscribir',
        'registrar',
        'registro',
      ],
      requisitos: [
        'requisito',
        'requisitos',
        'necesario',
        'necesita',
        'debe',
        'previo',
        'conocimiento',
      ],
      modalidad: ['virtual', 'presencial', 'online', 'distancia', 'modalidad', 'formato'],
      contacto: [
        'contacto',
        'teléfono',
        'telefono',
        'email',
        'correo',
        'ubicación',
        'ubicacion',
        'dirección',
        'direccion',
      ],
      duracion: ['duración', 'duracion', 'tiempo', 'semanas', 'meses', 'horas'],
    };

    // Buscar coincidencias
    for (const [category, keywords] of Object.entries(categories)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return category;
        }
      }
    }

    return 'general';
  }

  /**
   * Parsear contenido de FAQ
   * @param {string} content - Contenido del archivo
   * @returns {Array} - Array de FAQs
   */
  parseFAQ(content) {
    const faqs = [];

    // Soportar múltiples formatos
    // Formato 1: Q: ... A: ...
    const format1Regex = /Q:\s*([^\n]+)\s*A:\s*([^Q]+)/gi;

    // Formato 2: ## Pregunta \n Respuesta
    const format2Regex = /##\s*([^\n]+)\n([^#]+)/gi;

    // Formato 3: JSON
    try {
      const jsonContent = JSON.parse(content);
      if (Array.isArray(jsonContent)) {
        return jsonContent.map(item => {
          const question = item.question || item.q || item.pregunta;
          const answer = item.answer || item.a || item.respuesta;
          const fullText = `${question} ${answer}`;

          return {
            question,
            answer,
            category: item.category || item.categoria || this.detectCategory(fullText),
          };
        });
      }
    } catch (e) {
      // No es JSON, continuar con otros formatos
    }

    // Intentar formato 1
    let match;
    while ((match = format1Regex.exec(content)) !== null) {
      const question = match[1].trim();
      const answer = match[2].trim();
      const fullText = `${question} ${answer}`;

      faqs.push({
        question,
        answer,
        category: this.detectCategory(fullText),
      });
    }

    // Si no encontró nada, intentar formato 2
    if (faqs.length === 0) {
      while ((match = format2Regex.exec(content)) !== null) {
        const question = match[1].trim();
        const answer = match[2].trim();
        const fullText = `${question} ${answer}`;

        faqs.push({
          question,
          answer,
          category: this.detectCategory(fullText),
        });
      }
    }

    return faqs;
  }

  /**
   * Dividir documentos en chunks
   * @param {Array} documents - Documentos a dividir
   * @returns {Promise<Array>} - Documentos divididos
   */
  async splitDocuments(documents) {
    const chunks = await this.textSplitter.splitDocuments(documents);
    console.log(`📄 Dividido en ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Enriquecer metadata de documentos
   * @param {Array} documents - Documentos
   * @param {Object} additionalMetadata - Metadata adicional
   * @returns {Array} - Documentos con metadata enriquecida
   */
  enrichMetadata(documents, additionalMetadata = {}) {
    return documents.map((doc, index) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        ...additionalMetadata,
        chunkIndex: index,
        timestamp: new Date().toISOString(),
      },
    }));
  }

  /**
   * Procesar directorio completo
   * @param {string} dirPath - Ruta del directorio
   * @param {boolean} isFAQ - Si es directorio de FAQs
   * @returns {Promise<Array>} - Todos los documentos procesados
   */
  async processDirectory(dirPath, isFAQ = false) {
    try {
      const files = await fs.readdir(dirPath);
      const allDocuments = [];

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);

        if (stat.isFile()) {
          let docs;

          if (
            isFAQ &&
            (file.endsWith('.txt') || file.endsWith('.md') || file.endsWith('.json'))
          ) {
            docs = await this.loadFAQDocument(filePath);
          } else {
            docs = await this.loadDocument(filePath);
            docs = await this.splitDocuments(docs);
          }

          allDocuments.push(...docs);
        }
      }

      console.log(`\n📦 Total documentos procesados: ${allDocuments.length}`);
      return allDocuments;
    } catch (error) {
      console.error('Error procesando directorio:', error.message);
      return [];
    }
  }

  /**
   * Procesar archivo único
   * @param {string} filePath - Ruta del archivo
   * @param {boolean} isFAQ - Si es archivo FAQ
   * @param {Object} metadata - Metadata adicional
   * @returns {Promise<Array>} - Documentos procesados
   */
  async processFile(filePath, isFAQ = false, metadata = {}) {
    try {
      let documents;

      if (isFAQ) {
        documents = await this.loadFAQDocument(filePath);
      } else {
        documents = await this.loadDocument(filePath);
        documents = await this.splitDocuments(documents);
      }

      // Enriquecer metadata
      documents = this.enrichMetadata(documents, {
        ...metadata,
        originalFile: path.basename(filePath),
      });

      return documents;
    } catch (error) {
      console.error('Error procesando archivo:', error.message);
      return [];
    }
  }

  /**
   * Validar y limpiar documentos
   * @param {Array} documents - Documentos a validar
   * @returns {Array} - Documentos válidos
   */
  validateDocuments(documents) {
    return documents.filter(doc => {
      // Eliminar documentos vacíos o muy cortos
      if (!doc.pageContent || doc.pageContent.trim().length < 10) {
        return false;
      }
      return true;
    });
  }

  /**
   * Obtener estadísticas de documentos
   * @param {Array} documents - Documentos
   * @returns {Object} - Estadísticas
   */
  getDocumentStats(documents) {
    const totalChars = documents.reduce((sum, doc) => sum + doc.pageContent.length, 0);
    const avgChars = Math.round(totalChars / documents.length);

    return {
      totalDocuments: documents.length,
      totalCharacters: totalChars,
      averageCharsPerDoc: avgChars,
      sources: [...new Set(documents.map(d => d.metadata.source))].length,
    };
  }

  /**
   * Extraer el índice/tabla de contenido de un documento .docx
   * Útil para documentos con estructura como protocolos, manuales, etc.
   * @param {string} filePath - Ruta del archivo .docx
   * @returns {Promise<Object>} - Índice extraído y texto completo
   */
  async extractDocxStructure(filePath) {
    try {
      const buffer = await fs.readFile(filePath);

      // Extraer texto con formato markdown (mantiene headings)
      const result = await mammoth.convertToMarkdown({ buffer });
      const markdownText = result.value;

      // Extraer headings (índice)
      const headings = [];
      const lines = markdownText.split('\n');

      for (const line of lines) {
        // Detectar headings de markdown (# Título)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const title = headingMatch[2].trim();
          headings.push({
            level: level,
            title: title,
            text: line,
          });
        }
      }

      console.log(`📑 Índice encontrado: ${headings.length} secciones`);

      return {
        fullText: markdownText,
        headings: headings,
        hasStructure: headings.length > 0,
      };
    } catch (error) {
      console.error('Error extrayendo estructura del docx:', error.message);
      return {
        fullText: '',
        headings: [],
        hasStructure: false,
      };
    }
  }

  /**
   * Procesar documento .docx con extracción de estructura mejorada
   * @param {string} filePath - Ruta del archivo .docx
   * @param {Object} metadata - Metadata adicional
   * @returns {Promise<Array>} - Documentos procesados con estructura
   */
  async processDocxWithStructure(filePath, metadata = {}) {
    try {
      console.log(
        `📄 Procesando ${path.basename(filePath)} con extracción de estructura...`
      );

      // Extraer estructura
      const structure = await this.extractDocxStructure(filePath);

      if (!structure.hasStructure) {
        // Si no tiene estructura, procesar normalmente
        console.log('⚠️  No se detectó estructura de headings, procesando normalmente');
        return await this.processFile(filePath, false, metadata);
      }

      // Crear un documento especial para el índice
      const indexDoc = {
        pageContent: `ÍNDICE DEL DOCUMENTO:\n\n${structure.headings
          .map(h => '  '.repeat(h.level - 1) + `- ${h.title}`)
          .join('\n')}`,
        metadata: {
          ...metadata,
          originalFile: path.basename(filePath),
          type: 'index',
          sections: structure.headings.length,
        },
      };

      // Procesar el documento completo con el loader estándar
      const docs = await this.loadDocument(filePath);
      const splitDocs = await this.splitDocuments(docs);

      // Enriquecer metadata indicando que tiene estructura
      const enrichedDocs = this.enrichMetadata(splitDocs, {
        ...metadata,
        originalFile: path.basename(filePath),
        hasStructure: true,
        totalSections: structure.headings.length,
      });

      // Agregar el índice al principio
      console.log(`✅ Procesado con ${structure.headings.length} secciones`);
      return [indexDoc, ...enrichedDocs];
    } catch (error) {
      console.error('Error procesando docx con estructura:', error.message);
      // Fallback a procesamiento normal
      return await this.processFile(filePath, false, metadata);
    }
  }
}
