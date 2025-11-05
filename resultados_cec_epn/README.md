# Datos Scrapeados del CEC-EPN

## 📊 Contenido

Esta carpeta contiene **396 cursos** scrapeados directamente de la web oficial del CEC-EPN (`www.cec-epn.edu.ec`).

### Estructura de Archivos

```
resultados_cec_epn/
├── categorias.json              # Lista de categorías y URLs
├── resumen.json                 # Resumen estadístico
├── administrativos/
│   ├── cursos_basicos.json      # Info resumida (219 cursos)
│   └── cursos_detallados.json   # Info completa
├── tecnologicos/
│   ├── cursos_basicos.json      # Info resumida (75 cursos)
│   └── cursos_detallados.json   # Info completa
├── educativos/
│   ├── cursos_basicos.json      # Info resumida (37 cursos)
│   └── cursos_detallados.json   # Info completa
├── autoestudio/
│   ├── cursos_basicos.json      # Info resumida (25 cursos)
│   └── cursos_detallados.json   # Info completa
├── tecnicos/
│   ├── cursos_basicos.json      # Info resumida (22 cursos)
│   └── cursos_detallados.json   # Info completa
├── legal/
│   ├── cursos_basicos.json      # Info resumida (12 cursos)
│   └── cursos_detallados.json   # Info completa
├── idiomas/
│   ├── cursos_basicos.json      # Info resumida (5 cursos)
│   └── cursos_detallados.json   # Info completa
└── preuniversitarios/
    ├── cursos_basicos.json      # Info resumida (1 curso)
    └── cursos_detallados.json   # Info completa
```

## 📋 Formato de Datos

### cursos_basicos.json
Información resumida de cada curso:
```json
{
  "titulo": "Power BI 3: Inteligencia de Tiempo y Mapas",
  "url": "https://www.cec-epn.edu.ec/cursos/curso/...",
  "horario": "Sábados de 08:00 a 13:15",
  "inicio": "8 noviembre, 2025",
  "duracion": "24 horas",
  "modalidad": "Presencial",
  "precio": "USD $99.00",
  "imagen": "https://..."
}
```

### cursos_detallados.json
Información completa de cada curso (incluye todo lo de básicos más):
```json
{
  "descripcion_completa": "Descripción extensa del curso...",
  "costo": "USD $99.00",
  "finaliza": "29 noviembre, 2025",
  "matriculas": "29 septiembre - 5 noviembre, 2025",
  "instructor": "Ing. Salomón Quito, Mgs.",
  "requisitos": "Conocimientos avanzados de...",
  "dirigido_a": "Estudiantes de tercer nivel...",
  "descuentos": "10% empresas, 10% frecuente...",
  "certificacion": "Se entregará cuando apruebe...",
  "contacto": "rmena@cec-epn.edu.ec, Tel: 2525766",
  "nota": "Inscripciones hasta..."
}
```

## 🎯 Uso en el Proyecto RAG

### 1. Analizar los datos
```bash
npm run analyze-scraped
```

Este comando:
- ✅ Analiza la completitud de datos por categoría
- ✅ Calcula calidad de datos (0-100)
- ✅ Muestra estadísticas de precios y modalidades
- ✅ Genera reporte JSON (`scraping_analysis_report.json`)

### 2. Procesar y ver preview
```bash
npm run process-scraped
```

Este comando:
- ✅ Convierte cursos en documentos optimizados para RAG
- ✅ Genera chunks temáticos (info general, descripción, requisitos, admin)
- ✅ Muestra preview de los primeros 3 documentos
- ✅ NO sube nada a Pinecone (solo muestra cómo quedaría)

### 3. Subir a Pinecone
```bash
npm run upload-scraped
```

Este comando:
- ✅ Procesa todos los cursos
- ✅ Genera embeddings con OpenAI
- ✅ Sube documentos a Pinecone en batches
- ✅ Genera métricas de la subida (`scraping_upload_metrics.json`)

## 🔍 Estrategia de Indexación

### Chunks Temáticos por Curso

