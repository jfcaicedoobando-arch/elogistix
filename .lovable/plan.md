# Correr la suite RLS y de guards en base de datos

Estoy en modo plan, y correr la suite levanta una base Postgres local, aplica las 1000+ migraciones y ejecuta los archivos SQL de `supabase/tests/` — eso modifica estado (aunque sea sólo local y efímero), así que necesito tu aprobación antes de ejecutarlo.

## Qué voy a hacer

1. Ejecutar `bun run db:verify:all`, que:
   - levanta la base local desde cero,
   - aplica todas las migraciones en orden,
   - corre las suites SQL (financiero, aislamiento multi-tenant, costeo, roles, operaciones, guards de conducta) y el linter de alcance por organización.
2. Leer la salida completa e identificar cada fallo real (no sólo el primero).
3. Reportarte el resultado: si todo pasa, te lo digo y no toco nada.

## Si hay fallos

- Diagnostico cada uno antes de escribir SQL: distingo entre una regresión real de la base y un test desactualizado respecto a una migración reciente.
- Si el fallo es de la base (política, grant, guard, firma de función), lo corrijo con una migración nueva.
- Si el fallo es del test (por ejemplo una firma que cambió), actualizo el test.
- Si cambia el esquema, resincronizo `supabase/schema/baseline.sql`.
- Vuelvo a correr la suite completa hasta que quede verde, y registro el resultado en `CHANGELOG.md` con bump de `APP_VERSION`.

## Nota técnica

Los últimos ciclos de esta suite fallaron por tres causas recurrentes que revisaré primero si vuelven a aparecer: la whitelist de FIX-45 (funciones `SECURITY DEFINER` ejecutables por `anon`), sobrecargas duplicadas de funciones tras una migración, y desfase del baseline de esquema por diferencias de formato de `pg_dump`.
