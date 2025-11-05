# Casos Especiales - Documentación

Esta carpeta contiene archivos de texto con información específica que necesita ser actualizada frecuentemente en la base de conocimiento del RAG.

## 📁 Estructura

```
casos-especiales/
├── .gitignore          # Ignora el archivo de estado
├── .state.json         # Estado de cada archivo (auto-generado)
├── README.md           # Esta documentación
└── [tema].txt          # Archivos de casos especiales
```

## 📝 Formato de Archivos

Cada archivo `.txt` debe seguir este formato:

```
# ESTADO: v1.0
# FECHA_ACTUALIZACION: 2025-11-04
# DESCRIPCION: Breve descripción del contenido

==============================================
TÍTULO DEL CASO ESPECIAL
==============================================

[Contenido del documento...]

INFORMACIÓN 1:
----------------------------
Detalles...

INFORMACIÓN 2:
----------------------------
Más detalles...

==============================================
INFORMACIÓN IMPORTANTE
==============================================

Datos adicionales...

CONTACTO:
- Info de contacto
```

### Headers Obligatorios

1. **`# ESTADO:`** - Versión del documento (ej: v1.0, v1.1, v2.0)

   - **MUY IMPORTANTE**: Cambia este valor cada vez que actualices el contenido
   - El sistema solo reprocesa el archivo si este valor cambia

2. **`# FECHA_ACTUALIZACION:`** - Fecha de última actualización (formato: YYYY-MM-DD)

3. **`# DESCRIPCION:`** - Descripción breve del contenido

## 🔄 Proceso de Actualización

### 1. Crear o Editar Archivo

```bash
# Crear nuevo archivo
touch documents/casos-especiales/mi-tema.txt

# Editar con tu editor favorito
nano documents/casos-especiales/mi-tema.txt
```

### 2. Actualizar el ESTADO

**IMPORTANTE**: Siempre incrementa el `# ESTADO:` cuando hagas cambios:

```
# ESTADO: v1.0  →  # ESTADO: v1.1  →  # ESTADO: v2.0
```

### 3. Ejecutar Script de Procesamiento

```bash
# Procesar todos los casos especiales
node scripts/process_casos_especiales.js
```

El script:

- ✅ Detecta archivos nuevos o modificados (por cambio de ESTADO)
- ✅ Procesa y divide el contenido en chunks
- ✅ Sube los chunks a Pinecone con metadata especial
- ✅ Guarda el estado actual en `.state.json`

## 🎯 Casos de Uso

### Ejemplo 1: Cursos con Horarios Específicos

Cuando tienes información detallada de cursos que cambia frecuentemente:

```bash
documents/casos-especiales/ingles.txt
documents/casos-especiales/excel.txt
documents/casos-especiales/python.txt
```

### Ejemplo 2: Promociones Temporales

```bash
documents/casos-especiales/promocion-navidad.txt
```

### Ejemplo 3: FAQs Específicas

```bash
documents/casos-especiales/faq-matriculas.txt
documents/casos-especiales/faq-pagos.txt
```

## 🔍 Verificación

Después de procesar, verifica que los documentos están en Pinecone:

```bash
# Listar índices
node scripts/list_pinecone_indexes.js
```

Busca documentos con metadata:

- `tipo: "caso-especial"`
- `source: "caso-especial-[nombre-archivo]"`

## 🚀 Integración en Deploy

Para automatizar el procesamiento en cada deploy, agrega al `deploy.sh`:

```bash
# Procesar casos especiales antes de desplegar
echo "📋 Procesando casos especiales..."
node scripts/process_casos_especiales.js
```

## ⚠️ Notas Importantes

1. **Siempre cambia el ESTADO** cuando actualices el contenido
2. **No modifiques `.state.json` manualmente** - se genera automáticamente
3. **Usa formato consistente** para mejor procesamiento
4. **Incluye información de contacto** cuando sea relevante
5. **Documenta la fecha** de última actualización

## 🔄 Control de Versiones

El archivo `.state.json` NO está en Git (ver `.gitignore`), por lo que:

- ✅ Cada ambiente (local, dev, prod) mantiene su propio estado
- ✅ Puedes reprocesar todo eliminando `.state.json`
- ✅ Los archivos `.txt` SÍ están en Git para compartir contenido

## 📊 Ejemplo Completo: Inglés

Ver: `documents/casos-especiales/ingles.txt`

Este ejemplo incluye:

- Múltiples cursos de inglés
- Horarios detallados
- Fechas de inicio
- Información de contacto
- Notas importantes

## 🛠️ Comandos Útiles

```bash
# Procesar casos especiales
npm run process-especiales

# Limpiar estado y reprocesar todo
rm documents/casos-especiales/.state.json
node scripts/process_casos_especiales.js

# Ver estado actual
cat documents/casos-especiales/.state.json
```

## 💡 Tips

1. **Nomenclatura de archivos**: Usa nombres descriptivos (ej: `ingles.txt`, no `file1.txt`)
2. **Versionado semántico**:
   - `v1.0` → `v1.1` para cambios menores
   - `v1.9` → `v2.0` para cambios mayores
3. **Backup**: Los archivos `.txt` están en Git, así que siempre tienes historial
4. **Testing**: Prueba localmente antes de subir cambios a producción
