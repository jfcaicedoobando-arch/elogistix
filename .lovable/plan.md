# Venta del mes con el tipo de cambio de la factura

## Qué cambia para ti
En "Arribos este mes", la venta en dólares de un embarque que ya se facturó se va a convertir a pesos con el tipo de cambio de su factura. Ya no se usa el del embarque. Así la venta coincide en pesos con lo que realmente facturaste.

Los embarques sin factura, como ELIMP00388, siguen con el tipo de cambio del embarque, porque todavía no hay otro.

Resultado esperado para Elogistix en septiembre: los ~$47K de diferencia por tipo de cambio desaparecen. La única diferencia que queda contra lo facturado es ELIMP00388, que todavía no tiene factura (~$273K).

## Reglas
- Solo cuentan las facturas vigentes: no las canceladas, borradores ni sustituidas.
- Si un embarque tiene varias facturas en dólares, se usa su tipo de cambio promedio, pesado por el monto de cada una.
- Solo cambia la parte en dólares de la **venta**. Lo que ya está en pesos no cambia.
- El **costo** sigue con el tipo de cambio del embarque. Las facturas de proveedor tienen su propio tipo de cambio y quedan fuera de este cambio.
- No cambia el P&L del embarque ni otros reportes. Solo cambian la tarjeta de arribos del mes y su lista.

## Detalles técnicos
- **Migración:** `CREATE OR REPLACE` de `dashboard_summary_datos()` y `dashboard_details_datos()`. `profit_por_embarque()` no se toca, porque tiene otros consumidores.
- **CTE nueva `tc_factura`:**
  - Por cada `embarque_id`: `sum(subtotal*tipo_cambio)/sum(subtotal)` de sus `facturas` en USD.
  - Filtros: `deleted_at IS NULL`, `estado NOT IN ('Cancelada','Borrador','Sustituida')` y `tipo_cambio > 1`.
- **Ajuste en `arribos_mes` y `profit_este_mes_src`:**
  - `venta_mxn_from_usd = venta_usd × COALESCE(tc_factura, tc_embarque)`.
  - `venta_mxn` se recalcula como `from_usd + from_eur + native`.
  - La utilidad se deriva de esos valores.
- Actualizar los espejos en `supabase/schema/dashboards/` y cerrar con `db:postcheck`.
- **Verificación:** SQL con los mismos datos. La venta de los 30 embarques facturados de Elogistix debe coincidir con lo facturado (≈ $6.46M).
- **Pruebas:** focalizadas del tablero. CI y RLS completos quedan para GitHub Actions. No publico ni cambio versión.
