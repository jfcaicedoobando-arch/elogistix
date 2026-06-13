## Plan: CI workflow para suites RLS

Wire a GitHub Actions workflow que ejecute las 4 suites RLS existentes contra una base efímera, para que cada PR/commit valide el aislamiento multi-tenant.

### Entregables

1. **`.github/workflows/rls-tests.yml`** — nuevo workflow:
   - Triggers: `pull_request` (paths: `supabase/**`), `push` a `main`, `workflow_dispatch`.
   - Servicio `postgres:15` (puerto 5432, password efímero).
   - Pasos:
     1. `checkout`.
     2. Esperar a Postgres con `pg_isready`.
     3. Aplicar TODAS las migraciones de `supabase/migrations/*.sql` en orden (psql `-f`).
     4. Ejecutar `supabase/tests/rls/_seed_auth_users.sql` (nuevo, ver abajo) para crear `auth.users` mínimos usados por los seeds de las suites.
     5. Correr secuencialmente las 4 suites con `psql -v ON_ERROR_STOP=1 -f`:
        - `test_rls_isolation.sql`
        - `test_rls_financiero.sql`
        - `test_rls_financiero_critico.sql`
        - `test_rls_crm_operacional.sql`
        - `test_rls_operaciones.sql`
     6. Falla el job si cualquier `RAISE EXCEPTION` se dispara.

2. **`supabase/tests/rls/_seed_auth_users.sql`** — helper nuevo:
   - Crea esquema `auth` y tabla mínima `auth.users(id uuid primary key, email text)` si no existen (para el contenedor CI que arranca Postgres puro, sin GoTrue).
   - Inserta los UUIDs fijos que las suites usan vía `set_config('request.jwt.claims.sub', ...)`.
   - Idempotente (`ON CONFLICT DO NOTHING`).

3. **`supabase/tests/rls/README.md`** — sección "CI" explicando:
   - Cómo corre el workflow.
   - Cómo reproducir local con Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15` + los mismos comandos psql.
   - Que el seed `_seed_auth_users.sql` solo se usa en CI (en Lovable Cloud `auth.users` ya existe).

4. **`CHANGELOG.md`** + bump `APP_VERSION` a `13.12.0`:
   - `- CI: workflow rls-tests.yml que ejecuta las 4 suites RLS en cada PR.`

### Detalles técnicos

- El workflow NO requiere secrets — usa Postgres efímero del runner. No toca producción ni Lovable Cloud.
- Las migraciones se aplican con `for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done` ordenadas alfabéticamente (timestamp prefix garantiza orden).
- Limitación conocida: si alguna migración depende de extensiones no presentes en `postgres:15` base (p.ej. `pgcrypto`, `uuid-ossp`), el job las `CREATE EXTENSION` antes del loop — verificaré qué extensiones usa el proyecto durante implementación.
- Riesgo: si una migración usa funciones de Supabase (`auth.uid()`, `auth.jwt()`) que no existen en Postgres vanilla, el seed `_seed_auth_users.sql` también stubeará esas funciones leyendo `current_setting('request.jwt.claims.sub')` — mismo patrón que ya usan las suites RLS internamente.

### Fuera de alcance

- Suite residual (notas/auditoría/alertas) — descartada por bajo ROI.
- E2E/performance — siguiente fase (c) después de que CI esté verde.
