## Objetivo

Quitar la columna **Costos** (estado de liquidación) del listado de embarques porque hoy no refleja la realidad operativa — los `conceptos_costo` se quedan en `Pendiente` indefinidamente — y limpiar los datos históricos para que cuando reintroduzcamos un flujo real de conciliación, la base esté consistente.

## Cambios en UI (frontend)

1. `src/components/embarque/embarqueColumns.tsx`
   - Eliminar `LiquidacionBadge`, la columna `liquidacion` (header "Costos") y los tipos `LiquidacionInfo` / `liquidacionMap` del `BuildColumnsParams`.
2. `src/hooks/embarque/useEmbarquesPageController.ts`
   - Dejar de leer y pasar `liquidacionMap` a `buildEmbarqueColumns`. Quitar también la columna sintética `liquidacion` que se inyecta para el export CSV.
3. `src/generators/exportCsv.ts` (si hace falta) — verificar que ninguna columna exportada dependa de liquidación; si la había, removerla.
4. Revisar consumidores del campo en `useEmbarquesListData` / `useEmbarquesLiquidacion` y mantener el hook solo si lo usa el detalle de embarque (Tab Costos). En el listado dejamos de consumirlo.

> Nota: el RPC `embarques_listado` seguirá devolviendo `costos_total` / `costos_pagados`. No tocamos la firma para no romper otros consumidores; simplemente se ignoran en el listado.

## Backfill de datos históricos

Reglas acordadas para marcar `conceptos_costo.estado_liquidacion = 'Pagado'`:

- El concepto tiene `fecha_pago IS NOT NULL` **o** `referencia_pago` no vacía, **o**
- El embarque asociado está en estado `Cerrado` (operación terminada → se asume liquidada).

Sólo afecta filas con `deleted_at IS NULL` y `estado_liquidacion = 'Pendiente'`. Se ejecuta como UPDATE puntual (no migración de esquema) usando el tool de inserción/datos.

Previo a ejecutar mostraré conteos de cuántas filas se actualizarían por cada criterio para validar contigo antes de aplicar.

## Changelog

Entrada nueva en `src/pages/Changelog.tsx` (patch, e.g. `9.0.1`): "Se retira la columna Estado Costos del listado de embarques mientras se rediseña el flujo de conciliación; se normalizan conceptos históricos."

## Fuera de alcance

- No tocamos el detalle del embarque (Tab Costos) ni el RPC.
- No introducimos una nueva fuente de verdad todavía; eso se planeará cuando se defina el flujo real de conciliación con facturas de proveedor.
