# Auditoría de GitHub Actions — Libre Carga

Revisé los 8 workflows en `.github/workflows/`, la composite action `setup-bun`, `.gitleaks.toml`, `vitest.config.ts` y los scripts de `package.json`. En general **el CI está por encima del promedio**: actions pinneadas por SHA, permisos mínimos (`contents: read`), concurrency por rama, timeouts en todos los jobs, imagen Postgres pinneada por digest, un aggregator `ci-success` para branch protection estable, y validación de que la matriz RLS cubre todos los archivos en disco.

Aun así, hay **bypasses y quickwins** que conviene documentar o cerrar. Ninguno es bloqueante hoy, pero varios pueden dejar pasar regresiones sin que CI se ponga rojo.

## Hallazgos ordenados por severidad

### ALTO — bypasses reales

1. **Umbrales de coverage muy bajos vs. producto maduro** (`vitest.config.ts:141-144`).
   `lines/statements: 38`, `functions: 30`, `branches: 34`. El comentario admite que se recalibró hacia abajo tras subir a `@vitest/coverage-v8 v4` (Functions 56→32%, Branches 73→37%). Es honesto, pero mientras vivan estos pisos, cualquier módulo nuevo con 0 tests pasa CI. **Riesgo**: se acumula deuda sin señal. **Fix**: seguir el ladder ya escrito en el comentario (Q3 2026: func 45 / branch 50) y agregar `coverage.thresholds.perFile` para módulos core (`src/features/facturacion`, `src/features/embarques`, `src/features/compras`).

2. **`test:coverage:shard` fuerza thresholds a 0** (`package.json`).
   `--coverage.thresholds.lines=0 --statements=0 --functions=0 --branches=0`. Está bien porque el gate real corre en `test:coverage:merge` con el reporter blob, pero es fácil confundirse y creer que los shards ya validan. **Fix**: agregar comentario en package.json y en `ci.yml` señalando que el gate vive en el job `coverage`.

3. **`lint:unused:strict` con `if: always()`** (`ci.yml:46-47`).
   Se ejecuta aunque `lint:unused` haya fallado antes. Como el step siguiente sí sigue el `set -e` normal, si el strict falla marca el job en rojo, así que no es bypass; **pero** si `lint:unused` (no strict) falla, el mensaje de error del strict oculta el problema real. **Fix**: quitar `if: always()` o dejarlo pero mover el strict antes.

4. **`Casts audit` y `Architecture audit` sin `--fail-on`** (`ci.yml:52-56`).
   Verifiqué que `scripts/audit-*.ts` sí salen con exit code ≠ 0 cuando encuentran violaciones, pero conviene confirmar cobertura: el paso `Architecture & cast report` corre con `if: always()` y el step de PR summary también. Si el auditor cambia a modo "solo reporte", CI pasa mudo. **Fix**: test de meta que verifica que `audit-report.ts` respeta un env `AUDIT_STRICT=1` en CI.

### MEDIO — hacks documentados pero frágiles

5. **`--no-check` en tests Deno** (`ci.yml:131-144`).
   Comentario explica que TS2578 spamea en el ecosistema Deno+esm.sh y que el typecheck real se hace localmente. **Problema**: "localmente" no es CI; nadie garantiza que alguien lo corra. **Fix**: agregar un job semanal `deno test --check` (permitido fallar) que abra issue si aparecen errores nuevos, o un workflow manual `deno-typecheck.yml`.

6. **RLS CI: `--ignore-scripts` en `bun install`** (`.github/actions/setup-bun/action.yml`).
   Protección de supply chain legítima, pero está documentada como "no rompe porque las deps con binarios nativos resuelven en runtime". Si alguien agrega una dep con postinstall imprescindible, CI seguirá verde pero prod puede romper. **Fix**: agregar un smoke job que corra `bun install` **sin** `--ignore-scripts` semanalmente y compare el resultado.

7. **RLS CI: `_ci_drift.sql` y `_ci_post_migrate.sql` divergen del esquema real** (`supabase/tests/rls/_ci_post_migrate.sql`, workflow rls-tests).
   Se droppean FKs a `auth.users`, se hacen stubs de pg_cron/pg_net/pgmq vía `sed`, se crean policies "reales" en CI porque las de prod se hicieron manualmente y no existen en migraciones. **Riesgo**: el ambiente de test no refleja prod y una policy puede pasar el test aquí y fallar allá. **Fix**: convertir los policies manuales de prod en migraciones (el comentario en `_ci_post_migrate.sql:66-70` lo admite: "no existen en migraciones; añadidas manualmente en prod").

