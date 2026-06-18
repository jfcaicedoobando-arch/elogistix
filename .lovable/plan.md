## Backfill embarque ELIMP00272: costos por contenedor

### Estado actual
- Embarque `79fe05dc-305f-46d5-a7ab-d40e685fe1ee` con 6 contenedores.
- 2 conceptos de costo "generales" (`contenedor_id = NULL`):
  - Flete Marítimo — USD 5,327.16
  - Cargos en Destino — USD 96.16

### Cambio a aplicar (data-only, sin migración)
Usar la herramienta `supabase--insert` en una sola transacción:

1. **Insertar 12 nuevos `conceptos_costo`** (2 conceptos × 6 contenedores), copiando todos los campos del concepto original (proveedor_id, proveedor_nombre, moneda, fecha_vencimiento, organization_id, embarque_id) y fijando:
   - `contenedor_id` = id del contenedor correspondiente
   - `monto` = monto original sin cambios (5,327.16 / 96.16)
   - `estado_liquidacion` = `'Pendiente'`
   - `fecha_pago`, `referencia_pago` = NULL
2. **Soft-delete** de los 2 conceptos generales originales (`deleted_at = now()`) para no duplicar la suma del embarque.

Total resultante: 6 × 5,327.16 + 6 × 96.16 = **USD 32,539.92** en 12 líneas.

### Verificación post-cambio
- `SELECT contenedor_id, concepto, monto FROM conceptos_costo WHERE embarque_id = ... AND deleted_at IS NULL` → 12 filas, 2 por contenedor.
- Confirmar que el TabCierre del embarque ya muestra los costos repartidos y siguen apareciendo como pendientes de factura proveedor / liquidación (las nuevas reglas de cierre v13.66.12 los van a bloquear hasta facturarlos, que es lo esperado).

### Fuera de alcance
- No se modifican `conceptos_venta` (la venta se sigue manejando como hoy).
- No se crean facturas de proveedor automáticamente.
- No se cambia código ni esquema; solo datos del embarque 272.
