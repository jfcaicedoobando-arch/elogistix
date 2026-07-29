## Objetivo

Aplicar los 8 `FIX GHA-*` pendientes del documento subido. Verifiqué el estado actual del repo y los 8 siguen sin aplicarse:

- `post-deploy-smoke.yml` sólo corre por cron diario (`0 13 * * *`) + `workflow_dispatch`, y sus jobs son únicamente HTTP a edge functions.
- No existe `supabase/tests/rls/test_rls_rpc_smoke_roles.sql`.
- `package.json` no tiene script de generación/verificación de `types.ts`.
- La cache key de `rls-tests.yml` no incluye todos los `supabase/tests/rls/*.sql` y varios guards viven bajo `cache-hit != 'true'`.
- No existe `supabase/functions/deno.lock`.
- `vitest.config.ts` tiene `maxForks: 1` fijo.
- Ningún workflow declara `environment:`.
- `e2e.yml` tiene `guard-secrets`, pero los jobs usan skips internos (`steps.*.outputs.skip`) que pueden ocultar fallos.

## Ola 1 — Cobertura real de RPCs (🔴)

**GHA-1 · rpc-smoke post-deploy**
- Añadir trigger `workflow_dispatch` con input de entorno + disparo tras publish (además del cron) y un job nuevo `rpc-smoke` que llame por HTTP (PostgREST `/rest/v1/rpc/...`) las RPCs de dinero contra el entorno desplegado, fallando si alguna devuelve error 4xx/5xx.

**GHA-2 · suite `rls-smoke-as-role`**
- Crear `supabase/tests/rls/test_rls_rpc_smoke_roles.sql`: fixtures mínimos + ejecución de las RPCs `SECURITY DEFINER` de dinero como `agente_carga` y otros roles, verificando que no revientan por drift de columnas ni filtran datos de otra organización.
- Registrar la suite en la matriz de `rls-tests.yml` (la matriz ya se parsea dinámicamente, sólo hay que agregar la entrada).

**GHA-3 · drift de `types.ts`**
- Añadir script `db:types` / `db:types:check` en `package.json` y un job en CI que regenere los tipos contra la base efímera de migraciones y falle si difieren del archivo versionado.
- Nota: si la generación requiere el CLI de Supabase y acceso a la base, el job correrá dentro del contenedor de Postgres que ya usa `rls-tests.yml`.

## Ola 2 — Robustez del pipeline (🟠)

**GHA-4** — Mover los guards conductuales fuera del bloque `cache-hit != 'true'` y ampliar la cache key para incluir todos los `supabase/tests/rls/*.sql`.

**GHA-5** — Generar `supabase/functions/deno.lock` para las 42 edge functions y añadir `--lock` en `ci.yml`, `deno-typecheck.yml` y `post-deploy-smoke.yml`.

**GHA-8** — Ampliar `guard-secrets` para cubrir todos los secretos usados y eliminar los skips internos por job, de modo que una configuración incompleta falle en un solo punto en vez de "pasar en verde" saltando pasos.

## Ola 3 — Entornos y velocidad (🟠/🟡)

**GHA-7** — Declarar `environment: e2e-staging` en `e2e.yml` y `environment: production` en `deploy-gate.yml`. Las protection rules y los secretos por environment se configuran manualmente en Settings de GitHub; entregaré la lista exacta de pasos.

**GHA-6** — En `vitest.config.ts`, hacer el paralelismo dependiente de `process.env.CI` (2 forks en CI, 1 en local), respetando el techo de heap documentado.

## Detalles técnicos

- Se respetan las convenciones del repo: actions pineadas a SHA con comentario `# vX.Y.Z`, `persist-credentials: false`, imagen Postgres pineada por digest, `permissions:` mínimos, runners `ubuntu-24.04`.
- Verificación al cierre de cada ola: `actionlint`, `bun run typecheck`, `bun run audit:migrations` y la suite de tests afectada.
- Se actualiza `CHANGELOG.md` y `APP_VERSION` por ola.

## Fuera de alcance

- Crear los environments y sus protection rules en GitHub (requiere acceso a Settings del repo; se documentan los pasos).
