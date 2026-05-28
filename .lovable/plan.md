# Plan: Fases 2, 3 y 4 — Multi-contenedor

Ejecutar las 3 fases restantes del plan multi-contenedor en orden. JSONCargo queda fuera de Fase 2 (deprecado según `docs/deprecation-jsoncargo.md`).

## Fase 2 (v12.11.0) — Operacional

**Objetivo:** Que el wizard de edición y las vistas operativas reflejen los contenedores reales.

1. **Hidratar `contenedores` en `useEditarEmbarqueWizard`**
   - Leer `embarque_contenedores` al cargar y mapear a `EmbarqueFormValues.contenedores[]`.
   - Asegurar que el Step de Ruta/Contenedores muestre todos los hijos al editar.
   - Persistir cambios (alta/baja/edición de contenedores hijos) en el guardado del wizard.

2. **Tracking UI multi-contenedor (sin JSONCargo)**
   - `TrackingLiveCard`, `TabTracking.tsx`, `PortalEmbarqueDetalle.tsx`: aceptar lista de contenedores y mostrar selector / acordeón por contenedor.
   - Mantener compatibilidad con embarques legacy (1 contenedor en campo plano).
   - No tocar `jsoncargo-track` ni `_shared/jsoncargoSync.ts` (deprecados).

## Fase 3 (v12.12.0) — Visibilidad

**Objetivo:** Listas, dashboards y portal muestran correctamente N contenedores.

1. `EmbarquesActivosTable.tsx` + `embarqueColumns.tsx`: cuando el campo legacy esté vacío, mostrar el primer hijo de `embarque_contenedores` con sufijo `+N` si hay más.
2. `PortalEmbarqueResumenTab.tsx` + `EmbarqueCard.tsx`: listar todos los contenedores (formato `MSCU123 +2` con tooltip de la lista completa).
3. `buildFilas.ts` + `agrupar.ts` (proyección/CSV): leer todos los hijos para el campo "contenedores".
4. Búsqueda global y export CSV: incluir números de contenedor hijos.

## Fase 4 (v12.13.0) — Tests + limpieza

1. Tests:
   - `useEditarEmbarqueWizard`: hidratación de contenedores.
   - Conversión cotización→embarque: 1 embarque con N hijos (caso 3x40HC).
   - Agrupación de proformas con contenedores reales (bucket `__multi__`).
2. Docs: actualizar `docs/embarques-contenedores.md` con el modelo final y el estado de tracking.
3. Limpieza opcional: marcar `embarques.contenedor` y campos legacy como `nullable` para embarques nuevos (NO migrar datos viejos, sólo dejar de escribirlos donde ya no aplique).
4. Actualizar `CHANGELOG.md` y `APP_VERSION` por cada fase (12.11.0, 12.12.0, 12.13.0).

## Detalles técnicos

- **Tracking deprecation:** Saltar todo trabajo sobre `supabase/functions/jsoncargo-track/` y `_shared/jsoncargoSync.ts`. No agregar columna `contenedor_id` a `tracking_externo` aún (se hará cuando entre el proveedor nuevo).
- **Hidratación wizard:** El query actual de `useEditarEmbarqueWizard` ya trae el embarque; añadir un join/segunda query a `embarque_contenedores` ordenado por `created_at` y mapear a la forma que espera `EmbarqueFormValues`.
- **Fallback legacy:** Toda UI de listado debe hacer `contenedores_lista?.[0] ?? embarque.contenedor ?? '—'` para no romper embarques viejos sin hijos.
- **Versionado:** Una bump de `APP_VERSION` + entrada en `CHANGELOG.md` al cerrar cada fase (no por commit intermedio).

## Fuera de alcance

- Workflow nuevo de proformas (siguiente milestone, se aborda después de Fase 4).
- Migración masiva de embarques legacy a `embarque_contenedores`.
- Implementación del nuevo proveedor de tracking.
