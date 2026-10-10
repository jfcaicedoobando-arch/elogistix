# CI de Libre Carga

Fuente de verdad: `.github/workflows/` y `.github/actions/`.
Workflows revisados el **2026-10-10**. Esta guía no configura protección de rama.

## CI principal

`ci.yml`: PR, push a `main` y dispatch manual. Sin `paths-ignore`.
`Detectar áreas` usa `scripts/ci/detect-areas.sh` para frontend/edge/database.
El agregador comprueba omisiones válidas, no las presenta como tests pasados.

| Job | Trabajo |
| --- | --- |
| `Detectar áreas` | Clasificación del diff y actionlint cuando cambia su configuración |
| `ESLint` | Lint `--max-warnings=0`, caché por contenido |
| `Typecheck · guards DB · build · Deno` | Steps condicionados por área |
| `Vitest shard 1/5` … `5/5` | Cinco shards de la suite normal |
| `CI Success (aggregator)` | Éxito/omisión válida de los jobs esperados |

Nueve jobs al expandir la matriz. ESLint, comprobaciones y shards pueden
correr en paralelo.

- Frontend: typecheck, build, límites de bundle y sourcemaps.
- DB: manifiesto, schema, schema-functions, migraciones, replay-mirror y rpc-sync.
- Edge: Deno **2.9.7 estable fijado**, `*_test.ts` salvo smoke; typecheck habilitado.
- Vitest: `bun run test -- --shard=N/5`, **sin coverage, retry ni blobs**.
  Scripts de coverage optativos no describen el CI principal.

Bun **1.4.0** vía `setup-bun`. Cada job tiene instalación/caché propia;
`node_modules` no se comparte en memoria entre runners.
Sin caché: lockfile congelado, `--ignore-scripts`.
La acción compartida fija Node **22.22.0**, con caché por SO/arquitectura/runtime.
SQL-only conocido omite lint/typecheck/build/PDF, pero conserva todos los shards
Vitest por sus contratos SQL y los guards DB. Los paths desconocidos conservan
frontend activo. Actionlint vive en el detector (ya no tiene workflow separado)
y cualquier fallo bloquea el agregador; también corre en dispatch/fallback.

El selector distingue un diff **válido sin rutas** (incluidos base=head y un
commit nuevo con el mismo árbol) de no poder calcularlo. Sólo el primero deja
todas las áreas inactivas. Dispatch, eventos desconocidos, base/head inválidos
y errores de Git o del archivo temporal conservan todas las comprobaciones.
Las rutas se leen delimitadas por NUL; un rename evalúa origen y destino y una
eliminación conserva el área del archivo borrado. Los contratos están en
`src/__tests__/scripts/ci-detect-areas.test.ts`. Detector, agregador y gitleaks
siguen presentes; una omisión válida no es evidencia de ejecución de suites.

### Deno: CLI de pruebas vs. runtime desplegado

`ci.yml` y `post-deploy-smoke.yml` fijan el CLI en **2.9.7**. Edge usa Sentry
**10.76.0**, no SDK 11 (éste requiere Deno ≥2.8.3). Ambos comandos mantienen
`--sanitize-ops` y `--sanitize-resources`: desde Deno 2.8 cambiaron sus
defaults y la actualización no debe relajar la detección de fugas.
Se conserva typecheck, sin `--no-check`, y `--node-modules-dir=none`.

