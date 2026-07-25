
## Problema

La página `/compras` (Aging CxP) muestra el toast "No pudimos cargar la información". Sentry reporta:

```
42804: structure of query does not match function result type
Returned type moneda does not match expected type text in column 3.
```

## Causa raíz (confirmada por inspección del RPC)

En `proveedor_facturas`, la columna `moneda` es de un tipo de dominio/enum llamado `moneda` (no `text`). La función `public.cxp_aging_proveedores` declara la columna 3 de retorno como `text`, pero el CTE `saldos` selecciona `COALESCE(pf.moneda, 'MXN') AS moneda`, que preserva el tipo de dominio. Postgres rechaza el `RETURN QUERY` porque los tipos no coinciden exactamente (aunque sean asignables).

Este bug apareció al introducir la segmentación por moneda (QW3, v13.315.9): antes se devolvía un literal `'MXN'` (que sí era `text`), ahora se devuelve la columna real.

## Fix

Migración única que reemplaza `cxp_aging_proveedores` casteando la moneda a `text` explícitamente en el CTE:

```sql
COALESCE(pf.moneda, 'MXN')::text AS moneda
```

El resto de la función queda igual. La firma pública (`RETURNS TABLE(... moneda text ...)`) no cambia, así que el cliente TS y los tests siguen igual.

## Verificación

1. Recargar `/compras/aging` — debe listar aging sin toast rojo.
2. `SELECT * FROM public.cxp_aging_proveedores() LIMIT 1;` debe ejecutar sin error 42804.
3. Los tests existentes de `cxpAging` (segmentación por moneda) siguen pasando (no tocan SQL).

## Changelog

- `APP_VERSION` → `13.316.1`.
- Entrada en `CHANGELOG.md`: "Fix RPC `cxp_aging_proveedores`: castear `moneda` a `text` para evitar error 42804 al abrir /compras."

## Analogía

El RPC prometió entregar la moneda como "texto plano", pero al añadir la separación por moneda empezó a entregarla en su empaque original (tipo `moneda`). Postgres es estricto con el empaque aunque el contenido sea el mismo — sólo hay que "desempacar" (cast a text) antes de entregarlo.
