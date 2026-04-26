# Estandarización de mensajes de validación – Wizard "Nuevo Embarque" (v8.94.0)

## Objetivo
Unificar tono, formato y severidad de **todos** los mensajes de error del wizard de 4 pasos para que sean consistentes, predecibles y accionables.

## Estándar único a aplicar

### Formato del mensaje
```
"<Etiqueta del campo>: <razón en imperativo o descriptiva>."
```
Ejemplos:
- `"Modo de transporte: selecciona una opción."`
- `"Puerto de destino: campo obligatorio."`
- `"ETA: debe ser igual o posterior al ETD."`
- `"Tipo de cambio USD: debe ser mayor a 0."`
- `"Documento BL: el archivo excede 10 MB (12.4 MB)."`

### Reglas de tono
- Español mexicano, **tuteo** ("selecciona", "ingresa", "agrega").
- Termina con punto.
- Sin signos de admiración. Sin mayúsculas tipo grito.
- Razones cortas (≤ 60 caracteres después de los dos puntos).

### Niveles de severidad (uniformes)
| Severidad | Uso | UI |
|---|---|---|
| **error** (`destructive`) | Campo obligatorio faltante, valor inválido, fallo de submit | Toast rojo + borde rojo en campo + texto rojo bajo el campo |
| **warning** (default) | Operación parcialmente exitosa (ej. embarque creado pero cotización no actualizada) | Toast neutro |
| **success** | Submit completo | Toast neutro con título "Embarque creado" |

### Estructura uniforme de toasts
- **Título**: contexto corto y consistente (`"Revisa el Paso 2: Ruta"`, `"Error al subir documentos"`, `"Embarque creado"`).
- **Descripción**: el primer mensaje en formato `Campo: razón.` (sin listar todos para no saturar).
- **Variant**: `destructive` solo para errores reales.

## Cambios concretos

### 1. `src/lib/domain/embarqueWizardSchemas.ts`
Reescribir todos los `message` de Zod y los strings hardcodeados al formato `Campo: razón.`. Ejemplos de mapeo:

| Antes | Después |
|---|---|
| `"Selecciona un modo de transporte"` | `"Modo de transporte: selecciona una opción."` |
| `"Selecciona un tipo de operación"` | `"Tipo de operación: selecciona una opción."` |
| `"Selecciona un cliente"` | `"Cliente: selecciona uno del catálogo."` |
| `"Ingresa la descripción de la mercancía"` | `"Descripción de mercancía: campo obligatorio."` |
| `"Máximo 500 caracteres"` | `"Descripción de mercancía: máximo 500 caracteres."` |
| `"Ingresa la fecha de salida (ETD)"` | `"ETD: campo obligatorio."` |
| `"La fecha de llegada (ETA) debe ser posterior o igual al ETD"` | `"ETA: debe ser igual o posterior al ETD."` |
| `"Selecciona puerto de origen"` | `"Puerto de origen: selecciona uno del catálogo."` |
| `"Selecciona FCL o LCL"` | `"Tipo de servicio: selecciona FCL o LCL."` |
| `"Ingresa número de contenedor"` | `"Contenedor: campo obligatorio."` |
| `"Ingresa el MAWB"` | `"MAWB: campo obligatorio."` |
| `"El archivo excede 10MB (12.4MB)"` | `"Documento <nombre>: excede 10 MB (12.4 MB)."` |
| `"Formato no permitido (...)"` | `"Documento <nombre>: formato no permitido. Usa PDF, JPG, PNG, XLSX o DOCX."` |
| `"Agrega al menos un concepto de venta válido..."` | `"Conceptos de venta: agrega al menos uno con cantidad ≥ 1 y precio > 0."` |
| `"Cantidad debe ser ≥ 1 y precio ≥ 0"` | `"Concepto de venta #<id>: cantidad ≥ 1 y precio ≥ 0."` |
| `"El tipo de cambio USD debe ser mayor a 0"` | `"Tipo de cambio USD: debe ser mayor a 0."` |
| `"El monto no puede ser negativo"` | `"Concepto de costo #<id>: monto no puede ser negativo."` |

Todos los mensajes pasarán a través de un único helper `formatValidationMessage(field, reason)` para garantizar consistencia futura.

### 2. `src/hooks/embarque/useNuevoEmbarqueWizard.ts`
- Estandarizar título del toast de validación a: `"Revisa el Paso N: <nombre>"` (Datos generales / Ruta / Documentos / Costos).
- La descripción usa el primer mensaje ya estandarizado del schema.
- Severidad: siempre `destructive` para validación bloqueante.

### 3. `src/hooks/embarque/useEmbarqueSubmitOrchestrator.ts`
Renombrar títulos a un patrón uniforme `"Error: <fase>"`:
- `"Error: generación de expediente"`
- `"Error: subida de documentos"`
- `"Error: guardado del embarque"`
- Toast de cotización no actualizada cambia a variant default + título `"Embarque creado con advertencia"` (se mantiene, ya cumple).
- Toast de éxito mantiene `"Embarque creado"` + descripción `"Expediente <X>: registrado correctamente."`.

### 4. `src/components/embarque/StepDocumentos.tsx`
Toast de archivo rechazado pasa de `"Archivo rechazado: <nombre>"` (título) + razón (descripción) a:
- Título: `"Documento rechazado"`
- Descripción: `"<nombre>: <razón>."` (alineado al formato global).

### 5. Tests
Actualizar `src/lib/domain/__tests__/embarqueWizardSchemas.test.ts` para validar los nuevos strings exactos (regex laxo si se prefiere robustez frente a futuros ajustes menores).

### 6. Changelog
Añadir entrada **v8.94.0** en `src/content/changelogData.ts`:
> Estandarización de mensajes de validación del wizard de embarques (formato `Campo: razón`, tono y severidad uniformes en los 4 pasos).

## Fuera de alcance
- No se cambia la lógica de validación, solo los textos y la presentación.
- No se introducen nuevas reglas de validación.
- No se toca el wizard de edición (`useEditarEmbarqueWizard`) en este paso; se hará en una siguiente iteración si se aprueba.

## Verificación
- `bun run build` limpio.
- Suite de tests verde (incluyendo los 17 tests actualizados).
