# Fix de las 6 suites RLS que siguen rojas

Logs decodificados (`logs_74463336657.zip`): `isolation` pasa ✓. Las otras 6 fallan por **enums/columnas inválidas en los fixtures**, no por problemas de RLS ni de workflow. La infra (cache, matrix guard, aggregator, GRANTs) funciona — el dump se restaura, `SET ROLE authenticated` ya no truena. Los errores ahora son del SQL de los tests contra el esquema real.

## Hallazgos exactos por suite

| # | Suite | Línea | Error |
|---|---|---|---|
| 1 | `crm_operacional` | 163 | `invalid input value for enum crm_actividad_tipo: "correo"` |
| 2 | `financiero_critico` | 276 | `invalid input value for enum estado_conciliacion: "pendiente"` |
| 3 | `financiero` | 135 | `column "estado" of relation "proformas" does not exist` |
| 4 | `roles_no_admin` | 207 | `column "tipo_cambio" does not exist` (en `pagos_factura`) |
| 5 | `operaciones` | 190 | `column "saldo" of relation "facturas" does not exist` |
| 6 | `tarifas_y_costeo` | 189 | `new row for relation "costeo_tarifas" violates check constraint "costeo_tarifas_estado_check"` |

> Ironía del lote previo: en 13.44.19 "arreglé" `pagos_factura` añadiendo `tipo_cambio` porque era NOT NULL en el esquema que asumí; el esquema real no tiene esa columna. Por eso es indispensable mirar las migraciones, no el resultado anterior.

## Pasos

1. **Inspeccionar esquema real** en `supabase/migrations/`:
   - `grep -rn "CREATE TYPE crm_actividad_tipo\|ALTER TYPE crm_actividad_tipo"` → ver valores válidos del enum (probablemente `email` en lugar de `correo`, o `llamada/reunion/...`).
   - `grep -rn "CREATE TYPE estado_conciliacion"` → valores válidos (probablemente `Pendiente` capitalizado, o `conciliada/no_conciliada`).
   - `grep -rn "CREATE TABLE public.proformas\|ALTER TABLE public.proformas"` → nombre real de la columna estado (probablemente `estado_proforma`).
   - `grep -rn "CREATE TABLE public.pagos_factura\|ALTER TABLE public.pagos_factura"` → columnas reales (revisar si `tipo_cambio` debe omitirse o reemplazarse por otra).
   - `grep -rn "CREATE TABLE public.facturas\|ALTER TABLE public.facturas"` → confirmar que `saldo` no existe; muy probable que sea columna generada/eliminada y la suite debe calcular `total - pagado` o usar otra columna.
   - `grep -rn "costeo_tarifas_estado_check\|CREATE TABLE public.costeo_tarifas"` → valores permitidos por el CHECK.

2. **Editar cada suite** con los valores correctos:
   - `test_rls_crm_operacional.sql` línea 163: reemplazar `'correo'` por el valor enum válido.
   - `test_rls_financiero_critico.sql` línea 276: reemplazar `'pendiente'` por el valor enum válido (probable `'Pendiente'` con capitalización exacta).
   - `test_rls_financiero.sql` línea 135: renombrar `estado` → nombre real de la columna en `proformas`.
   - `test_rls_roles_no_admin.sql` línea 207: quitar `tipo_cambio` del INSERT (o reemplazar por la columna correcta — posiblemente `tasa_cambio` o no existe del todo).
   - `test_rls_operaciones.sql` línea 190: reemplazar `saldo` por la columna correcta (probable `total - SUM(pagos)` o `monto_pendiente`).
   - `test_rls_tarifas_y_costeo.sql` línea 189: usar un valor permitido por `costeo_tarifas_estado_check`.

3. **Validar en local** (no factible aquí sin Postgres) — confiar en `grep` del esquema. En CI, el cache de snapshot del workflow funciona; el job `rls` no re-corre.

4. **Bump versión + changelog**: `APP_VERSION = 13.44.22`, entrada en `CHANGELOG.md`.

## Por qué falló mi fix anterior (lección)

En 13.44.19 inferí columnas/enums por error message en lugar de mirar el `CREATE TABLE`/`CREATE TYPE` real. Resultado: introduje regresiones nuevas (`tipo_cambio` inexistente). Esta vez: **leer el DDL real de cada tabla/enum antes de editar el fixture**, sin asumir.

## Detalles técnicos

Archivos a tocar (solo las líneas indicadas, no lógica completa):
```
supabase/tests/rls/test_rls_crm_operacional.sql      L163
supabase/tests/rls/test_rls_financiero_critico.sql   L276
supabase/tests/rls/test_rls_financiero.sql           L135
supabase/tests/rls/test_rls_roles_no_admin.sql       L207
supabase/tests/rls/test_rls_operaciones.sql          L190
supabase/tests/rls/test_rls_tarifas_y_costeo.sql     L189
src/constants/appVersion.ts                          13.44.22
CHANGELOG.md                                         entrada nueva arriba
```

## Confirmación

¿Procedo? Implementaré las 6 ediciones después de confirmar valores válidos contra las migraciones reales (1 lectura por enum/tabla, en paralelo).