Los pasos Deno fijan `DENO_NO_PACKAGE_JSON=1` para no auto-resolver el
`package.json` del frontend. Las Edge usan imports explícitos `npm:`/HTTP;
las plantillas de correo mantienen React 18 y no deben heredar React 19
de la aplicación. Reproducir las pruebas focales locales con la misma variable.
Esto no omite pruebas ni cambia las dependencias del frontend. Ver
[variable oficial de Deno](https://docs.deno.com/runtime/reference/env_variables/).

Esto instala el canal **estable**, no el canal LTS. Ver
[releases de Deno](https://docs.deno.com/runtime/fundamentals/stability_and_releases/),
[sanitizers](https://docs.deno.com/runtime/test/sanitizers/) y
[compatibilidad de Sentry 11](https://github.com/getsentry/sentry-javascript/blob/11.4.0/MIGRATION.md).

Supabase/Lovable administra el runtime de las Edge Functions desplegadas.
Actualizar el CLI de Actions **no cambia ni certifica su versión remota**.
Para comprobarla, revisar un log de arranque del entorno correspondiente que
identifique Edge Runtime y compatibilidad Deno; no inferirla del YAML ni de
la versión de la CLI Supabase. Si el log sólo dice `booted` y no expone
versión, solicitar confirmación al proveedor: ese log no la certifica.
Un smoke aprobado prueba contratos HTTP,
no la versión exacta del runtime remoto.

El runtime observado el 2026-10-03 fue Edge Runtime 1.77.0 / Deno 2.1.4;
los contratos Sentry también se ejecutaron localmente en ese Deno antiguo.
Esto no cambia el CLI del workflow ni agrega otro pipeline. Ver
[runbook y evidencia histórica](../sentry-runbook.md#11-validación-operativa-pendiente-de-dashboarddespliegue).

## Otros workflows

| Workflow | Activación | Alcance |
| --- | --- | --- |
| `gitleaks.yml` | PR, push main, manual | Secretos |
| `rls-tests.yml` | PR/push por rutas DB, manual | Postgres efímero y reglas DB |
| `dependency-review.yml` | PR por rutas configuradas | Dependencias |
| `codeql.yml` | Lunes 06:00 UTC y manual | JavaScript/TypeScript |
| `e2e.yml` | Sólo manual | Playwright/provisioning/staging |
| `post-deploy-smoke.yml` | Sólo manual | Smoke del destino seleccionado |
| `isolated-ui-audit.yml` | PR por rutas de UI/configuración, manual | 28 casos sintéticos sin backend |
| `pricing-rpc-bounded.yml` | PR por rutas del harness, manual | Baseline congelado y candidato CRM |
| `pricing-rpc-authenticated.yml` | PR por rutas del harness, manual | Roles autenticados y compatibilidad |
| `test-diagnostics.yml` | Sólo manual | Diagnósticos PDF/visuales |

Consultar filtros exactos en YAML. E2E contiene mutadores; smoke tampoco
debe suponerse read-only. Confirmar destino/efectos antes del dispatch.
Estos workflows no publican automáticamente frontend en Lovable.
E2E serializa todas las ramas en `e2e-shared-fixtures`, incluyendo provisioning,
sin cancelar el run activo por otro dispatch. GitHub puede sustituir un run
pendiente: no es una cola FIFO. Los jobs dentro del mismo run mantienen su
paralelismo. El smoke de duplicación exige HTTP 404, P0002 y el mensaje canónico
para el UUID inexistente; errores de autenticación/proxy no cuentan como éxito.

### Cobertura de mantenimiento de dependencias

Dependabot propone actualizaciones de Actions y Bun. No actualiza hoy los
imports `npm:`/HTTP de `supabase/functions/`; un pin del mismo paquete en
`package.json` tampoco cambia su import Edge. Dependency Review dispara
sólo por `package.json`, `bun.lock` o su propio workflow: no acredita que
se hayan revisado dependencias Edge ni todas sus transitivas.

GitHub admite Deno mediante manifiestos npm/JSR, pero todavía no hay
`imports` consumidos en los `deno.json` de este repo. Se mantiene una revisión
manual, sin nuevo pipeline. Inventario, procedimiento y condiciones del
piloto nativo en [mantenimiento del stack](../stack-mantenimiento.md#dependabot-y-dependencias-edge).

## RLS

Un único job **`RLS tests result`**, sin matriz.
PostgreSQL **17.9 pinneado por digest**, cliente 17:

1. Bootstrap → squash/inventario → replay ordenado.
2. Candado service-role-only y post-migrate.
3. Cobertura RLS e integridad.
4. Baseline antes de fixtures.
5. Guards bloqueantes del manifiesto.
6. Suites `test_rls_*.sql`, aisladas `BEGIN … ROLLBACK`.
7. Concurrencia de cotización ganadora, cobros y factura manual.

Los filtros incluyen `scripts/ci/concurrencia-cobro.sh` y todas las fixtures
de `scripts/ci/fixtures/`, tanto en PR como en push a main.

Logs/diff al fallar, retención tres días.
Ver [baseline](baseline-esquema.md) y
[RLS](../../supabase/tests/rls/README.md). No toca producción.

## Leer un resultado y medir

Verificar SHA de run/PR; un verde anterior no valida código posterior.
Distinguir success/failure/cancelled/skipped.
Docs-only puede pasar detector/agregador con lint/build/Vitest omitidos;
no significa que esas suites se ejecutaron.

Investigar el step rojo antes de corregir. No ocultarlo con
`continue-on-error`, relax de guards o baseline aceptada a ciegas.

Vitest 5: dos proyectos node/jsdom, forks, aislamiento y límite configurado
de **dos workers en CI**. Heap no equivale a memoria reservada/RSS.
Medir wall-clock, shard más lento, cache y lint antes de subir concurrencia.
[Mediciones históricas](../ci-vitest-shards.md) no son SLA del stack actual.

Suite completa en Actions; local/Lovable, comprobaciones focales.
Publicar producto sólo tras validación y autorización. Docs-only no
publica ni cambia versión.
