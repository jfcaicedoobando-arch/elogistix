## Diagnóstico

El error `LC_REP_FACTURA_SIN_TIMBRAR ... line 19 at RAISE` proviene del trigger `trg_pago_factura_rep_viva` sobre `public.pagos_factura`. La hotfix (`v13.301.76`, migración `20260718213500_...sql`) ya está aplicada en la BD de la app: el trigger tiene `WHEN (NEW.uuid_rep IS NOT NULL OR NEW.facturapi_rep_id IS NOT NULL)` y la función tiene early-exit por esos dos campos. El fixture inserta pagos sin esos campos, así que el trigger no debería dispararse.

Verificado:
- La migración hotfix existe en `supabase/migrations/` (timestamp `20260718213500`).
- En la BD real, `pg_get_functiondef` y `pg_get_triggerdef` muestran la versión con early-exit + `WHEN` clause.
- Los defaults de `uuid_rep`, `facturapi_rep_id` son `NULL`; sólo `estado_rep` tiene default `'NoAplica'`.

La falla actual de CI viene de una corrida sobre un checkout que **aún no contenía la migración hotfix** (probablemente un push/rerun previo al commit de la hotfix, o un snapshot de cache que no incluye el nuevo archivo). En un checkout con la hotfix presente, la matriz `rls-suites` invalidaría el cache (hash de `migrations/**` cambia) y aplicaría la nueva definición del trigger, dejando pasar el INSERT de línea 79.

## Objetivo

1. Confirmar que la hotfix se ejecuta en CI en la próxima corrida.
2. Hacer las fixtures inmunes al detalle interno del trigger: los pagos deberían insertarse contra facturas **timbradas**, que es la única forma realista de estado en producción (una factura sin `uuid_fiscal` que reciba pago es un caso operativo inválido).
3. Añadir un guardrail que asegure que la hotfix del guard de REP no se pierda en futuras migraciones.

## Cambios

### 1. Fixtures RLS: timbrar las facturas antes de insertar pagos
Archivos:
- `supabase/tests/rls/test_rls_roles_no_admin.sql`
- `supabase/tests/rls/test_rls_financiero_critico.sql`

En los `INSERT INTO public.facturas(...)` de estas dos fixtures, incluir `uuid_fiscal` (UUID sintético estable) y `fecha_timbrado = now()` para que la factura quede como "timbrada viva". Esto:
- Alinea el fixture con el estado que refleja la lógica de negocio real (una factura que recibe pagos SIEMPRE está timbrada).
- Hace la prueba independiente de la ruta de early-exit del trigger — aunque el `WHEN` clause se dispare, la función pasa la validación de UUID fiscal.

Cambio concreto: agregar `uuid_fiscal, fecha_timbrado` al listado de columnas y valores tipo `gen_random_uuid()::text, now()` en cada fila.

### 2. Guardrail arquitectónico
Archivo: `src/lib/__tests__/rep-guard-hotfix.test.ts` (nuevo)

Test que lee `supabase/migrations/20260718213500_*.sql` y valida:
- Contiene `CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_rep()`.
- La función tiene `IF NEW.uuid_rep IS NULL AND NEW.facturapi_rep_id IS NULL THEN RETURN NEW`.
- Recrea el trigger con `WHEN (NEW.uuid_rep IS NOT NULL OR NEW.facturapi_rep_id IS NOT NULL)`.

Si un futuro cambio revierte el hotfix, este test falla en `bun run test:audit`.

### 3. Bump de versión + changelog
- `APP_VERSION` → `13.301.77` (patch: refuerzo de fixtures RLS).
- Entrada breve en `CHANGELOG.md` referenciando la hotfix previa y describiendo el refuerzo.

## Notas técnicas

- No hay cambios en migraciones ni en RPCs — sólo fixtures de prueba y un test estático.
- El fixture actualizado sigue representando escenarios válidos multi-tenant: `emb_a`/`emb_b` y sus facturas están timbrados, y las aserciones de RLS (isolate cliente A de B) no cambian.
- Si la próxima corrida CI todavía falla con el mismo error, significará que el checkout de CI no incluye la migración hotfix — se resuelve confirmando que el commit del branch bajo prueba contiene `supabase/migrations/20260718213500_*.sql`.
