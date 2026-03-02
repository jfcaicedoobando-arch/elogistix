

## Plan de Refactorización del Código — Por Fases

### Hallazgos principales

**1. Código duplicado severo entre `NuevoEmbarque.tsx` y `EditarEmbarque.tsx`**
Ambos archivos comparten ~35 estados idénticos (`useState`), la misma función `handleMsdsUpload`, el mismo bloque de props para `StepDatosGenerales` y `StepDatosRuta`, y la misma lógica de mapeo de conceptos a objetos de BD. Son ~250 líneas duplicadas.

**2. Propiedad `iva` muerta en tipos**
`ConceptoVentaLocal` y `ConceptoCostoLocal` en `src/data/conceptoTypes.ts` aún tienen `iva: boolean`, pero ya no se usa en ningún componente visual. Se sigue inicializando como `false` en `useConceptosForm.ts` y en `EditarEmbarque.tsx`.

**3. Funciones de validación vacías en `NuevoEmbarque.tsx`**
`isStep1Valid` y `isStep2Valid` siempre retornan `true` y nunca se invocan — código muerto.

**4. Uso excesivo de `as any` (166 ocurrencias)**
Principalmente en hooks de datos (`useEmbarques`, `useCotizaciones`) y en las páginas de formularios, para castear enums de Supabase. Se pueden reemplazar con tipos explícitos de la BD.

**5. Lista de documentos duplicada entre `Clientes.tsx` y `NuevoProveedorDialog.tsx`**
Ambos tienen su propia lista de `DOCS_OBLIGATORIOS` / `DOCS_NACIONAL` y la misma lógica de adjuntar archivos con `fileInputRefs`. La UI del paso 2 (checklist de documentos) es virtualmente idéntica.

**6. `NuevaCotizacion.tsx` es un archivo de 547 líneas monolítico**
Concentra todo en un solo componente sin subdivisión (destinatario, datos generales, ruta, conceptos, notas). Contrasta con `NuevoEmbarque.tsx` que ya usa Steps.

---

### Fase 1 — Limpieza de código muerto

| Archivo | Acción |
|---|---|
| `src/data/conceptoTypes.ts` | Eliminar propiedad `iva` de ambas interfaces |
| `src/hooks/useConceptosForm.ts` | Eliminar `iva: false` de las inicializaciones |
| `src/pages/EditarEmbarque.tsx` | Eliminar `iva: false` del mapeo de conceptos |
| `src/pages/NuevoEmbarque.tsx` | Eliminar `isStep1Valid` e `isStep2Valid` |

**Riesgo:** Bajo. Ningún componente lee `iva`.

---

### Fase 2 — Hook compartido para formulario de embarque

Crear `src/hooks/useEmbarqueForm.ts` que encapsule:
- Los ~35 estados del formulario (modo, tipo, clienteId, rutas, etc.)
- `handleMsdsUpload`
- La función de mapeo `buildEmbarquePayload` (construir el objeto de inserción/actualización)
- La función de mapeo `buildConceptosPayload` (mapear conceptos locales al formato de BD)
- Función `inicializarDesdeEmbarque(embarque)` para el caso de edición

`NuevoEmbarque.tsx` y `EditarEmbarque.tsx` consumirían este hook, eliminando ~200 líneas duplicadas.

---

### Fase 3 — Componente reutilizable de checklist de documentos

Crear `src/components/DocumentChecklist.tsx` que reciba:
- `documentos: { nombre: string; archivo?: string; adjuntado: boolean }[]`
- `onFileChange: (nombre: string, file: File | undefined) => void`

Reemplazar la UI duplicada en:
- `src/pages/Clientes.tsx` (paso 2 del dialog)
- `src/components/NuevoProveedorDialog.tsx` (paso 2 del dialog)

---

### Fase 4 — Descomponer `NuevaCotizacion.tsx`

Dividir en sub-componentes siguiendo el patrón ya establecido en embarques:
- `SeccionDestinatario` — radio cliente/prospecto + formulario
- `SeccionDatosGeneralesCotizacion` — modo, tipo, incoterm, moneda
- `SeccionRutaCotizacion` — origen, destino, tiempo tránsito, frecuencia, seguro, etc.
- `SeccionConceptosVentaCotizacion` — tabla de conceptos con totales

Cada sección recibiría solo las props que necesita. El archivo principal quedaría en ~150 líneas.

---

### Fase 5 — Reducir `as any`

- En los payloads de inserción/actualización: usar los tipos `TablesInsert` y `TablesUpdate` de Supabase directamente en lugar de castear campo por campo.
- En `EditarEmbarque.tsx`: `(embarque as any).tipo_carga` indica que la tabla ya tiene esas columnas pero los tipos no se regeneraron. Verificar que `types.ts` esté actualizado.

---

### Archivos afectados por fase

```text
Fase 1 (4 archivos):
  src/data/conceptoTypes.ts
  src/hooks/useConceptosForm.ts
  src/pages/EditarEmbarque.tsx
  src/pages/NuevoEmbarque.tsx

Fase 2 (3 archivos):
  src/hooks/useEmbarqueForm.ts        (nuevo)
  src/pages/NuevoEmbarque.tsx
  src/pages/EditarEmbarque.tsx

Fase 3 (3 archivos):
  src/components/DocumentChecklist.tsx (nuevo)
  src/pages/Clientes.tsx
  src/components/NuevoProveedorDialog.tsx

Fase 4 (5 archivos):
  src/components/cotizacion/SeccionDestinatario.tsx               (nuevo)
  src/components/cotizacion/SeccionDatosGeneralesCotizacion.tsx    (nuevo)
  src/components/cotizacion/SeccionRutaCotizacion.tsx              (nuevo)
  src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx    (nuevo)
  src/pages/NuevaCotizacion.tsx

Fase 5 (3+ archivos):
  src/pages/EditarEmbarque.tsx
  src/pages/NuevoEmbarque.tsx
  src/hooks/useCotizaciones.ts
```

### Orden recomendado

Fase 1 primero (es la más segura y rápida). Fase 2 después (mayor impacto en reducción de duplicación). Fases 3-5 pueden hacerse en paralelo o en cualquier orden.

