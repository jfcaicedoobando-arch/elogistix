#!/usr/bin/env bash
# Extended regression recipe; requires an empty, disposable local PostgreSQL service.
set -euo pipefail
export POSTGRES_IMAGE='postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae'
export PGHOST='localhost'
export PGPORT='5432'
export PGUSER='postgres'
export PGPASSWORD='postgres'
export PGDATABASE='postgres'
export PSQL='psql -v ON_ERROR_STOP=1 -X -q'
export BASELINE='supabase/schema/baseline.sql'
export SELECTOR148_ISOLATED_CI='1'

# Catálogo completo de pruebas
(
set -euo pipefail
node scripts/ci/test-catalog.mjs --output reports/rls-evidence/inventory.json
)

# AUD147 comparator — native currency and view compatibility
(
set -euo pipefail
docker run --rm --network none --user postgres --entrypoint bash \
  -v "$PWD:/repo:ro" "$POSTGRES_IMAGE" \
  -c 'cd /repo && PG_BIN=/usr/lib/postgresql/17/bin bash scripts/db/audit147-comparador/run.sh'
)

# Pendiente por embarque — control rojo y linaje fiscal
(
set -euo pipefail
export ISOLATED_QA_DB='1'
bash scripts/ci/receivable155/run-ci.sh
)

# Dependencia mínima del runner serial selector148
(
set -euo pipefail
node -e "require('node:assert/strict')(Number(process.versions.node.split('.')[0]) >= 20)"
npm ci --prefix scripts/ci/selector148 --ignore-scripts --omit=optional --no-audit --no-fund
node scripts/ci/selector148/static-check.cjs
npm test --prefix scripts/ci/selector148
)

# Validate AUD54 catalog runtime harness syntax
(
set -euo pipefail
bash -n scripts/ci/rls-prepare-db.sh
bash -n scripts/ci/audit54-cxc-forward-runtime.sh
python3 -c "import ast, pathlib; ast.parse(pathlib.Path('scripts/ci/audit54-cxc-runtime-fixtures.py').read_text(encoding='utf-8'))"
)

# Demo pre-freeze and final harness contracts (no database)
(
set -euo pipefail
python3 scripts/ci/demo-guard/test_static.py -v
python3 scripts/ci/demo-guard/test-prefreeze-actions.py -v
python3 scripts/ci/demo-guard/test-compat-actions.py
python3 scripts/ci/demo-guard/test_persisted.py
)

# Preparar BD (bootstrap + squash + replay de migraciones)
(
set -euo pipefail
export CRM_IDENTITY_CI='1'
export CRM_PROSPECTO_KAM_DISPOSABLE='1'
export CRM_PROSPECTO_KAM_POSTGRES_SERVICE_ID="${POSTGRES_SERVICE_ID:?Set POSTGRES_SERVICE_ID to the disposable PostgreSQL container}"
export AUD54_CI='1'
export ISOLATED_QA_DB='1'
export FINANCIAL49_CI='1'
export PRICING_CONTAINER_CI='1'
export LEADS_SCOPE_CI='1'
export DEMO_PREFREEZE_CI='1'
export DEMO_GUARD_DISPOSABLE='1'
export DEMO_GUARD_POSTGRES_SERVICE_ID="${POSTGRES_SERVICE_ID:?Set POSTGRES_SERVICE_ID to the disposable PostgreSQL container}"
bash scripts/ci/rls-prepare-db.sh
)

# Candado service_role-only en migraciones (bidireccional)
(
set -euo pipefail
$PSQL -f supabase/tests/rls/_ci_check_service_role_only.sql
)

# Pricing RPC exact ACL before harness grants
(
set -euo pipefail
$PSQL -f supabase/tests/rls/_ci_check_pricing_container_acl.sql
)

# KAM own company to Prospecto - strict roles, ownership and retries
(
set -euo pipefail
$PSQL -f supabase/tests/rls/test_rls_crm_empresa_prospecto_kam.sql
)

# KAM own company to Prospecto - two concurrent authenticated calls
(
set -euo pipefail
export ISOLATED_QA_DB='1'
export CRM_PROSPECTO_KAM_DISPOSABLE='1'
export CRM_PROSPECTO_KAM_POSTGRES_SERVICE_ID="${POSTGRES_SERVICE_ID:?Set POSTGRES_SERVICE_ID to the disposable PostgreSQL container}"
python3 scripts/ci/crm-prospecto-kam/test_static.py -v
python3 scripts/ci/crm-prospecto-kam/run-actions.py
)

# CRM client identity - independent creates and exact-ID races
(
set -euo pipefail
export ISOLATED_QA_DB='1'
export CRM_PROSPECTO_KAM_DISPOSABLE='1'
export CRM_PROSPECTO_KAM_POSTGRES_SERVICE_ID="${POSTGRES_SERVICE_ID:?Set POSTGRES_SERVICE_ID to the disposable PostgreSQL container}"
python3 scripts/ci/crm-cliente/test_static.py -v
python3 scripts/ci/crm-cliente/run-final-actions.py
python3 scripts/ci/crm-cliente/verify-evidence.py both
)

# Contador CxP - two-session races in fresh strict clones
(
set -euo pipefail
export ISOLATED_QA_DB='1'
export CXP_APPROVAL_DISPOSABLE='1'
export CXP_POSTGRES_SERVICE_ID="${POSTGRES_SERVICE_ID:?Set POSTGRES_SERVICE_ID to the disposable PostgreSQL container}"
python3 scripts/ci/cxp-approval/test_static.py -v
python3 scripts/ci/cxp-approval/run-actions.py
)

