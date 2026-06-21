# Derivar `estado_liquidacion` desde pagos de proveedor y reducir el checklist a 2 reglas en el bloque de costos

## Analogía

Hoy hay dos personas marcando "pagado": la tesorería (registrando `pagos_proveedor`) y el operador (marcando el flag `estado_liquidacion` en cada concepto). Eso permite que se contradigan. La idea es que **sólo la tesorería mande**: cuando el saldo de la factura de proveedor llega a cero, todos sus conceptos quedan `Pagado` automáticamente; si se retira un pago, vuelven a `Pendiente`.

## Cambios

### 1) Migración Postgres

a. **Función `recalcular_estado_liquidacion_concepto(p_concepto_id uuid)`** (`SECURITY DEFINER`, `search_path = public`):
   - Considera el concepto **Pagado** si tiene al menos una factura vinculada y **todas** sus `proveedor_facturas` no canceladas están totalmente pagadas (`SUM(pagos_proveedor.monto) >= proveedor_facturas.total`).
   - Si no tiene facturas o alguna factura tiene saldo, queda **Pendiente**.
   - Actualiza `conceptos_costo.estado_liquidacion` y `fecha_pago` (la fecha del último pago aplicable, NULL si Pendiente).

b. **Función `recalcular_estado_liquidacion_factura(p_factura_id uuid)`**: recorre los conceptos vinculados a esa factura y llama a la función anterior.

c. **Triggers**:
   - `AFTER INSERT OR UPDATE OR DELETE` en `pagos_proveedor` → recalcula por `proveedor_factura_id` (NEW y OLD).
   - `AFTER INSERT OR UPDATE OR DELETE` en `proveedor_facturas_conceptos` → recalcula el `concepto_costo_id` afectado.
   - `AFTER UPDATE` en `proveedor_facturas` cuando cambia `estado` o `total` → recalcula la factura.

d. **Backfill único** dentro de la misma migración: ejecutar `recalcular_estado_liquidacion_concepto` para todo `conceptos_costo` existente, para que los datos vigentes queden sincronizados.

e. **Reescribir `validar_cierre_embarque`**: eliminar el bloque `costos_liquidados` y la variable `v_costos_pendientes`. El resto se mantiene idéntico (incluyendo el fix de `venta_conceptos_facturados` de 13.90.7).

### 2) Frontend (limpieza menor)

- `src/features/embarques/utils/cierreCheckMeta.ts`: borrar la entrada `costos_liquidados` (queda cubierta por `cxp_pagada`).
- `src/features/embarques/components/__tests__/TabCierre.rules.test.ts`: remover los asserts de la regla `costos_liquidados` (etiqueta y AND).
- **No tocar** los `UPDATE ... estado_liquidacion = 'Pagado'` manuales que viven en `cxp/services/conceptosCostoVinculables.ts` y `facturacion/services/facturasCrud.ts`: ya no son la fuente de verdad pero quedan compatibles porque el trigger los re-confirma. Son código legítimo de paths que también insertan el pago.

### 3) Versionado

- `src/constants/appVersion.ts` → `13.90.8`.
- `CHANGELOG.md` raíz → entrada `## [13.90.8] - 2026-06-21` con `feat(cierre/costos-derivados)` explicando: liquidación derivada, triggers, backfill, eliminación de regla del checklist.

## Detalle técnico (esqueleto SQL)

```sql
CREATE OR REPLACE FUNCTION public.recalcular_estado_liquidacion_concepto(p_concepto_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pagado boolean; v_fecha date;
BEGIN
  IF p_concepto_id IS NULL THEN RETURN; END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM proveedor_facturas_conceptos pfc
      JOIN proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
      WHERE pfc.concepto_costo_id = p_concepto_id
        AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
    )
    AND NOT EXISTS (
      SELECT 1 FROM proveedor_facturas_conceptos pfc
      JOIN proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
      WHERE pfc.concepto_costo_id = p_concepto_id
        AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
        AND COALESCE(pf.total,0) > COALESCE((
          SELECT SUM(pp.monto) FROM pagos_proveedor pp
          WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL
        ),0) + 0.01
    )
  INTO v_pagado;

  SELECT MAX(pp.fecha_pago) INTO v_fecha
  FROM proveedor_facturas_conceptos pfc
  JOIN pagos_proveedor pp ON pp.proveedor_factura_id = pfc.proveedor_factura_id
  WHERE pfc.concepto_costo_id = p_concepto_id AND pp.deleted_at IS NULL;

  UPDATE conceptos_costo
     SET estado_liquidacion = CASE WHEN v_pagado THEN 'Pagado' ELSE 'Pendiente' END::estado_liquidacion,
         fecha_pago = CASE WHEN v_pagado THEN v_fecha ELSE NULL END
   WHERE id = p_concepto_id;
END $$;
```

Triggers llaman al recálculo pasando `concepto_costo_id` (para `proveedor_facturas_conceptos`) o iterando los conceptos de la factura (para `pagos_proveedor` y `proveedor_facturas`).

## Archivos a modificar

- Migración Supabase nueva (funciones + triggers + backfill + `validar_cierre_embarque` actualizada).
- `src/features/embarques/utils/cierreCheckMeta.ts`
- `src/features/embarques/components/__tests__/TabCierre.rules.test.ts`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## Resultado esperado

- El checklist de Cierre muestra **2 reglas** en el bloque de costos: "Cuentas por pagar al día" y "Todos los costos tienen factura de proveedor recibida".
- `conceptos_costo.estado_liquidacion` deja de ser manual: cualquier pago/eliminación de pago la actualiza sola, y los badges del Tab Costos siguen mostrando "Pagado/Pendiente" correctamente sin código nuevo en frontend.
