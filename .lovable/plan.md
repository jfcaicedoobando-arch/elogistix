## Reglas nuevas de cierre del embarque (v13.66.12)

Agregar 3 reglas duras a `validar_cierre_embarque` para que el cierre **no se ejecute** mientras queden cabos sueltos en conceptos de venta o de costo.

### 1. Migración — `validar_cierre_embarque` extendido

Reescribir el RPC para agregar **3 checks** antes del retorno (orden tras `comision_calculada`):

- **`venta_conceptos_facturados`** — `ok=true` solo si no existe ningún `conceptos_venta` con `embarque_id = p_embarque_id`, `deleted_at IS NULL` y `estado_facturacion <> 'facturado'`. Devuelve `detalle = { pendientes: N, en_proforma: N }` para que el checklist muestre cuántos quedan.

- **`costo_conceptos_con_factura`** — `ok=true` solo si todo `conceptos_costo` (no borrado) tiene al menos una entrada en `proveedor_facturas_conceptos` vinculada a una `proveedor_facturas` no cancelada. Devuelve `detalle = { sin_factura: N }`.

- **`costos_liquidados`** — `ok=true` solo si no existe `conceptos_costo` con `estado_liquidacion = 'Pendiente'` (o equivalente). Devuelve `detalle = { pendientes: N }`.

Las 3 alimentan `v_puede` (AND) igual que las demás reglas. Si alguna falla, el botón "Cerrar embarque" queda deshabilitado.

### 2. UI — etiquetas en `TabCierre`

Agregar al diccionario `ETIQUETAS_REGLA`:

- `venta_conceptos_facturados`: `"Todos los conceptos de venta facturados"`
- `costo_conceptos_con_factura`: `"Todos los costos tienen factura de proveedor recibida"`
- `costos_liquidados`: `"Todos los costos están liquidados (pagados al proveedor)"`

Sin cambios estructurales: `CierreChecklistCard` ya renderiza cualquier regla devuelta por el RPC.

### 3. Tests

`TabCierre.rules.test.ts` (existente) — agregar 3 casos: una regla en `ok=false` por cada nueva, verificar que el botón se deshabilita y que la etiqueta aparece en rojo.

### 4. Metadata

- `APP_VERSION` → `13.66.12`.
- Entrada en `CHANGELOG.md` describiendo las 3 reglas nuevas, cómo se calculan y por qué (ventas/costos sin formalizar dejaban embarques con utilidad falsa).

## Fuera de alcance

- No se modifica la UI de Facturación ni de Conciliación (ya muestran los pendientes; solo se agrega bloqueo formal al cerrar).
- No se hace backfill de embarques cerrados previamente (mantienen su estado).
- No se altera el modelo de `estado_facturacion` ni `estado_liquidacion`.

## Detalles técnicos clave

- RPC mantiene `SECURITY DEFINER` + `SET search_path = public`.
- Las consultas nuevas son simples `EXISTS` / `COUNT(*)` con índice sobre `embarque_id` (ya existe en ambas tablas).
- La regla `costos_liquidados` es independiente de `cxp_pagada`: cxp valida que `proveedor_facturas` estén pagadas, pero un `conceptos_costo` puede no estar marcado como `Liquidado` si nadie cruzó el pago al concepto.
