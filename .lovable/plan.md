## Problema

Al convertir la proforma, Postgres devuelve `42804: column "moneda" is of type moneda but expression is of type text`. `facturas.moneda` es un enum (`MXN | USD | EUR`); en el RPC actualizado en v13.147.1 declaré `v_moneda text` y lo inserto sin cast, así que Postgres no lo acepta.

Analogía: es como intentar meter la palabra "MXN" escrita en papel a un buzón que sólo acepta fichas oficiales tipo `moneda`. Hay que "sellar" la ficha con el cast `::moneda` antes de insertarla.

## Solución

Nueva migración que reemplaza `public.convertir_proformas_a_factura` con el mismo contenido de v13.147.1 pero:

- Al insertar en `facturas`, cambiar `v_moneda` por `v_moneda::moneda` para que el enum acepte el valor.
- (Alternativa equivalente: declarar `v_moneda public.moneda` en las variables; el cast en el INSERT es más explícito y no cambia el resto.)

No se altera el enum ni ninguna otra tabla, y no hay cambios de UI ni permisos.

### Cambios
1. **Migración**: `CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(...)` con el cast `v_moneda::moneda` en el INSERT a `facturas`.
2. `CHANGELOG.md`: entrada `## [13.147.2]` describiendo el cast.
3. `src/constants/appVersion.ts` → `13.147.2`.

### Verificación
- Reintentar la conversión de PRO-2026-0949 (USD) → debe insertar factura borrador con `moneda = 'USD'`, `tipo_cambio = 1`.
- Probar una proforma MXN existente → sigue funcionando.