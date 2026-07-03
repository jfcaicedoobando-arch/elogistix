# Corregir cálculo de IVA en borradores de factura

## Diagnóstico (verificado con datos reales)

Factura `df7a8276...` USD, estado Borrador:
- Subtotal 3,481.00 · IVA guardado 55.36 · Total 3,536.36 · IVA "real" al 16% debería ser 556.96.
- 4 renglones con `tipo_iva = 'gravado_16'` pero `tasa_iva_aplicada = NULL`.

Causa: el RPC `convertir_proformas_a_factura` (proforma → factura Borrador) inserta renglones en `conceptos_factura` sin poblar `tasa_iva_aplicada`. El recálculo de totales lee esa columna, y NULL cuenta como 0. Además, el mismo RPC hardcodea `v_iva_usd := 0`.

## Analogía

Cada renglón tiene un letrero "IVA 16%" (badge) pero el motor que suma el IVA no lee el letrero: lee un tornillo interno (`tasa_iva_aplicada`) que quedó suelto (NULL) al fabricar el borrador. Vamos a apretar el tornillo en 3 sitios: al fabricar (RPC), al recalcular en el cliente (defensivo) y en los borradores ya rotos (backfill).

## Cambios

### 1. Migración SQL (schema-level, `supabase--migration`)

Actualizar `public.convertir_proformas_a_factura` para que:

- Al insertar en `conceptos_factura` (los 4 caminos: MXN consolidada, MXN detalle, USD consolidada, USD detalle) también incluya:
  - `tipo_iva = COALESCE(<origen>.tipo_iva, 'gravado_16')` — si el origen ya trae tipo, respetarlo; si no, gravado_16.
  - `tasa_iva_aplicada = CASE tipo_iva WHEN 'gravado_16' THEN 0.16 WHEN 'tasa_0' THEN 0 ELSE NULL END`.
- Reemplazar el cálculo del header por suma real de renglones:
  - Después de insertar los conceptos, obtener `SUM(cantidad*precio_unitario)` como subtotal y `SUM(cantidad*precio_unitario * COALESCE(tasa_iva_aplicada, 0))` como IVA desde `conceptos_factura` de la factura recién creada.
  - Escribir `subtotal`, `iva`, `total` en `facturas` a partir de esa suma.
  - Aplica igual a MXN y USD → elimina la asimetría `v_iva_usd := 0`.

### 2. Backfill de borradores existentes

Migración corta que corrige sólo lo pendiente y sin tocar históricos:

```sql
UPDATE public.conceptos_factura cf
SET tasa_iva_aplicada = CASE cf.tipo_iva
  WHEN 'gravado_16' THEN 0.16
  WHEN 'tasa_0'     THEN 0
  ELSE NULL
END
FROM public.facturas f
WHERE cf.factura_id = f.id
  AND cf.deleted_at IS NULL
  AND cf.tasa_iva_aplicada IS NULL
  AND f.estado = 'Borrador'
  AND f.uuid_fiscal IS NULL;
```

Luego, recomputar el header de esos borradores desde los renglones ya corregidos (mismo SUM/SUM que en el RPC).

### 3. Fallback defensivo en frontend

`src/features/facturacion/services/conceptosFacturaCrud.ts` → `recalcularTotalesFactura`:

- Al leer los renglones, si `tasa_iva_aplicada` es NULL usar `resolverTasa(tipo_iva)` como respaldo. Así, aunque un renglón futuro llegue sin la tasa, el recalculador la resuelve desde `tipo_iva`.

Sin cambios en la UI (`FacturaTotalesCard` y `FacturaConceptosTable` ya muestran lo correcto una vez que los totales están bien).

### 4. Verificación post-implementación

- Consulta a la factura `df7a8276...` después del backfill: subtotal 3,481.00 · IVA 556.96 · Total 4,037.96.
- Crear una factura Borrador nueva convirtiendo una proforma: los 3 valores del card "Totales" deben coincidir con la suma de `precio_unitario × cantidad × (1 + tasa)` de los renglones.
- Typecheck con `tsc --noEmit`.

### 5. Versión y changelog

- `APP_VERSION` → `13.170.5`.
- Entrada en `CHANGELOG.md` describiendo la corrección del IVA en Borradores.

## Fuera de alcance

- **Facturas timbradas** (con `uuid_fiscal`): NO se tocan — sus totales son los que el SAT tiene. Cualquier discrepancia histórica queda como estaba.
- No se cambian tasas por producto ni la lógica del catálogo.
- No se toca la generación del PDF (usa los mismos campos `factura.subtotal/iva/total`, así que al corregirlos el PDF también sale bien).

## Riesgos

Bajos. El backfill limita el WHERE a `Borrador` + `uuid_fiscal IS NULL`. El RPC nuevo cambia el header USD (antes 0, ahora 16% real cuando aplica) — es exactamente lo que el usuario está pidiendo.
