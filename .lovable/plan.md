## Fase 1 — Auditoría P2 cierre y tests faltantes

**Hallazgos de la auditoría (v13.296.0):**

| # | Componente / Hook | Tests | Riesgo |
|---|---|---|---|
| 1 | `useActualizarPlantilla` | ❌ ninguno | Mutation nueva sin cobertura |
| 2 | `useEliminarPlantilla` | ❌ ninguno | Soft-delete sin cobertura |
| 3 | `GuardarPlantillaDialog` (refactor `FormDialogShell`) | ❌ | Regresión de UI/validación |
| 4 | `PlantillaSelectorPaso1` | ❌ | Aplica payload al form — crítico |
| 5 | `AgregarConceptoInline` | ❌ | Alta de concepto con prefill SAT |
| 6 | `CotizacionPlantillas` (página nueva) | ❌ | Búsqueda + filtros + eliminar |
| 7 | `agregarConceptoPrefill` en `useConceptosVentaCotizacion` | ❌ | Helper nuevo |

Otros hallazgos menores:
- `EditarPlantillaDialog` inline dentro de la página (aceptable, <200 líneas totales).
- Falta un vínculo a `/cotizaciones/plantillas` desde la lista de cotizaciones (chip o botón secundario) para descubrimiento.

**Acciones Fase 1:**

1. **Tests de hooks** (extender `useCotizacionPlantillas.test.tsx`):
   - `useActualizarPlantilla`: happy path + invalidación de `cotizacionPlantillas.list(org)`.
   - `useEliminarPlantilla`: soft-delete llama `.update({deleted_at})` y filtra por `id`+`organization_id`.
   - `agregarConceptoPrefill`: nuevo test unitario en `useConceptosVentaCotizacion.test.tsx` (o crear si no existe) verificando que la fila queda con `clave_sat`, `unidad`, `descripcion`, `cantidad`, `precioUnitario` correctos en el bucket indicado.

2. **Tests de componentes** (`__tests__/`):
   - `GuardarPlantillaDialog.test.tsx`: render, validación de nombre <3 chars deshabilita submit, cambia visibilidad, dispara `onGuardar` con payload limpio (sin `folio`/`id`/fechas).
   - `PlantillaSelectorPaso1.test.tsx`: se oculta si no hay plantillas; al seleccionar dispara `form.reset` + `trigger`; ordena por `veces_usada`.
   - `AgregarConceptoInline.test.tsx`: seleccionar clave SAT llena descripción/unidad; toggle USD/MXN; botón confirmar invoca `agregarConceptoPrefill` con la moneda correcta y cierra popover.
   - `CotizacionPlantillas.test.tsx`: renderiza filas, filtro por visibilidad, búsqueda, abre `DeleteConfirmDialog` desde dropdown.

3. **Descubrimiento**: agregar entrada "Plantillas" en `CotizacionesPageActions` (link a `/cotizaciones/plantillas`).

## Fase 2 — P3: Duplicar cotización & historial de versiones

Con Plantillas cerrado, el siguiente cuello de botella del wizard (identificado en la auditoría original) es **iteración de una cotización viva**: hoy el usuario que quiere variar precios/ruta/incoterm sobre una cotización enviada, o comparar dos escenarios, tiene que crear una nueva desde cero.

**Alcance P3:**

1. **Duplicar cotización** (una acción, cero fricción):
   - Botón "Duplicar" en `CotizacionDetalle` y en el menú de fila de `Cotizaciones`.
   - RPC `duplicar_cotizacion(_id)` `SECURITY DEFINER`: copia paso 1 + costos internos + conceptos venta, regenera folio, deja en estado `Borrador`, sin fechas de envío/aprobación. Requiere pertenecer a la misma org.
   - Al duplicar, redirige a `/cotizaciones/:nuevo/editar` con toast "Duplicada desde COT-XXXX".

2. **Historial de versiones ligero** (sin sobre-ingeniería):
   - Nueva tabla `cotizacion_versiones` (organization_id, cotizacion_id, version_num, snapshot JSONB, motivo, creada_por, created_at). RLS por org.
   - Trigger `on_cotizacion_update` que guarda snapshot cuando el usuario "Guarda cambios" en una cotización **enviada** (no en borradores, para no ensuciar).
   - Panel "Historial" en `CotizacionDetalle` (Sheet lateral) con línea de tiempo, badge de versión y botón "Ver esta versión" (read-only) + "Restaurar" (con doble confirmación).

3. **Comparador de escenarios A/B** (opcional dentro de la fase — decidir al inicio):
   - Vista `/cotizaciones/:a/vs/:b` con tabla lado a lado de totales, márgenes, conceptos. Útil para vendedores que mandan 2 opciones al cliente.

**Entregables P3 mínimos (obligatorios):**
- Migración BD: `cotizacion_versiones` + RPC `duplicar_cotizacion` + trigger de snapshot.
- Hooks: `useDuplicarCotizacion`, `useHistorialCotizacion`, `useRestaurarVersion`.
- UI: botón Duplicar, Sheet de historial.
- Tests unitarios de los 3 hooks + tests de la RPC (Deno) para tenancy.

## Detalles técnicos

- Todos los tests siguen el patrón thenable existente para Supabase (`mem://technical/testing-mock-patterns`).
- `duplicar_cotizacion` debe reasignar `usuario_id = auth.uid()`, regenerar `folio` con la secuencia existente y **NO** copiar `firma_cliente_at`, `enviada_at`, `expira_at`.
- El trigger de snapshot usa `pg_notify` no; sólo `INSERT` en `cotizacion_versiones`. Índice `(cotizacion_id, version_num DESC)`.
- Restaurar versión = `UPDATE cotizaciones SET ... = snapshot->>...` dentro de una transacción con doble confirmación tipable (regla core).
- Bump de versión: `13.297.0` (fin Fase 1) → `13.298.0` (RPC + tests P3) → `13.299.0` (UI historial + duplicar) → `13.300.0` (comparador si entra).

**Decisión pendiente**: ¿el **Comparador A/B** entra en P3 o lo dejamos para P4? Si dices "entra", planifico ambos; si dices "P4", cierro P3 con duplicar + historial y arrancamos comparador aparte.