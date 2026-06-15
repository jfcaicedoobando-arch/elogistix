# Plan: B + C + D — Mejoras de auditoría de proformas y UX

Continuación del análisis de `ELGEN00206`. Cubre las opciones B, C y D del análisis previo (la opción A — limpieza puntual de la proforma fantasma — queda a decisión del operador desde la UI nueva).

## B. Endurecer regla `proforma_vencida`

**Archivo**: nueva migración SQL que reemplaza `calcular_auditoria_operativa` (función de la migración `20260615205837`).

Cambios en el CTE `proforma_pend`:

- Excluir proformas `estado_aprobacion = 'borrador'` (no se han enviado al cliente, no pueden "vencer").
- Excluir proformas con `total_mxn = 0` o sin conceptos vinculados (`NOT EXISTS conceptos_venta WHERE proforma_id = p.id`).
- Mantener el umbral `dias_proforma_vencida` para las proformas reales (aprobadas/emitidas).

Resultado: PRO-2026-0195 deja de aparecer como `proforma_vencida` (es un borrador vacío, no una proforma vencida real).

## C. Nuevos hallazgos en `calcular_auditoria_operativa`

En la misma migración, agregar dos CTEs nuevos al UNION ALL de `todos`:

### C.1 `proforma_borrador_abandonada` (severidad `medio`)

```text
estado_aprobacion = 'borrador'
AND created_at < now() - (v_dias_borrador_abandonado || ' days')::interval
AND (total_mxn = 0 OR NOT EXISTS conceptos vinculados)
```

- Nuevo parámetro `dias_borrador_abandonado` en `configuracion_global` (default: **15 días**).
- Mensaje: `"Proforma borrador PRO-XXXX abandonada hace N días sin conceptos / total cero"`.

### C.2 `proforma_inconsistente` (severidad `alto`)

Detecta el caso exacto de ELGEN00206: un embarque con conceptos pendientes y al mismo tiempo una proforma borrador vacía vinculada.

```text
EXISTS conceptos_venta WHERE embarque_id = e.id AND estado_facturacion='pendiente' AND proforma_id IS NULL
AND EXISTS proforma WHERE embarque_id = e.id AND estado_aprobacion='borrador' AND (total_mxn = 0 OR sin conceptos)
```

- Mensaje: `"Embarque con conceptos pendientes y proforma borrador vacía PRO-XXXX (asignar conceptos o cancelar borrador)"`.

### Registro en catálogos UI

- `src/features/auditoria/types.ts` → agregar `'proforma_borrador_abandonada'` y `'proforma_inconsistente'` a `ReglaAuditoria`.
- `src/features/auditoria/domain/core.ts` → `REGLAS_AUDITORIA` actualizado.
- `src/features/auditoria/domain/reglaLabels.ts` → etiquetas cortas.
- `src/components/shared/utils/auditoriaConfig.ts` → `REGLA_INFO` + `REGLAS_ORDEN` (insertar tras `proforma_vencida`).
- `src/features/auditoria/components/hallazgosTablaConfig.ts` → `reglaLabel` + `reglaToTab` (ambos → `"facturacion"`).

## D. UX en tab Facturación del embarque

**Archivo**: `src/features/embarques/components/facturacion/HistorialProformas.tsx`.

1. **Badge "Borrador vacío"** en la columna estado cuando `estado_aprobacion='borrador' AND (total_mxn = 0 OR conceptos.length === 0)`. Color `bg-amber-500/15 text-amber-700 border-amber-500/30`, tooltip explicativo.

2. **Alerta inline** dentro del tab cuando se detecte el patrón de inconsistencia (proforma borrador vacía + conceptos pendientes sin proforma):

   ```text
   ⚠ Esta proforma está vacía y hay N conceptos pendientes sin asignar.
   [Asignar conceptos a esta proforma]  [Cancelar borrador]
   ```

3. **Acciones**:
   - **"Asignar conceptos"** → llama nuevo RPC `asignar_conceptos_a_proforma(p_proforma_id, p_concepto_ids[])` que setea `proforma_id` en los conceptos seleccionados y recalcula `total_mxn`/`subtotal_mxn` de la proforma vía función ya existente de recálculo (reutilizar la del flujo de creación).
   - **"Cancelar borrador"** → soft-delete (set `estado_proforma='cancelada'`, registra en `bitacora_actividad`). Doble confirmación tipo "ELIMINAR" según `mem://features/data-safety-confirmations`.

4. **Sin cambios** en `TabProformas.tsx` (pre-facturación) — el patrón se detecta a nivel de embarque, no de listado global.

## Detalles técnicos

- **Migración SQL** (única): redefine `calcular_auditoria_operativa` con los 3 CTEs (endurecido + 2 nuevos), agrega `dias_borrador_abandonado` a `configuracion_global` con default 15, agrega RPC `asignar_conceptos_a_proforma(uuid, uuid[])` con `SECURITY DEFINER` + validación de tenancy + recálculo de totales, y actualiza el conteo `por_regla` del JSON de salida para incluir las nuevas claves.
- **Tipos**: regenerar tras la migración (auto).
- **Snapshot diario** (`auditoria-snapshot-daily`): sin cambios — lee `calcular_auditoria_operativa`.
- **Tests**: agregar caso en `src/features/auditoria/domain/core.test.ts` para las nuevas reglas (filtrado/conteo); fixture en `HistorialProformas` con borrador vacío para verificar el badge.

## Metadata

- `APP_VERSION` → `13.24.0`.
- `CHANGELOG.md`: entrada `## [13.24.0] - 2026-06-15` con los 3 cambios (regla endurecida, 2 nuevos hallazgos, UX de proforma vacía).
- Actualizar `mem://features/auditoria-ia-backfill` o crear `mem://features/auditoria-proformas-rules` con las nuevas reglas y el umbral configurable.

## Fuera de alcance

- Limpieza histórica masiva de borradores abandonados (lo hará el operador desde la nueva UI o vía botón de backfill futuro).
- Cambios al flujo de creación/aprobación de proformas.
- Notificaciones por email/internas de los nuevos hallazgos (se incorporarán al weekly digest existente automáticamente vía snapshot).
