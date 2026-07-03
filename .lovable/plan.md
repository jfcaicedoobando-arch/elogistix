## Objetivo

En el detalle de una factura, cada renglón podrá marcarse como **Gravado 16%**, **Tasa 0%** o **Exento**. El indicador aparece en la tabla de conceptos (borrador y timbrada) y el total de IVA se recalcula por renglón. El PDF queda igual (fuera de alcance).

## Cambios de base de datos

Migración sobre `public.conceptos_factura`:

- Nueva columna `tipo_iva text NOT NULL DEFAULT 'gravado_16'` con `CHECK (tipo_iva IN ('gravado_16','tasa_0','exento'))`.
- Nueva columna `tasa_iva_aplicada numeric(6,4)` (nullable). Se llena al insertar/editar usando la tasa vigente cuando `tipo_iva='gravado_16'`; `0` para `tasa_0`; `null` para `exento`.
- Backfill: filas existentes → `tipo_iva='gravado_16'`, `tasa_iva_aplicada = TASA_IVA` global (16%).
- Sin cambios de RLS ni de grants (la tabla ya los tiene).

## Cambios de servicio (`conceptosFacturaCrud.ts`)

- `ConceptoFacturaInput` gana `tipo_iva: 'gravado_16'|'tasa_0'|'exento'` (default `gravado_16`).
- `normalizarLinea` incluye `tipo_iva` y calcula `tasa_iva_aplicada` (0.16 / 0 / null).
- `recalcularTotalesFactura`:
  - Lee `cantidad, precio_unitario, tipo_iva, tasa_iva_aplicada`.
  - `subtotal` = suma de todos los importes.
  - `iva` = suma por renglón de `importe * (tasa_iva_aplicada ?? 0)` (exento no aporta).
  - `total` = subtotal + iva.
- `fetchConceptosFactura` selecciona las dos columnas nuevas.

## Cambios de UI (sólo vista web)

`FacturaConceptosEditorRows.tsx` (renglón editable):
- Nueva columna estrecha con un `Select` de 3 opciones: **16% · 0% · Exento**.
- Se reajustan `col-span` (descripción 4, SAT 2, cant 1, p.u. 2, **IVA 1**, acciones 2).

`FacturaConceptosTable.tsx` (vista sólo-lectura):
- Añadir columna **IVA** con badge de color:
  - `gravado_16` → badge por defecto `16%`
  - `tasa_0` → badge secundario `0%`
  - `exento` → badge outline `Exento`
- Para facturas ya timbradas, leer el campo del snapshot de Facturapi (`taxes[].rate` / `withholding`), mapear a esos 3 valores; si el snapshot no lo trae, mostrar `—`.
- Vista mobile: agregar la etiqueta bajo la descripción.

`FacturaManualConceptosTable.tsx` (alta manual):
- Mismo selector por renglón; el cálculo de subtotal/IVA/total del pie usa la nueva regla.

## Envío a Facturapi (timbrado)

`DialogTimbrarFactura` y el builder de payload ya toman los conceptos vigentes; adaptar el mapper para que cada concepto exporte su `product.taxes` según `tipo_iva`:
- `gravado_16` → `{ type: 'IVA', rate: 0.16 }`
- `tasa_0` → `{ type: 'IVA', rate: 0, factor: 'Tasa' }`
- `exento` → `{ type: 'IVA', factor: 'Exento' }`

Esto es necesario para que el CFDI refleje lo que el usuario ve; si no lo tocamos, el timbrado seguiría enviando todo como 16%.

## Tests

- `conceptosFacturaCrud.test.ts`: agrega casos para los 3 tipos y verifica que `recalcularTotalesFactura` produce el total correcto (mezcla gravado + exento + 0%).
- Test de UI ligero: al cambiar el select en un renglón, el pie de totales del editor se actualiza.

## Housekeeping

- Bump `APP_VERSION` (`13.167.0`) y entrada en `CHANGELOG.md`.
- No requiere cambios en PDF, ni en tests de arquitectura, ni en Frankfurter/Banxico.

## Fuera de alcance

- Retenciones (ISR/IVA retenido) por concepto.
- Cambios en el PDF de factura/proforma.
- Migrar `conceptos_venta` (proformas) — ya tiene su propio `aplica_iva`.