8. **`sed` re-escribe migraciones on-the-fly** (`rls-tests.yml`, step "Apply migrations").
   Reemplaza `CREATE EXTENSION pg_cron/pg_net/pgmq/supabase_vault` con `SELECT 1`. Funciona, pero **si una migración define una función que depende de `pgmq.send()`, aquí compila y en prod truena** (o viceversa). **Fix**: usar imagen `supabase/postgres` en lugar de `postgres:15` vanilla, o mantener stubs SQL formales en `_ci_bootstrap.sql`.

### BAJO — mejoras de higiene

9. **`gitleaks` allowlist incluye el ANON_KEY completo** (`.gitleaks.toml`).
   Correcto (es una anon key pública), pero el patrón hardcodeado significa que si Supabase rota la key habrá falsos positivos hasta actualizar el toml. **Fix**: allowlist por prefijo del `iss+ref` en lugar del JWT completo, o mover la key a un env var.

10. **`post-deploy-smoke` toca prod con credenciales dinámicas** (`post-deploy-smoke.yml`).
    El job llama a `demo-access` en prod para obtener credenciales, corre smoke y expone `EMAIL/PASSWORD` en `$GITHUB_ENV`. `add-mask` cubre el password pero no el email. Bajo riesgo (es demo), aún así conviene documentarlo. **Fix**: enmascarar también el email.

11. **`e2e.yml` sólo corre manual o semanalmente**.
    No bloquea PRs (documentado en CONTRIBUTING). Está OK como diseño, pero **no hay un check nightly que abra issue en falla** — el workflow simplemente termina en rojo en la lista. **Fix**: agregar `on-failure` con `actions/github-script` para abrir issue (como sí hace `post-deploy-smoke`).

12. **`dependency-review` en `fail-on-severity: high`** (`dependency-review.yml`).
    Deja pasar `moderate`. Estándar razonable, pero para un proyecto multi-tenant con fiscal + payments, `moderate` puede escalar. **Fix**: bajar a `moderate` con allowlist de excepciones documentadas.

13. **`codeql.yml` sin `config-file`**.
    Corre `security-and-quality` default. Bien, pero no hay path-filters para excluir `src/test/`, `e2e/`, `supabase/tests/`, que pueden generar findings ruidosos. **Fix**: agregar `paths-ignore` en `init`.

14. **Cache de `~/.bun/install/cache`** (`setup-bun/action.yml`).
    Cachea el downloader, no `node_modules`. Correcto para seguridad, pero cada job re-instala. Con 20 shards + 6 jobs adicionales son ~26 `bun install` completos por push. **Fix**: mantener así (seguridad > velocidad) o evaluar cache de `node_modules` con hash estricto del lockfile.

## Lo que sí está muy bien

- Todas las actions pinneadas por SHA, no por tag.
- `permissions: contents: read` por default; sólo CodeQL y dependency-review escalan.
- `concurrency` + `cancel-in-progress` en todos los workflows.
- Timeouts en todos los jobs (evita runners colgados).
- Aggregator `ci-success` para branch protection (permite cambiar la matriz sin tocar settings).
- `if-no-files-found: error` en los uploads críticos (blob de vitest, RLS dump).
- `actionlint` corriendo sobre los propios workflows.
- Validación explícita de que `matrix.suite` en rls-tests cubre los archivos en disco (previene el clásico "agregué test pero olvidé la matrix").
- Guardas de secrets ausentes en e2e y en post-deploy-smoke (skipped en vez de rojo falso).

## Plan de acción propuesto (si me lo apruebas, lo ejecuto en modo build)

**Fase 1 (rápido, sin riesgo, ~1 turno):**
- Documentar en README del workflow el diseño de coverage (shards a 0, merge con umbral real).
- Enmascarar email en `post-deploy-smoke`.
- Ajustar `if: always()` de `lint:unused:strict`.
- Añadir `paths-ignore` a CodeQL para `**/__tests__/**`, `e2e/**`, `supabase/tests/**`.

**Fase 2 (medio, requiere validación, ~2-3 turnos):**
- Subir umbrales de coverage a la meta Q3 2026 (func 45 / branch 50) escribiendo tests para el gap.
- Convertir policies manuales de `tracking_externo` (y cualquier otra en `_ci_post_migrate.sql`) a migraciones reales.
- Bajar `fail-on-severity` de dependency-review a `moderate` con allowlist inicial.

**Fase 3 (grande, opcional):**
- Migrar imagen Postgres CI a `supabase/postgres` y eliminar los `sed` de extensiones.
- Job semanal `deno test --check` con issue automático en falla.
- Job semanal `bun install` sin `--ignore-scripts` como canario.

¿Ejecuto la Fase 1 completa, o prefieres priorizar otras?
