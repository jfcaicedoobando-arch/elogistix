## Problema
El script `audit:tests` detecta un título duplicado `"propaga errores de Supabase"` en dos archivos:
- `src/features/costeo/services/__tests__/demorasVenta.test.ts:51`
- `src/services/facturas/__tests__/detail.test.ts:52`

## Solución
Renombrar ambos tests para incluir contexto de dominio y eliminar la ambigüedad:

1. En `demorasVenta.test.ts`: cambiar a `"propaga errores de Supabase al consultar demoras de venta"`
2. En `detail.test.ts`: cambiar a `"propaga errores de Supabase al consultar factura por ID"`
3. Actualizar `APP_VERSION` → `12.92.3`
4. Registrar cambio en `CHANGELOG.md`

No se toca lógica de negocio, solo los strings descriptivos de los tests.