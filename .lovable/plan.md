# Plan: Origen de costos — mostrar etiquetas legibles en lugar de UUIDs

## Problema
En `Embarques → Detalle → Tab Resumen → Card "Origen de costos"`, los campos **Tarifa cotizada** y **Tarifa aplicada** muestran el UUID crudo (ej. `fda4ff14-709b-...`). Para el usuario esto no significa nada.

## Objetivo
Mostrar información entendible de cada tarifa: **naviera · puerto origen → puerto destino · tipo contenedor · vigencia**, con el UUID disponible sólo como tooltip para soporte técnico.

## Cambios

### 1. Nuevo servicio: `fetchTarifasResumen(ids)`
`src/features/costeo/services/tarifas.ts`
- Consulta `costeo_tarifas` por `id in (...)` con las columnas mínimas para armar la etiqueta (naviera_nombre / puertos / tipo_contenedor / vigencia_desde-hasta).
- Devuelve `Record<uuid, TarifaResumen>` para acceso O(1).

### 2. Nuevo hook: `useTarifasResumen(ids)`
`src/features/costeo/hooks/useTarifasResumen.ts`
- `useQuery` con `queryKey = ['tarifas','resumen', sortedIds]`, `staleTime: 5min`.
- Deduplica ids nulos/repetidos.

### 3. Refactor `OrigenCostosSection.tsx`
- Consumir el hook con `[tarifaIdOriginal, tarifaIdAplicada]`.
- Nuevo subcomponente `TarifaChip` que renderiza:
  - Línea 1 (bold): `NAVIERA · ORIGEN → DESTINO`
  - Línea 2 (muted, xs): `Contenedor 40'HC · Vigencia 01/06/26 – 30/09/26`
  - `title={uuid}` para que soporte vea el ID al hacer hover.
- Si la tarifa ya no existe (borrada), fallback: `Tarifa no encontrada` + últimos 8 chars del UUID.
- Mantener la marca `(misma)` cuando `tarifaIdOriginal === tarifaIdAplicada`.

### 4. Changelog + versión
- `CHANGELOG.md`: entrada `[13.142.6]` — "Origen de costos: reemplaza UUIDs por naviera/ruta/vigencia".
- `src/constants/appVersion.ts` → `13.142.6`.

## Detalles técnicos

Columnas a leer (ya usadas por `TopTarifaRow`): `id, naviera_nombre, puerto_origen_codigo, puerto_destino_codigo, tipo_contenedor_nombre, vigencia_desde, vigencia_hasta`. Ver si existen en la tabla `costeo_tarifas` directa o si hay que usar la vista `v_costeo_tarifas_top` (ajustar en implementación).

No hay cambios en RLS ni migraciones: es solo un `SELECT` filtrado por `organization_id` (ya cubierto por policies existentes).

## Fuera de alcance
- No se modifica el card en otros lados; sólo `OrigenCostosSection`.
- No se agrega link a `/costeo/tarifas/:id` en este PR (se puede añadir después si se pide).
