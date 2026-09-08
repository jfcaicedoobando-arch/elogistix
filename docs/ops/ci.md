# CI y RLS en GitHub Actions

CI simplificado (YAGNI + Power of 10): menos orquestación, una sola instalación
por workflow y ningún reporting que no bloquee. Las pruebas funcionales y de
seguridad bloqueantes se conservan íntegras.

## Workflows

| Workflow             | Disparo                                              | Check requerido            |
| -------------------- | ---------------------------------------------------- | -------------------------- |
| `ci.yml`             | PR, push a `main`, manual                            | `CI Success (aggregator)`  |
| `rls-tests.yml`      | PR/push que toca BD, manual                          | `RLS tests result`         |
| `dependency-review`  | PR que toca `package.json` / `bun.lock` / su workflow | —                          |
| `gitleaks`           | según su workflow                                     | —                          |
| `actionlint`         | según su workflow                                     | —                          |
| `codeql`             | semanal + manual                                      | —                          |
| `e2e`                | **sólo manual**                                       | —                          |
| `post-deploy-smoke`  | **sólo manual**                                       | —                          |

## CI (`ci.yml`)

Un job, un checkout, una instalación. Secuencia: ESLint (`--max-warnings 0`) →
`typecheck` → **suite Vitest completa** (sin coverage, sin shards, sin retries) →
`build` sin `ANALYZE`. Sin `--shard`, Vitest incluye los guardrails de
arquitectura (`architecture.test.ts`, `architecture-baseline.test.ts`,
`audit-report`, `audit-casts-classifier`) exactamente una vez, así que Power of
10 (≤200 líneas productivas, capas, casts) sigue bloqueando.

Filtro por áreas dentro del mismo job:

- PR: `base.sha` vs `HEAD`.
- push a `main`: `github.event.before` vs `github.sha` (todos los commits).
- dispatch manual o diff no disponible: se ejecuta **todo**.

Los tests Deno de Edge Functions (con typecheck, sin `--no-check`) corren sólo
si el diff toca `supabase/functions/**` o el propio `ci.yml`.

El workflow siempre arranca (sin `paths-ignore`), así el check requerido nunca
queda *pending*; los pasos irrelevantes se omiten explícitamente.

## RLS (`rls-tests.yml`)

Un job, una instancia Postgres 17 efímera, sin matrix ni transporte de
snapshots. Orden:

1. Bootstrap de stubs + baseline squash + replay ordenado de todas las
   migraciones posteriores (`scripts/ci/rls-prepare-db.sh`).
2. Candado `service_role`-only (antes de post-migrate).
3. Post-migrate, verify RLS, guardia de integridad.
4. **Baseline de esquema** sobre el estado preparado, antes de cualquier fixture.
5. Guards bloqueantes del manifiesto (`scripts/ci/run-guards.sh`).
6. Todas las suites `supabase/tests/rls/test_rls_*.sql` descubiertas por patrón
   (`scripts/ci/run-rls-suites.sh`): verifica el aislamiento `BEGIN…ROLLBACK`,
   nunca omite una suite en silencio y falla si descubre menos de 30.
7. Prueba real de concurrencia de cotización ganadora.

Los logs y el diff se suben **sólo al fallar**, con retención corta.

## Correr CI y RLS a mano

En GitHub: pestaña **Actions** → workflow → **Run workflow** (`workflow_dispatch`).
Con `gh`:

```sh
gh workflow run ci.yml --ref main
gh workflow run rls-tests.yml --ref main
gh workflow run e2e.yml --ref main
gh workflow run post-deploy-smoke.yml --ref main
```

Comandos locales equivalentes (opcionales, fuera del camino de CI):

```sh
bun run lint -- --max-warnings 0
bun run typecheck
bun run test
bun run build
```

## Publicación

**Publicar en Lovable sigue siendo una acción manual del usuario.** Ningún
workflow despliega la app; `post-deploy-smoke` sólo verifica un backend ya
desplegado y se ejecuta a mano.
