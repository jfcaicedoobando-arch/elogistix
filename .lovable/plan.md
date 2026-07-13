## Diagnóstico

La página `/portal/estado-de-cuenta` muestra todo en 0 porque la consulta a Supabase falla con **HTTP 400**:

```
column pagos_factura_1.monto_no_aplicado does not exist
```

`fetchEstadoCuenta` (en `src/features/facturacion/estadoCuenta/services/estadoCuenta.ts`) pide columnas que no existen en la BD:

- `pagos_factura.monto_no_aplicado` → **no existe**. La tabla tiene `monto` (pago total) y `monto_aplicado_factura` (aplicado a esta factura). El "no aplicado" (anticipo) se deriva como `monto − monto_aplicado_factura`.
- `factura_notas_credito.monto_aplicado` y `saldo_disponible` → **no existen**. La tabla sólo tiene `monto` + `estado`.

Como el request falla, `useEstadoCuenta` devuelve `rows = []` → KPIs = 0 y tabla vacía.

## Cambios

**Un solo archivo:** `src/features/facturacion/estadoCuenta/services/estadoCuenta.ts`

1. En el `select()` embebido:
   - `pagos_factura(...)`: pedir `monto` en lugar de `monto_no_aplicado`.
   - `factura_notas_credito(...)`: quitar `monto_aplicado` y `saldo_disponible`.
2. En los tipos `RawPago` / `RawNota`: reflejar las columnas reales.
3. En el `map(...)`: calcular `monto_no_aplicado = max(0, monto − monto_aplicado_factura)` en JS y exponerlo en `PagoDetalle` (contrato público sin cambios).

Sin cambios en UI, KPIs, filtros ni tests — el contrato `FacturaEstadoCuenta` / `PagoDetalle` se mantiene idéntico.

## Verificación

- `tsgo --noEmit` para tipos.
- Revisar la red en `/portal/estado-de-cuenta`: el mismo GET debe responder **200** con las facturas de INDIMEX (31 emitidas en USD).
- KPI "Saldo Total Adeudado" debe mostrar el total USD; "Saldo a Favor" debe reflejar anticipos si existen.

## Versionado

Bump `APP_VERSION` a `13.298.1` + entrada en `CHANGELOG.md` (bugfix).

## Analogía

El módulo estaba pidiendo al almacén tres cajas por nombre, pero dos de esas cajas tienen otra etiqueta. El almacén respondía "no las tengo" y el mostrador se quedaba vacío. Vamos a pedir sólo las cajas que sí existen y calcular la tercera con los datos que ya vienen dentro.