# Demo disabled — real rollback and persisted rejection in strict clones
(
set -euo pipefail
export ISOLATED_QA_DB='1'
export DEMO_GUARD_DISPOSABLE='1'
export DEMO_GUARD_POSTGRES_SERVICE_ID="${POSTGRES_SERVICE_ID:?Set POSTGRES_SERVICE_ID to the disposable PostgreSQL container}"
python3 scripts/ci/demo-guard/test_static.py -v
python3 scripts/ci/demo-guard/run-actions.py
)

# H14 financial history and races in owned strict replay clones
(
set -euo pipefail
export ISOLATED_QA_DB='1'
export H14_INTEGRITY_DISPOSABLE='1'
export H14_POSTGRES_SERVICE_ID="${POSTGRES_SERVICE_ID:?Set POSTGRES_SERVICE_ID to the disposable PostgreSQL container}"
python3 -I scripts/ci/h14-integrity/test_static.py -v
python3 -I scripts/ci/h14-integrity/ci_run.py
)

# Post-migrate (drop auth.users FKs para CI)
(
set -euo pipefail
$PSQL -f supabase/tests/rls/_ci_post_migrate.sql
$PSQL -f supabase/tests/rls/_ci_preserve_cotizacion_especial_acl.sql
$PSQL -f supabase/tests/rls/_ci_preserve_coordinador_acl.sql
)

# Verify RLS coverage
(
set -euo pipefail
$PSQL -f supabase/tests/rls/_ci_verify_rls.sql
)

# Guardia de integridad de esquema (bloqueante)
(
set -euo pipefail
set -euo pipefail
$PSQL -A -t -f scripts/db/integrity-guard.sql > /tmp/integrity.txt
filas=$(grep -c . /tmp/integrity.txt || true)
if [ "$filas" != "0" ]; then
  {
    echo "## ❌ Guardia de integridad de esquema"
    echo ""
    echo '```'
    cat /tmp/integrity.txt
    echo '```'
  } >> "$GITHUB_STEP_SUMMARY"
  cat /tmp/integrity.txt
  exit 1
fi
echo "## ✅ Guardia de integridad de esquema" >> "$GITHUB_STEP_SUMMARY"
)

# Baseline de esquema (estado final esperado)
(
set -euo pipefail
set -uo pipefail
# pg_dump se ejecuta DENTRO del contenedor de la imagen pinneada: el
# pg_dump del runner formatea distinto y produciría diffs falsos.
container=$(docker ps --filter "ancestor=${POSTGRES_IMAGE}" --format '{{.Names}}' | head -1)
if [ -z "$container" ]; then
  echo "::error::No se encontró el contenedor Postgres (imagen pinneada)."
  exit 1
fi
bash scripts/db/schema-snapshot.sh /tmp/schema.actual.sql "$container" || exit 1
wc -l /tmp/schema.actual.sql
sha256sum /tmp/schema.actual.sql
if [ ! -f "$BASELINE" ]; then
  echo "::error::Falta $BASELINE — genera y confirma la baseline (bun run db:baseline:update)."
  exit 1
fi
if diff -u "$BASELINE" /tmp/schema.actual.sql > /tmp/schema.diff; then
  echo "✓ El estado final del esquema coincide con la baseline"
  echo "## ✅ Baseline de esquema sin cambios" >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi
echo "::error::El esquema resultante NO coincide con $BASELINE"
head -200 /tmp/schema.diff
{
  echo "## ❌ Drift de esquema contra la baseline"
  echo ""
  echo "Si el cambio es intencional, regenerá la baseline con \`bun run db:baseline:update\` y committeala."
  echo ""
  echo '```diff'
  head -300 /tmp/schema.diff
  echo '```'
} >> "$GITHUB_STEP_SUMMARY"
exit 1
)

# Global catalogs — fail-closed permission mutations
(
set -euo pipefail
export GLOBAL_CATALOG_OWNED_CLUSTER='1'
mkdir -p reports/rls-evidence
python3 scripts/db/global-catalog-permissions/test-negative.py > reports/rls-evidence/global-catalog-negative.json
)

# Guards conductuales + schema invariants (manifiesto bloqueante)
(
set -euo pipefail
export JOBS='1'
export LOG_DIR='/tmp/guards-logs'
bash scripts/ci/run-guards.sh
)

# Suites RLS (descubrimiento por patrón)
(
set -euo pipefail
export LOG_DIR='.rls-logs'
export ISOLATED_QA_DB='1'
export DEMO_COMPAT_DISPOSABLE='1'
export DEMO_COMPAT_POSTGRES_SERVICE_ID="${POSTGRES_SERVICE_ID:?Set POSTGRES_SERVICE_ID to the disposable PostgreSQL container}"
python3 scripts/ci/demo-guard/test-compat-actions.py
bash scripts/ci/run-rls-suites.sh
node scripts/ci/test-catalog.mjs --verify-rls .rls-logs/execution.tsv
)

# Selector148 — instalador, mutaciones y concurrencia serial
(
set -euo pipefail
export SELECTOR148_GUARD_LOG_DIR='/tmp/guards-logs'
node scripts/ci/selector148/run.cjs
)

# Concurrencia de dos sesiones — cotización ganadora única
(
set -euo pipefail
bash scripts/ci/concurrencia-cotizacion-ganadora.sh
)

# Concurrencia de dos sesiones — cobro bancario idempotente
(
set -euo pipefail
export ISOLATED_QA_DB='1'
bash scripts/ci/concurrencia-cobro.sh
)

# Concurrencia de dos sesiones — factura manual idempotente
(
set -euo pipefail
export ISOLATED_QA_DB='1'
bash scripts/ci/concurrencia-factura-manual.sh
)
