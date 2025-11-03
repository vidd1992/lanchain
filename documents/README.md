# Carpeta de Documentos

Coloca tus documentos aquí para procesarlos y subirlos a Pinecone.

## Formatos Soportados

- **.txt** - Archivos de texto plano
- **.md** - Archivos Markdown
- **.pdf** - Documentos PDF
- **.csv** - Archivos CSV
- **.json** - Archivos JSON

## Documentos FAQ (Preguntas Frecuentes)

Para archivos de FAQ, puedes usar varios formatos:

### Formato 1: Q&A simple (archivo .txt o .md)

```
Q: ¿Qué es LangChain?
A: LangChain es un framework para desarrollar aplicaciones con modelos de lenguaje.

Q: ¿Cómo funciona el RAG?
A: RAG combina búsqueda de información con generación de texto usando LLMs.
```

### Formato 2: Markdown con headers

```markdown
## ¿Qué es LangChain?
LangChain es un framework para desarrollar aplicaciones con modelos de lenguaje.

## ¿Cómo funciona el RAG?
RAG combina búsqueda de información con generación de texto usando LLMs.
```

### Formato 3: JSON

```json
[
  {
    "question": "¿Qué es LangChain?",
    "answer": "LangChain es un framework para desarrollar aplicaciones con modelos de lenguaje.",
    "category": "general"
  },
  {
    "question": "¿Cómo funciona el RAG?",
    "answer": "RAG combina búsqueda de información con generación de texto usando LLMs.",
    "category": "tecnico"
  }
]
```

## Nomenclatura

- **Archivos FAQ**: Nombra tus archivos FAQ con el prefijo `faq_` (ejemplo: `faq_general.txt`)
- Los archivos FAQ se procesarán de manera especial, manteniendo cada pregunta-respuesta como una unidad

## Procesamiento

1. Los archivos se cargarán usando los loaders apropiados de LangChain
2. Los documentos largos se dividirán en chunks usando `RecursiveCharacterTextSplitter`
3. Los archivos FAQ se mantendrán como unidades completas (Q+A juntos)
4. Se agregará metadata automática (fuente, fecha, tipo)

## Ejemplo de Uso

1. Coloca tus archivos aquí
2. Ejecuta: `npm run setup`
3. El script procesará todos los archivos y los subirá a Pinecone
