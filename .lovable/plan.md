# v12.9.0 — Cerrar pendiente crítico: asignar contenedor a cada concepto

## Problema

`SelectContenedorConcepto` se creó en Fase E pero **nunca se montó en la UI**. Hoy todos los conceptos se guardan con `contenedor_id = null`, así que los chips de filtro por contenedor en `DialogGenerarProforma` no separan nada. Hasta que los operadores puedan etiquetar conceptos por contenedor, la proforma filtrada no aporta valor real.

## Alcance (sólo este pendiente)

Permitir asignar cada concepto de **costo** y **venta** a un contenedor específico (o dejarlo "General") desde el wizard de embarques, y persistirlo. El selector aparece **sólo cuando el embarque tiene 2+ contenedores**, sin ruido para el caso single-container.

Fuera de alcance (otros pendientes menores listados antes): hidratación de `contenedores` al editar, columna de múltiples contenedores en lista de embarques, búsqueda global multi-contenedor.

## Cambios técnicos

### 1. Tipos compartidos
- `src/types/concepto.ts`: agregar `contenedorId?: string | null` en `ConceptoVentaLocal` y `ConceptoCostoLocal` (opcional → no rompe el wizard de cotizaciones, que no tiene contenedores).

### 2. Wizard de costos
- `src/components/embarque/StepCostosPrecios.tsx`:
  - Recibir nueva prop opcional `embarqueId?: string`.
  - Insertar `<SelectContenedorConcepto>` como **última columna antes del botón eliminar** en cada fila de costo y de venta, sólo cuando `embarqueId` esté presente. El componente se auto-oculta si hay <2 contenedores, así que no requiere lógica extra aquí.
  - Ajustar `grid-cols` para acomodar la nueva columna sólo cuando el selector tenga sentido (clase condicional según `embarqueId` + cantidad de contenedores via `useContenedoresEmbarque`).
  - Cablear `onChange` a `updateConceptoCosto(id, 'contenedorId', value)` y `updateConceptoVenta(id, 'contenedorId', value)`.

- `src/hooks/cotizacion/wizard/useConceptosForm.ts`: incluir `contenedorId: null` en los defaults al crear nuevas filas (sin tocar firmas).

- `src/pages/embarques/NuevoEmbarque.tsx` y `EditarEmbarque.tsx`: pasar `embarqueId` (en Editar viene del param; en Nuevo queda `undefined` → selector oculto).

### 3. Persistencia
- `src/lib/mappers/embarqueToDb.ts`:
  - `buildConceptosVentaPayload`: agregar `contenedor_id: v.contenedorId ?? null`.
  - `buildConceptosCostoPayload`: agregar `contenedor_id: c.contenedorId ?? null`.
- RPC ya acepta `contenedor_id` (columna existe en DB desde v12.5.0), no se requiere migración.

### 4. Hidratación al editar (mínima necesaria para que esto sirva)
- `src/lib/parsers/cotizacionDetalle.ts` (o el parser equivalente que carga conceptos del embarque para el wizard de edición): mapear `contenedor_id` de DB → `contenedorId` en el local. Verificar y agregar el campo en ambos casos.

### 5. Lectura — TabCostos
- `src/components/embarque/TabCostos.tsx`: agregar columna "Contenedor" en ambas tablas (venta y costo), visible sólo si el embarque tiene 2+ contenedores. Muestra el `numero_contenedor` o "General" si es null. Requiere extender `ConceptoVentaRow`/`ConceptoCostoRow` o resolver vía `useContenedoresEmbarque(embarqueId)` y un `Map<id, numero>`.

### 6. Validación / errores
- No agregamos validación obligatoria — un concepto puede quedar "General" intencionalmente.
- Si un concepto referencia un contenedor que se eliminó, ya se trata como "General" en `conceptosPorContenedor.ts` (comportamiento actual correcto).

### 7. Documentación y versión
- `src/constants/appVersion.ts` → `12.9.0`.
- `CHANGELOG.md`: nueva sección `## [12.9.0] - 2026-05-28` describiendo: asignación de contenedor por concepto, columna nueva en TabCostos, filtrado real en proformas.
- `docs/embarques-contenedores.md`: sección "Asignar concepto a contenedor" con captura conceptual y flujo (wizard → guarda `contenedor_id` → proforma filtra por chip).

## Validación manual sugerida tras implementar
1. Crear embarque marítimo con 2 contenedores → editar → en Costos agregar 2 cargos: uno asignado a Contenedor A, otro a "General" → guardar.
2. Recargar detalle → TabCostos muestra columna "Contenedor" con valores correctos.
3. Generar proforma → chips de filtro permiten elegir "Contenedor A" y se ven sólo los conceptos de A + los generales.
4. Embarque con 1 solo contenedor → wizard NO muestra columna de contenedor (selector oculto). TabCostos tampoco muestra la columna.

## Pendientes que quedan abiertos (informativos, no en esta fase)
- Hidratar `contenedores: []` → array real al editar (hoy el array se reemplaza desde `SeccionContenedores`, pero el wizard arranca vacío).
- Mejorar lista de embarques para mostrar múltiples contenedores ("MSCU123… +2").
- Extender búsqueda global a todos los contenedores del embarque.
