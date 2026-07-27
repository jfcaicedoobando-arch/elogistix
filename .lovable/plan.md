# Plan: Fix `column f.pagado does not exist` en auditoría de embarques

## Analogía
Es como pedirle al cajero el "saldo pagado" de una cuenta y descubrir que no lo tiene guardado — hay que sumarlo desde los recibos (`pagos_factura` y `pagos_proveedor`) cada vez que se consulta.

## Diagnóstico confirmado
El RPC `auditoria_embarques_org(uuid)` referencia dos columnas que **no existen**:

- Línea 386: `SUM(f.total - COALESCE(f.pagado, 0))` en CTE `cxc_facturas_vencidas`.
- Línea 429: `SUM(pf.total - COALESCE(pf.pagado, 0))` en CTE `cxp_vencidas`.

Verificado con `information_schema`:
- `facturas` sólo tiene `total`, `subtotal`, `forma_pago`, `metodo_pago` (nada de `pagado`).
- `proveedor_facturas` sólo tiene `total`, `subtotal`, `fecha_programada_pago`.

Los montos pagados se calculan sumando pagos vivos:
- CxC: `pagos_factura.monto_aplicado_factura` (o `monto` si es nulo) `WHERE factura_id = f.id AND deleted_at IS NULL`.
- CxP: `pagos_proveedor.monto_en_moneda_factura` (o `monto` si es nulo) `WHERE proveedor_factura_id = pf.id AND deleted_at IS NULL`.

## Cambios

### 1. Migración: reemplazar RPC `auditoria_embarques_org(uuid)`
Sustituir las dos CTEs para calcular el pendiente vía `LEFT JOIN LATERAL` a la tabla de pagos:

```sql
cxc_facturas_vencidas AS (
  SELECT f.embarque_id,
         COUNT(*) AS n,
         SUM(f.total - COALESCE(p.pagado, 0)) AS pendiente
  FROM facturas f
  LEFT JOIN LATERAL (
    SELECT SUM(COALESCE(pf2.monto_aplicado_factura, pf2.monto)) AS pagado
    FROM pagos_factura pf2
    WHERE pf2.factura_id = f.id AND pf2.deleted_at IS NULL
  ) p ON true
  WHERE f.embarque_id IN (SELECT id FROM emb)
    AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Cancelada','Sustituida','Pagada')
    AND f.fecha_vencimiento IS NOT NULL
    AND f.fecha_vencimiento < CURRENT_DATE - v_dias_cxc_vencida
  GROUP BY f.embarque_id
),
```

Análogo para `cxp_vencidas` usando `pagos_proveedor` y `proveedor_factura_id`.

Preservar el resto del RPC (guardas `deleted_at IS NULL`, filtro `p.estado_proforma`, etc.) — solo tocar estas dos CTEs.

### 2. Test de regresión SQL
En `supabase/tests/rpc/test_auditoria_embarques_org.sql`: escenario mínimo con una factura vencida parcialmente pagada, verificar que `pendiente = total - suma(pagos)` y que el RPC no arroja `42703`.

### 3. Auditoría automática de columnas
El script `audit-rpc-columns` (creado en v13.319.6) debería haber detectado esto. Agregar `facturas` y `proveedor_facturas` a su allow-list de tablas escaneadas si no están, para que el próximo drift falle en CI en vez de en producción.

### 4. Versionado
- `APP_VERSION` → `13.320.14` (parche).
- `CHANGELOG.md`: entrada bajo Fixed describiendo el hallazgo y el fix.

## Fuera de alcance
- No tocar UI de `/auditoria`.
- No renombrar columnas ni agregar `pagado` materializada (sería refactor mayor con triggers).
