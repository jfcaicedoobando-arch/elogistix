## Revisión de Fase A (v13.301.69)

**Verificado en base de datos y código:**
- `consolidar_proformas` desplegada con el `UPDATE conceptos_venta SET proforma_id = <consolidada>` al final del flujo, bajo `app.bypass_cierre`.
- Backfill ejecutado: **0 conceptos huérfanos** apuntando a proformas en estado `consolidada` (antes eran 192).
- `sync_conceptos_venta_facturado` no cambió — sigue propagando por `proforma_id = NEW.id`, ahora sí encuentra los conceptos correctos.

**Deuda de tests que arrastra Fase A:**
- No hay ningún test que asegure que `consolidar_proformas` **hoy y mañana** siga repuntando conceptos. Un futuro rewrite podría reintroducir el bug 2 en silencio.
- Se agrega un guardrail arquitectónico dentro de Fase B para no crear una fase separada sólo por eso.

**Sin regresiones detectadas** — la migración de retry hizo sólo `CREATE OR REPLACE FUNCTION` + `DO` con `RAISE NOTICE`; no toca esquema ni políticas.

Fase A queda **en verde**. Continúo a Fase B.

## Fase B — Bug 1: cancelación de sustitución no libera proformas multi-proforma

### Problema

`revertir_proforma_al_cancelar_sustitucion(p_factura_id)` resuelve la proforma a liberar leyendo `facturas.proforma_id`. Ese campo se llena sólo para facturas 1:1. Cuando una factura consume $N \ge 2$ proformas, `emitir_factura_multi_proforma` la crea con `proforma_id = NULL` y guarda el vínculo real en `conceptos_factura.proforma_id_origen` (y en `bitacora_actividad.factura.borrador_generado → detalles.proforma_ids`).

Consecuencia: al cancelar/sustituir esa factura, la RPC hace `RETURN NULL` a las 5 líneas y **ninguna** de las N proformas se libera; se quedan como `facturada` para siempre, y `Embarques sin factura` deja de detectarlas como hueco.

### Fix

1. Reescribir `public.revertir_proforma_al_cancelar_sustitucion(p_factura_id uuid)` para resolver los ids de proforma en este orden y unir:
   - `facturas.proforma_id` (caso 1:1 existente),
   - `SELECT DISTINCT proforma_id_origen FROM conceptos_factura WHERE factura_id = p_factura_id AND deleted_at IS NULL AND proforma_id_origen IS NOT NULL` (caso multi-proforma vía conceptos),
   - `SELECT unnest(proformas_origen) FROM proformas WHERE id = facturas.proforma_id` (caso consolidada, defensa en profundidad para no dejar la consolidada facturada si en algún flujo entrara por aquí).

2. Recorrer cada `v_proforma_id` con el mismo criterio "sin facturas vivas" ya existente (`estado NOT IN ('Cancelada','Sustituida','Borrador')`), tratando **la lista de facturas vivas por proforma** — una proforma A puede tener otra factura viva B aunque cancelemos la factura C que también la consumía; en ese caso A no se libera.

3. Devolver `uuid[]` en lugar de `uuid` para hacer explícito el multi-return. El único call site en `supabase/functions/facturapi-cancelar/*` ignora el retorno (llama por efecto secundario), así que el cambio de firma es seguro; se ajusta el `GRANT`.

4. **Backfill único e idempotente**: para cada factura ya `Cancelada` o `Sustituida` con `proforma_id IS NULL`, ejecutar la nueva resolución y liberar las proformas que quedaron colgadas. Se registra `backfill.multi_proforma_liberadas` con `rows_updated` mediante `RAISE NOTICE` (evita la restricción `NOT NULL` sobre `bitacora_actividad.usuario_id` que ya conocimos en Fase A).

5. **Guardrail nuevo** en `src/lib/__tests__/consolidar-proformas-repunta-conceptos.test.ts`: lee la migración v13.301.69, verifica que el cuerpo de `consolidar_proformas` incluye `UPDATE public.conceptos_venta` con `SET proforma_id = v_nueva.id`. Blindaje contra regresiones del Bug 2.

6. **Guardrail nuevo** en `src/lib/__tests__/revertir-proforma-multi-source.test.ts`: verifica que la nueva versión de `revertir_proforma_al_cancelar_sustitucion` referencia `conceptos_factura.proforma_id_origen`. Blindaje contra regresiones del Bug 1.

### Verificación post-migración

- `psql`: consulta el número de facturas `Cancelada|Sustituida` con `proforma_id IS NULL` cuyas proformas asociadas siguen en `estado_proforma = 'facturada'` sin factura viva → debe quedar en 0.
- `bunx vitest run src/lib/__tests__/consolidar-proformas-repunta-conceptos.test.ts src/lib/__tests__/revertir-proforma-multi-source.test.ts` → verde.

### Entregables

- 1 migración (RPC + backfill + `RAISE NOTICE`).
- 2 tests de guardrail arquitectónico.
- Bump `APP_VERSION` a `13.301.70` y entrada en `CHANGELOG.md`.

### Detalle técnico

```text
Firma nueva:
  revertir_proforma_al_cancelar_sustitucion(p_factura_id uuid) RETURNS uuid[]

Resolución de v_proforma_ids:
  v_ids := ARRAY[]::uuid[];
  IF facturas.proforma_id IS NOT NULL THEN v_ids := v_ids || facturas.proforma_id;
  v_ids := v_ids || (SELECT array_agg(DISTINCT proforma_id_origen)
                     FROM conceptos_factura
                     WHERE factura_id = p_factura_id
                       AND deleted_at IS NULL
                       AND proforma_id_origen IS NOT NULL);
  -- deduplicar
  v_ids := array(SELECT DISTINCT unnest(v_ids) WHERE unnest IS NOT NULL);

Por cada id en v_ids:
  IF NOT EXISTS (SELECT 1 FROM facturas
                 WHERE proforma_id = id
                    OR EXISTS (SELECT 1 FROM conceptos_factura cf
                               WHERE cf.factura_id = facturas.id
                                 AND cf.proforma_id_origen = id
                                 AND cf.deleted_at IS NULL)
                 AND estado NOT IN ('Cancelada','Sustituida','Borrador'))
  THEN liberar proforma id.
```

### Fuera de scope (queda para Fase C)

- Bug 3 (drafts multi-divisa que revierten proforma con hermano vivo) — se ataca junto con hardening final.
- Trigger de guarda al borrar/soft-delete proformas — se ataca en Fase C junto con H7.
