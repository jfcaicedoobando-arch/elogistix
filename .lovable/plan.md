## Problema

Al convertir la proforma PRO-2026-0949 (INDIMEX TRADING) a factura borrador, Postgres rechaza el insert con `check constraint "facturas_tipo_cambio_pos"` (23514). `facturas.tipo_cambio` debe ser `> 0`.

**Causa**: el RPC `convertir_proformas_a_factura` siempre inserta la factura en MXN y calcula `tipo_cambio = subtotal_mxn / subtotal_usd`. Esta proforma es **100% USD**: `subtotal_usd = 7,200`, `subtotal_mxn = 0`. Entonces `tipo_cambio = 0 / 7200 = 0` → viola la restricción. Además la factura quedaría con `subtotal = 0`, que tampoco tiene sentido.

Analogía: es como intentar convertir dólares a pesos usando "cero pesos por dólar" — el sistema por defecto asume MXN cuando en realidad la proforma se cotizó en dólares.

## Solución

Actualizar el RPC `convertir_proformas_a_factura` para detectar la moneda de la proforma y usar montos coherentes.

### Regla de moneda del borrador
- Si `subtotal_mxn > 0` y `subtotal_usd = 0` → factura en **MXN**, `tipo_cambio = 1`.
- Si `subtotal_usd > 0` y `subtotal_mxn = 0` → factura en **USD**, `tipo_cambio = 1` (placeholder; FacturApi asigna el tipo de cambio DOF real al timbrar).
- Si **ambos > 0** (proforma mixta) → factura en **MXN** con `tipo_cambio = ROUND(subtotal_mxn / subtotal_usd, 4)` (comportamiento previo).
- Si ambos = 0 → error explícito ("La proforma no tiene importes").

### Cambios técnicos
1. **Nueva migración** que reemplaza la función `public.convertir_proformas_a_factura` con la lógica anterior + selector de moneda descrito. El resto del RPC (validaciones, inserción de conceptos, marca de proformas como facturadas, `numero = BORRADOR-…`) se conserva.
2. `CHANGELOG.md` con entrada breve del fix.
3. Bump `APP_VERSION` a `13.147.1` en `src/constants/appVersion.ts`.

### Verificación
- Reintentar la conversión de PRO-2026-0949 (USD) desde el detalle de proforma → debe generar borrador con moneda USD, `tipo_cambio = 1`, subtotal 7,200 USD.
- Probar también una proforma en MXN existente para asegurar que el flujo previo sigue funcionando.

Sin cambios de UI ni de reglas de permisos.