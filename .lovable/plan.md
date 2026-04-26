# Validaciones consistentes y manejo de errores — Wizard "Nuevo Embarque"

## Estado actual (auditoría)

**Validación existente**
- Solo el **Paso 1** (Datos Generales) valida, mediante `validateDatosGenerales` en `lib/domain/embarqueWizard.ts` (4 campos: modo, tipo, clienteId, descripcionMercancia).
- Los **Pasos 2, 3 y 4 no validan nada** antes de avanzar (`validateStep={(step) => step === 1 ? ... : true}` en `NuevoEmbarque.tsx`).
- El submit final solo re-valida el Paso 1, no los demás.

**Brechas críticas detectadas**
1. **Paso 2 (Ruta)**: campos marcados `*` (Puerto Origen/Destino, Naviera, Tipo Servicio, Contenedor, Tipo Contenedor, ETD, ETA) **no se validan**. Tampoco se valida que `ETA ≥ ETD`.
2. **Paso 3 (Documentos)**: no hay tamaño máximo de archivo, ni validación de tipo MIME, ni feedback de cuántos están adjuntos vs faltantes.
3. **Paso 4 (Costos/Pricing)**: conceptos de venta y costo permiten cantidades 0, montos negativos, proveedor vacío, concepto vacío. Tipos de cambio pueden ser ≤ 0.
4. **Errores de submit**: solo se muestra un toast genérico; si fallan documentos, expediente o cotización, no se sabe cuál.
5. **Sin esquema único**: la validación está en código imperativo, no en zod (a pesar de que el proyecto ya usa zod en otros lugares).

## Cambios propuestos (v8.93.0)

### 1. Esquemas zod centralizados — `lib/domain/embarqueWizardSchemas.ts` (nuevo)
Definir un schema por paso + uno global, todos derivando los mismos tipos:

```text
embarqueWizardSchemas.ts
├── stepDatosGeneralesSchema
├── stepRutaSchema (condicional por modo: Marítimo/Aéreo/Terrestre)
├── stepDocumentosSchema (valida File: maxSize 10MB, MIME permitidos)
├── stepCostosSchema (cantidad ≥1, montos ≥0, TC > 0)
└── validateETDETA helper (ETA ≥ ETD, ETD no en pasado lejano)
```

Reglas clave:
- **Ruta Marítima**: puertoOrigen, puertoDestino, naviera, tipoServicio, contenedor (si FCL), tipoContenedor (si FCL), ETD, ETA obligatorios. ETA ≥ ETD.
- **Ruta Aérea**: aeropuertoOrigen, aeropuertoDestino, MAWB, ETD, ETA. Validación cruzada de fechas.
- **Ruta Terrestre**: ciudadOrigen, ciudadDestino, transportista, ETD, ETA.
- **Documentos**: tamaño máx 10MB, MIME = pdf/jpg/png/xlsx/docx. No se exige adjuntar todos (siguen siendo opcionales) pero sí valida los que se suben.
- **Costos**: al menos 1 concepto venta y 1 concepto costo válidos; cantidad ≥ 1; precio/monto ≥ 0; tipos de cambio USD/EUR > 0.

### 2. Refactor `useNuevoEmbarqueWizard.ts`
- Reemplazar `validateStep1` por un `validateStep(step)` único que ejecuta el schema de zod correspondiente.
- Mantener `validationErrors` por paso (record `{ [step]: errors }`) para mostrar inline en cada step.
- En `handleFinish`: ejecutar `validateAll()` antes del submit; si falla, saltar al primer paso con error y mostrar toast claro indicando qué corregir.

### 3. UI — feedback de errores en cada paso
- **StepDatosRuta**: agregar `<p className="text-xs text-destructive">` debajo de cada campo con error (mismo patrón de StepDatosGenerales). Usar `useFormContext` + estado de errores del controller.
- **StepDocumentos**: agregar contador "X de Y adjuntos · Z opcionales", y mostrar error si un archivo excede 10MB o tipo inválido (toast).
- **StepCostosPrecios**: borde rojo en celdas con valor inválido + texto descriptivo bajo cada tabla cuando haya filas inválidas.

### 4. Manejo de errores granular en submit (`useEmbarqueSubmitOrchestrator.ts`)
Envolver cada fase en su propio try/catch con mensaje contextual:

```text
resolveExpediente()        → "Error al generar expediente"
subirDocumentos()          → "Error al subir documentos: {nombre}"
createEmbarque()           → "Error al guardar embarque"
updateEstadoCotizacion()   → "Embarque creado, pero no se pudo actualizar cotización" (warning, no destructive)
```

### 5. Cálculo automático ETD/ETA inteligente
- En `StepDatosRuta`, al seleccionar puertos/naviera (si modo Marítimo), si hay datos previos de cotización vinculada con `tiempo_transito_dias`, sugerir ETA = ETD + tránsito (campo editable, solo placeholder/sugerencia).
- Validar en zod: si ambas fechas presentes, ETA ≥ ETD; si solo una, advertir pero no bloquear.

### 6. Tests (`src/lib/domain/__tests__/embarqueWizardSchemas.test.ts`)
- Cobertura de los 4 schemas, casos válidos/inválidos por modo de transporte.
- Validación cruzada de fechas (ETA ≥ ETD).
- Validación de archivos (tamaño/MIME).

## Resumen técnico

**Archivos nuevos (2)**
- `src/lib/domain/embarqueWizardSchemas.ts` — schemas zod por paso.
- `src/lib/domain/__tests__/embarqueWizardSchemas.test.ts` — pruebas unitarias.

**Archivos modificados (5)**
- `src/hooks/embarque/useNuevoEmbarqueWizard.ts` — `validateStep` unificado, `validationErrors` por paso, `validateAll` previo a submit.
- `src/pages/NuevoEmbarque.tsx` — pasar errores de cada paso a su componente, `validateStep` ahora cubre los 4 pasos.
- `src/components/embarque/StepDatosRuta.tsx` — mensajes inline de error + sugerencia de ETA.
- `src/components/embarque/StepDocumentos.tsx` — contador de adjuntos + validación tamaño/MIME.
- `src/components/embarque/StepCostosPrecios.tsx` — borde rojo en celdas inválidas + mensaje resumen.
- `src/hooks/embarque/useEmbarqueSubmitOrchestrator.ts` — try/catch granular por fase.
- `src/lib/domain/embarqueWizard.ts` — re-export de schemas para mantener API.
- `src/content/changelogData.ts` — entrada v8.93.0.

**Garantías**
- Sin breaking changes para consumidores externos del wizard (mismas firmas públicas del controller).
- Verificación con `tsc --noEmit` y `vitest run` (objetivo: 184 + nuevos tests, todos verdes).
- No se modifican payloads enviados a Supabase — solo se valida antes.
- No se cambia el flujo de submit, solo se hace más robusto.

¿Apruebas para ejecutar v8.93.0?
