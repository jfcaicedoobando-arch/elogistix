# CI de Libre Carga

Fuente de verdad: `.github/workflows/` y `.github/actions/`.
Revisado el **2026-10-03**. Esta guía no configura protección de rama.

## CI principal

`ci.yml`: PR, push a `main` y dispatch manual. Sin `paths-ignore`.
`Detectar áreas` usa `scripts/ci/detect-areas.sh` para frontend/edge/database.
El agregador comprueba omisiones válidas, no las presenta como tests pasados.

| Job | Trabajo |
| --- | --- |
| `Detectar áreas` | Clasificación del diff |
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

### Deno: CLI de pruebas vs. runtime desplegado

`ci.yml` y `post-deploy-smoke.yml` fijan el CLI en **2.9.7**, por encima del
mínimo **2.8.3** de Sentry 11. Ambos comandos `deno test` mantienen
`--sanitize-ops` y `--sanitize-resources`: desde Deno 2.8 cambiaron sus
defaults y la actualización no debe relajar la detección de fugas.
Se conserva typecheck, sin `--no-check`, y `--node-modules-dir=none`.

Esto instala el canal **estable**, no el canal LTS. Ver
[releases de Deno](https://docs.deno.com/runtime/fundamentals/stability_and_releases/),
[sanitizers](https://docs.deno.com/runtime/test/sanitizers/) y
[compatibilidad de Sentry 11](https://github.com/getsentry/sentry-javascript/blob/11.4.0/MIGRATION.md).

Supabase/Lovable administra el runtime de las Edge Functions desplegadas.
Actualizar el CLI de Actions **no cambia ni certifica su versión remota**.
Para comprobarla, revisar un log de arranque del entorno correspondiente que
identifique Edge Runtime y compatibilidad Deno; no inferirla del YAML ni de
la versión de la CLI Supabase. Un smoke aprobado prueba contratos HTTP,
no la versión exacta del runtime remoto.

## Otros workflows

| Workflow | Activación | Alcance |
| --- | --- | --- |
| `gitleaks.yml` | PR, push main, manual | Secretos |
| `rls-tests.yml` | PR/push por rutas DB, manual | Postgres efímero y reglas DB |
| `actionlint.yml` | Rutas workflows/actions, manual | Actions |
| `dependency-review.yml` | PR por rutas configuradas | Dependencias |
| `codeql.yml` | Lunes 06:00 UTC y manual | JavaScript/TypeScript |
| `e2e.yml` | Sólo manual | Playwright/provisioning/staging |
| `post-deploy-smoke.yml` | Sólo manual | Smoke del destino seleccionado |

Consultar filtros exactos en YAML. E2E contiene mutadores; smoke tampoco
debe suponerse read-only. Confirmar destino/efectos antes del dispatch.
Estos workflows no publican automáticamente frontend en Lovable.

## RLS

Un único job **`RLS tests result`**, sin matriz.
PostgreSQL **17.9 pinneado por digest**, cliente 17:

1. Bootstrap → squash/inventario → replay ordenado.
2. Candado service-role-only y post-migrate.
3. Cobertura RLS e integridad.
4. Baseline antes de fixtures.
5. Guards bloqueantes del manifiesto.
6. Suites `test_rls_*.sql`, aisladas `BEGIN … ROLLBACK`.
7. Concurrencia de cotización ganadora.

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
