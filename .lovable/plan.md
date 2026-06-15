## Problema

CI (`rls-tests`) sigue rompiendo en `Apply migrations`. Resuelto el drift de `es_consolidada`, ahora el siguiente blocker es:

```
psql:supabase/migrations/20260517020910_…sql:96: ERROR: extension "pg_cron" is not available
```

Las migraciones `20260517020910` y `20260604052500_email_infra.sql` hacen `CREATE EXTENSION pg_cron` (+ `pg_net`) y llaman `cron.schedule(...)`. La imagen `postgres:15` de GitHub Actions **no trae** `pg_cron` ni `pg_net` (sólo existen en la Postgres administrada de Supabase). En prod ya están instaladas; en CI no hay forma de instalarlas sin cambiar de imagen.

Como las migraciones son inmutables, hay que neutralizar esas líneas **sólo en CI**, manteniendo prod intacto.

## Estrategia

Mismo patrón que ya usamos para `auth.*`, `storage.*` y el drift de `es_consolidada`: stubs en bootstrap + intercepción en el loop del workflow.

### 1. Ampliar `supabase/tests/rls/_ci_bootstrap.sql`

Agregar al final:

- `CREATE SCHEMA IF NOT EXISTS cron;`
- `CREATE SCHEMA IF NOT EXISTS net;`
- Funciones no-op compatibles con las firmas que invoca el código:
  - `cron.schedule(job_name text, schedule text, command text) RETURNS bigint` → devuelve `0`.
  - `cron.unschedule(job_name text) RETURNS boolean` → devuelve `true`.
  - `net.http_post(url text, headers jsonb, body jsonb) RETURNS bigint` → devuelve `0` (si la migración email lo invoca).
- `GRANT USAGE` a `anon, authenticated, service_role`.

Esto permite que cualquier `SELECT cron.schedule(...)` ejecute sin error.

### 2. Filtrar `CREATE EXTENSION pg_cron|pg_net` en el loop del workflow

En `.github/workflows/rls-tests.yml`, dentro del step `Apply migrations`, cambiar:

```bash
$PSQL -f "$f"
```

por:

```bash
# CI no tiene pg_cron / pg_net (sólo existen en Supabase managed Postgres).
# Comentamos esas líneas on-the-fly; los stubs en cron/net del bootstrap
# se encargan de que cron.schedule(...) ejecute como no-op.
sed -E 's/^[[:space:]]*CREATE EXTENSION[[:space:]]+(IF NOT EXISTS[[:space:]]+)?pg_(cron|net).*/-- [ci] &/I' "$f" | $PSQL
```

El `DO $$ ... CREATE EXTENSION pg_cron ... $$` de `20260604052500` queda dentro de un bloque PL/pgSQL y `sed` no puede tocarlo selectivamente; ese bloque está protegido por `IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')` — en CI el `SELECT` devuelve falso y entra al `CREATE EXTENSION` que también falla. Lo arreglo añadiendo, **antes** de aplicar esa migración específica (mismo patrón de drift-fix que `es_consolidada`), un sentinel:

```sql
INSERT INTO pg_extension(extname, …)
```

no es viable — `pg_extension` es system catalog. Alternativa real: aplicar también `sed` a esa migración para reemplazar el bloque `CREATE EXTENSION pg_cron;` interno por `NULL;`. La regex anterior con `[[:space:]]*` cubre indentación arbitraria, así que también captura el caso indentado de `email_infra`.

### 3. Versionado

- `APP_VERSION` → `13.21.17`
- Entrada en `CHANGELOG.md` describiendo el stub de `cron`/`net` y el filtro de `CREATE EXTENSION`.

## Archivos a tocar

- `supabase/tests/rls/_ci_bootstrap.sql` — añadir bloque cron/net.
- `.github/workflows/rls-tests.yml` — cambiar `$PSQL -f` por pipeline con `sed`.
- `src/constants/appVersion.ts` — bump.
- `CHANGELOG.md` — entrada `[13.21.17]`.

## Pregunta

¿Quieres que también agregue un comentario explicativo en las dos migraciones afectadas (no editando — sólo no se puede), o basta con dejar la nota en `CONTRIBUTING.md` para que futuros devs sepan que `pg_cron`/`pg_net` se neutralizan en CI?