En lugar de dividir arbitrariamente, cada curso se divide en **chunks temáticos**:

1. **Chunk de Información General** (siempre presente)
   - Título, categoría, modalidad, duración, precio, horario, inicio, URL

2. **Chunk de Descripción** (si existe)
   - Descripción completa del curso, objetivos, metodología

3. **Chunk de Requisitos** (si existe)
   - Dirigido a, requisitos técnicos y de conocimientos

4. **Chunk Administrativo** (si existe)
   - Descuentos, certificación, matrículas, contacto, notas importantes

### Ventajas de esta Estrategia:

✅ **Búsquedas más precisas**: Cada chunk tiene contexto completo
✅ **Mejor relevancia**: El usuario obtiene exactamente la info que necesita
✅ **Metadata rica**: Filtros por categoría, modalidad, precio, etc.
✅ **Escalable**: Fácil agregar más cursos sin perder calidad

## 📊 Metadata en Pinecone

Cada documento indexado incluye:

```javascript
{
  source: 'web_scraping_cec_epn',
  tipo: 'curso',
  categoria: 'tecnologicos',           // Para filtros
  titulo: 'Power BI 3...',
  modalidad: 'Presencial',             // Para filtros
  precio: 'USD $99.00',
  url: 'https://...',                  // Para citas
  chunkType: 'informacion_general',    // Tipo de chunk
  fecha_scraping: '2025-11-04T...'
}
```

## 🎨 Queries de Ejemplo

Una vez indexados, el agente podrá responder queries como:

**Búsqueda por tema:**
- "¿Qué cursos de Python tienen?"
- "Cursos sobre Power BI"
- "¿Tienen algo de ciencia de datos?"

**Búsqueda por modalidad:**
- "Cursos presenciales"
- "¿Qué cursos online hay?"
- "Cursos virtuales con tutor"

**Búsqueda por precio:**
- "Cursos económicos"
- "Cursos de menos de $100"

**Búsqueda por categoría:**
- "Cursos tecnológicos"
- "Cursos de idiomas"
- "Cursos administrativos"

**Información detallada:**
- "¿Cuánto cuesta el curso de Power BI?"
- "¿Qué requisitos tiene el curso de Python?"
- "¿Cuándo empieza el curso de RStudio?"
- "¿Quién dicta el curso de estadística?"

## ⚙️ Configuración del Agente

Con estos datos, el agente:

1. ✅ **YA NO necesita Perplexity** para preguntas sobre cursos
2. ✅ **Responde con datos oficiales** del CEC-EPN
3. ✅ **Incluye URLs directas** para inscripción
4. ✅ **Información actualizada** (scraping reciente)

### Threshold Recomendado

```env
# Para estos datos estructurados, threshold más bajo es OK
RAG_SIMILARITY_THRESHOLD=0.65

# Top K un poco más alto para cubrir variaciones
RAG_TOP_K=4
```

## 🔄 Actualización de Datos

Para mantener los datos actualizados:

1. **Re-scrapear** la web del CEC-EPN periódicamente
2. **Reemplazar archivos** en esta carpeta
3. **Re-ejecutar** `npm run upload-scraped`

## 📝 Notas Importantes

- ⚠️ Los precios y fechas pueden cambiar - considerar re-scraping mensual
- ⚠️ Algunos cursos pueden no tener toda la información completa
- ✅ La calidad promedio de datos es muy buena (>70%)
- ✅ URLs directas permiten que el usuario se inscriba fácilmente

## 🐛 Problemas Comunes

### "No encuentra cursos específicos"
- Verificar que el threshold no sea muy alto (usar 0.65)
- Revisar que el curso esté en los datos scrapeados
- Probar con variaciones del nombre del curso

### "Respuestas desactualizadas"
- Re-scrapear los datos del sitio web
- Actualizar los archivos JSON
- Re-ejecutar upload-scraped

### "Duplicados en resultados"
- El script automáticamente evita duplicados exactos
- Si hay variaciones mínimas, ajustar el chunk size

## 📧 Contacto

Para problemas con los datos o el scraping, contactar al equipo de desarrollo.
