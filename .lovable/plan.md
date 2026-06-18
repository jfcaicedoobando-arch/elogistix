## Unificar venta por contenedor + backfill ELIMP00272

### Parte 1 — Backfill datos ELIMP00272 (vía `supabase--insert`)

Embarque `79fe05dc-305f-46d5-a7ab-d40e685fe1ee`, 6 contenedores. Hoy `conceptos_venta` tiene 2 filas generales:
- Flete Marítimo · cant 1 · USD 5,665
- Cargos en Destino · cant 1 · USD 125

Aplicar:
1. Por cada uno de los 2 conceptos, insertar 6 nuevas filas en `conceptos_venta`, una por contenedor, con `cantidad = 1`, `precio_unitario` igual al original, `total = precio_unitario`, mismo `moneda/aplica_iva/tasa_iva_aplicada/organization_id`.
2. Soft-eliminar las 2 filas originales (la tabla no tiene `deleted_at`, así que usar `DELETE` directo si no hay FK que lo impida; si las hay, marcar el `total = 0` y `descripcion = '[ANULADO] ...'`). Verificación previa: `proforma_id IS NULL` y `estado_facturacion = 'pendiente'` para confirmar que no están facturadas todavía.

Total venta resultante: 6 × 5,665 + 6 × 125 = **USD 34,740**. Margen vs. costos backfilled (USD 32,539.92) ≈ **USD 2,200**.

### Parte 2 — Unificar regla en código (`parsearVentasJsonb`)

Archivo: `src/features/cotizacion/services/conversiones/embarquesHelpers.ts`.

Cambiar la lógica de replicación para que se comporte como `construirCostosRows`:

- Si `unidad_medida.toLowerCase() === 'contenedor'` Y hay hijos → **una fila por hijo** con `cantidad = (cantidad original)` y `precio_unitario` SIN cambios, `total = cantidad * precio_unitario`. Es decir, **se multiplica el monto por N contenedores** (no se reparte la cantidad).
- Si `unidad_medida === 'BL'` o no hay hijos → 1 fila general con `contenedor_id = null` (sin cambios).
- Eliminar la condición `cantidad >= numHijos` que hoy hace que casos como `cantidad=1` caigan al fallback general.

Esto pone venta y costo en simetría exacta: ambas usan `unidad_medida` para decidir si replicar y ambas multiplican el monto.

### Parte 3 — Actualizar tests

Archivos:
- `src/features/cotizacion/services/conversiones/__tests__/embarquesHelpers.test.ts`
- `src/features/cotizacion/services/conversiones/__tests__/embarquesHelpers.integration.test.ts`

Cambios:
- Reescribir los 4 tests `(v13.66.11)` que asumen el reparto de cantidad: ahora deben verificar que `cantidad` se preserva y `monto total = monto original × N`.
- El caso "cantidad < numHijos cae a fallback" pasa a comportarse como "replica multiplicando" (ya no hay fallback por cantidad).
- Caso "residual al último hijo" se elimina o se reemplaza por "todas las filas tienen la misma cantidad/precio".

### Parte 4 — Metadata

- Bump `APP_VERSION` a `13.66.13` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` raíz: explicar la unificación de regla venta/costo por contenedor + backfill manual de ELIMP00272.

### Fuera de alcance
- No se tocan cotizaciones existentes ni otros embarques históricos. Sólo el embarque 272 y la regla para conversiones futuras.
- No se modifica el wizard de cotización (sigue capturando ventas como hoy).
- No se cambian reglas de facturación, proforma, ni cierre.

### Riesgos
- Cotizaciones donde el vendedor capturó `cantidad = N contenedores` con `precio_unitario` ya pensado como total/contenedor se DUPLICARÍAN al convertirse a embarque con la nueva regla. Mitigación: la regla nueva sólo se dispara para conversiones futuras; los embarques históricos no se re-procesan. Se documenta en el changelog.
