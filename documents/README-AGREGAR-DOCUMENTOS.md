# 📄 Guía: Agregar y Actualizar Documentos de Protocolo

Esta guía explica cómo agregar nuevos documentos al índice de Pinecone o actualizar los existentes.

---

## 🎯 ¿Para Qué Sirve?

Permite agregar archivos TXT o DOCX al índice de Pinecone con:
- ✅ **Priorización automática** (tipo "protocol" con boost de 30%)
- ✅ **Metadata especial** (categoría, prioridad, fecha de carga)
- ✅ **Actualización fácil** (reemplaza versión anterior automáticamente)
- ✅ **Soporte múltiples formatos** (TXT, DOCX)

---

## 📋 Comandos Disponibles

### **1. Agregar/Actualizar un Documento**

```bash
npm run add-protocol <archivo> [opciones]
```

**Ejemplos:**

```bash
# Agregar archivo de contacto
npm run add-protocol protocolo-contacto-sedes.txt

# Agregar con categoría específica
npm run add-protocol protocolo-contacto-sedes.txt -- --category=contacto

# Agregar FAQ con prioridad media
npm run add-protocol faq-cursos.txt -- --type=faq --priority=medium

# Agregar sin eliminar versión anterior
npm run add-protocol nuevo-doc.txt -- --deleteExisting=false
```

---

### **2. Listar Documentos de Protocolo**

```bash
npm run list-protocols
```

Muestra todos los documentos de tipo "protocol" en el índice con su información.

---

## ⚙️ Opciones Disponibles

| Opción | Descripción | Default | Ejemplo |
|--------|-------------|---------|---------|
| `--type` | Tipo de documento | `protocol` | `--type=faq` |
| `--priority` | Prioridad del documento | `high` | `--priority=medium` |
| `--category` | Categoría del contenido | `general` | `--category=contacto` |
| `--chunkSize` | Tamaño de los chunks | `1000` | `--chunkSize=1500` |
| `--deleteExisting` | Eliminar versión anterior | `true` | `--deleteExisting=false` |

---

## 📝 Tipos de Documentos

### **protocol** (Recomendado para info oficial)
- Obtiene boost de 30% en el score
- Máxima prioridad en respuestas
- Para: procedimientos oficiales, contacto, políticas

### **faq**
- Para preguntas frecuentes
- Prioridad media-alta

### **info**
- Para información general
- Prioridad estándar

---

## 🗂️ Categorías Sugeridas

- **contacto** - Información de contacto y sedes
- **atencion** - Protocolo de atención al cliente
- **cursos** - Información sobre cursos
- **procedimientos** - Procesos de matrícula, pago, etc.
- **general** - Información general

---

## 📖 Ejemplo Completo: Agregar Info de Contacto

### **Paso 1: Crear el archivo TXT**

Crea `documents/protocolo-contacto-sedes.txt`:

```txt
PROTOCOLO - INFORMACIÓN DE CONTACTO Y SEDES DEL CEC-EPN

SEDE PRINCIPAL
Dirección: Av. Toledo N23-55 y Madrid
Teléfono: 2 525 766
Email: idiomas@cec-epn.edu.ec
...
```

### **Paso 2: Agregar al índice**

```bash
npm run add-protocol protocolo-contacto-sedes.txt -- --category=contacto
```

### **Paso 3: Verificar**

```bash
npm run list-protocols
```

Deberías ver:

```
✅ Encontrados X documentos de protocolo:

1. protocolo-contacto-sedes.txt
   📦 Chunks: 5
   🏷️  Tipo: protocol
   ⭐ Prioridad: high
   📁 Categoría: contacto
   📅 Subido: [fecha]
```

### **Paso 4: Probar**

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-contacto",
    "idEmpresa": "cec-epn",
    "query": "¿Cuál es el teléfono de la sede principal?"
  }' | jq -r '.data.answer'
```

---

## 🔄 Actualizar un Documento

Para actualizar, simplemente **ejecuta el mismo comando** con el archivo modificado:

```bash
# 1. Edita el archivo
nano documents/protocolo-contacto-sedes.txt

# 2. Actualiza en el índice (elimina y sube automáticamente)
npm run add-protocol protocolo-contacto-sedes.txt
```

El script automáticamente:
1. ✅ Elimina la versión anterior
2. ✅ Sube la nueva versión
3. ✅ Mantiene la priorización

---

## 📂 Estructura de Archivos Recomendada

```
documents/
├── protocolo.docx                      # Protocolo principal
├── protocolo-contacto-sedes.txt        # Info de contacto
├── protocolo-procedimientos.txt        # Procedimientos
├── faq-general.txt                     # FAQs generales
└── casos-especiales/
    └── ...
```

---

## 🎯 Mejores Prácticas

### ✅ Hacer

- **Usar archivos separados** por tema (contacto, cursos, procedimientos)
- **Actualizar regularmente** cuando cambie información
- **Usar type="protocol"** para información oficial prioritaria
- **Incluir fechas y horarios actualizados**
- **Verificar con `list-protocols`** después de agregar

### ❌ Evitar

- **No duplicar información** que ya está en otros documentos
- **No mezclar temas** muy diferentes en un solo archivo
- **No usar chunks muy pequeños** (< 500 caracteres)
- **No olvidar actualizar** cuando cambie info oficial

---

## 🔍 Troubleshooting

### Problema: "El archivo no existe"
```bash
# Verifica la ruta
ls documents/

# El archivo debe estar en documents/ o en una subcarpeta
```

### Problema: "No se encuentra en búsquedas"
```bash
# 1. Verifica que se subió
npm run list-protocols

# 2. Verifica el índice
npm run investigate-protocol

# 3. Prueba con query específica
curl -X POST http://localhost:3001/api/chat \
  -d '{"query": "contacto", "sessionId": "test"}'
```

### Problema: "Score muy bajo"
```bash
# El boost de protocolo debería estar activo
# Verifica en logs si dice: "🚀 Boost aplicado al protocolo"

# Si no aparece, verifica pinecone_service.js
grep "Boost aplicado" src/services/pinecone_service.js
```

---

## 📊 Monitoreo

### Ver logs al agregar documento
```bash
npm run add-protocol protocolo-contacto-sedes.txt
```

Deberías ver:
```
📄 AGREGAR/ACTUALIZAR DOCUMENTO DE PROTOCOLO
📂 Archivo: protocolo-contacto-sedes.txt
🏷️  Tipo: protocol
⭐ Prioridad: high
🗑️  Eliminando versión anterior...
✅ X vectores eliminados
📄 Cargando documento...
✅ Cargado: 1 sección(es)
✂️  Dividiendo en chunks...
✅ Y chunks creados
📤 Subiendo a Pinecone...
✅ Y chunks subidos exitosamente
```

---

## 🚀 Comandos Rápidos

```bash
# Agregar documento simple
npm run add-protocol mi-documento.txt

# Listar todos los protocolos
npm run list-protocols

# Agregar con opciones
npm run add-protocol doc.txt -- --category=contacto --priority=high

# Ver ayuda completa
node scripts/add_protocol_document.js
```

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs del script
2. Ejecuta `npm run list-protocols` para verificar
3. Prueba `npm run investigate-protocol` para diagnóstico completo
4. Verifica que Pinecone esté conectado correctamente
