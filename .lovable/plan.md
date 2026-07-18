# Fase C — Cierre auditoría cadena de facturación (v13.301.71)

Fase B quedó verde (firma `uuid[]`, 0 huérfanos de cancelación, guardrails en su lugar). Cierro los dos hallazgos restantes.

## Objetivo

1. **Bug 3** — `eliminar_factura_borrador` revierte proformas a `pendiente` sin verificar si **otra factura viva** las sigue consumiendo (caso real: doble borrador multi-divisa MXN + USD sobre la misma proforma, o borrador que coexiste con una factura timbrada). Al borrar uno de los borradores hoy, la proforma queda como `pendiente` aunque el hermano vivo la siga usando → reaparece falsamente en "Embarques sin factura".
2. **H7** — Misma RPC usa `bitacora_actividad` (`accion='factura.borrador_generado'`, campo `detalles->'proforma_ids'`) como **Fuente 3** para resolver las proformas de un borrador consolidado. La bitácora es un log inmutable de auditoría, no una fuente autoritativa; si un admin la depura o alguien crea un borrador consolidado fuera de la ruta que escribe la bitácora, la RPC pierde el link. La fuente autoritativa correcta es `conceptos_factura.proforma_id_origen` (misma que ya usa `revertir_proforma_al_cancelar_sustitucion` en Fase B).
3. **Saneamiento único** — Backfill idempotente: reparar las 42 proformas históricas marcadas `facturada` sin factura viva ni consolidación (residuo previo a las Fases A/B).

## Cambios

### 1. Migración `eliminar_factura_borrador` (v13.301.71)

Reemplazar la RPC (misma firma `void`, mismos permisos y guardas de tenancy). Nueva lógica:

- **Resolver `v_proforma_ids`** desde 2 fuentes (dropear Fuente 3 = bitácora):
  - `proformas.factura_id = p_factura_id` (link 1:1 legacy).
  - `facturas.proforma_id` de la factura eliminada.
  - **Nueva Fuente 3 autoritativa**: `SELECT DISTINCT proforma_id_origen FROM conceptos_factura WHERE factura_id = p_factura_id AND proforma_id_origen IS NOT NULL AND deleted_at IS NULL` — cubre borradores consolidados sin depender de bitácora.
- **Sibling-alive check por proforma** (idéntico patrón al de Fase B): para cada `pid` candidato, sólo revertir si NO existe otra factura `f` (distinta a la que se está borrando, `f.deleted_at IS NULL`, `f.estado NOT IN ('Cancelada','Sustituida')`) tal que `f.proforma_id = pid` **o** exista `conceptos_factura cf` viva con `cf.factura_id = f.id AND cf.proforma_id_origen = pid`. Los que sí tienen hermano vivo se conservan como `facturada`.
- **Retorno**: sigue devolviendo `void`; se registra en bitácora la lista revertida vs conservada para trazabilidad (`detalles: { proformas_revertidas, proformas_conservadas_por_sibling }`).
- Bitácora del evento `factura.borrador_eliminado` se sigue escribiendo (audit trail), sólo que ya no es una **fuente de verdad** para la lógica.

### 2. Backfill idempotente (dentro de la misma migración, transaccional)

Barrido único de las 42 proformas huérfanas:

```sql
UPDATE public.proformas p
   SET estado_proforma = 'pendiente',
       factura_id = NULL,
       fecha_facturacion = NULL,
       updated_at = now()
 WHERE p.estado_proforma = 'facturada'
   AND (p.estado_revision IS DISTINCT FROM 'consolidada')
   AND NOT EXISTS (
     SELECT 1 FROM public.facturas f
      WHERE f.deleted_at IS NULL
        AND f.estado NOT IN ('Cancelada','Sustituida')
        AND (
          f.proforma_id = p.id
          OR EXISTS (
            SELECT 1 FROM public.conceptos_factura cf
             WHERE cf.factura_id = f.id
               AND cf.proforma_id_origen = p.id
               AND cf.deleted_at IS NULL
          )
        )
   );
```

Verificación post-migration: `RAISE NOTICE` con el conteo remanente (debe ser 0). Idempotente: correr dos veces no cambia nada.

### 3. Guardrails nuevos (Vitest, sin tocar prod)

- `src/lib/__tests__/eliminar-borrador-sibling-alive.test.ts` — lee la migración más reciente que redefine `eliminar_factura_borrador` y verifica:
  1. Existe el `NOT EXISTS` con `estado NOT IN ('Cancelada','Sustituida')` sobre `facturas` distinta al `p_factura_id`.
  2. Existe la referencia a `conceptos_factura.proforma_id_origen`.
  3. **NO** existe referencia a `bitacora_actividad` en el cuerpo de la función (blinda H7: previene que alguien reintroduzca la fuente vía bitácora).

- `src/lib/__tests__/proformas-huerfanas-baseline.test.ts` — test de baseline que documenta el conteo esperado post-backfill (0) contra la definición de "huérfana real" (no consolidada, sin factura viva directa ni vía conceptos). Comentario explica que si vuelve a subir, hay una regresión de Fase A/B/C.

### 4. Documentación

- `CHANGELOG.md`: entrada `## [13.301.71] - 2026-07-18` cerrando la auditoría (Fase C completa; auditoría cadena de facturación cerrada).
- Bump `APP_VERSION` a `13.301.71` en `src/lib/version.ts`.

## Fuera de scope

- No se toca la UI de borrado (el frontend sigue invocando la misma RPC con la misma firma).
- No se toca `revertir_proforma_al_cancelar_sustitucion` (Fase B).
- No se toca `consolidar_proformas` (Fase A).
- No se depura `bitacora_actividad` (log inmutable por diseño).

## Validación esperada

```text
psql: SELECT count(*) FROM public.proformas p
      WHERE estado_proforma='facturada'
        AND (estado_revision IS DISTINCT FROM 'consolidada')
        AND NOT EXISTS (...)   →  0  (era 42)
bun run ci:fast                 →  verde, 2 tests nuevos, 0 regresiones
```

Con esto queda cerrada la cadena factura → proforma → conceptos_venta: 3 bugs corregidos + 5 guardrails permanentes.
