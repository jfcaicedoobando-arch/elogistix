## Problema

Timbrado falla con `"items[0].product.taxes[0].rate" is required` porque `buildFacturapiPayload` omite el campo `rate` cuando el concepto es Exento. FacturApi valida `rate` como requerido en cada elemento del array `taxes`, incluso cuando `factor: "Exento"`.

## Fix

**`supabase/functions/facturapi-emitir/helpers.ts`** — En la construcción del arreglo `taxes` dentro de `buildFacturapiPayload` (líneas 117-121 aprox), incluir siempre `rate` (0 para Exento y tasa_0, o `c.tasa_iva ?? 0.16` para gravado):

```ts
const taxes = tipo === "exento"
  ? [{ type: "IVA" as const, rate: 0, factor: "Exento" as const }]
  : [{ type: "IVA" as const, rate: tipo === "tasa_0" ? 0 : (c.tasa_iva ?? 0.16), factor: "Tasa" as const }];
```

Y ajustar el tipo `taxes` en `FacturapiPayload` (línea 65) para que `rate` sea requerido (`rate: number`), no opcional.

## Test

Actualizar/agregar caso en tests de `buildFacturapiPayload` (si existen) para asegurar que un concepto Exento genera `rate: 0` explícito. Si no existe test, agregar uno mínimo.

## Fuera de alcance

- No se toca RLS, migraciones, ni el cliente React.
- No se cambia el resto de la pipeline (validación de contexto, resolución de key, etc.).

## Versionado

- `src/constants/appVersion.ts` → `13.170.20`
- `CHANGELOG.md` → entrada `[13.170.20]` describiendo el fix con referencia a Sentry `FEATURES_FACTURACION_HOOKS_USETIMBRARFACTURA_1` (Elogistix / karol.hernandez, factura a87af985).
- Marcar el issue en Sentry como `resolved` (`update_issue`) referenciando el fix.
