#!/usr/bin/env bash
set -euo pipefail

# Catálogo completo de pruebas (sin ejecutar carriles manuales)
(
set -euo pipefail
node scripts/ci/test-catalog.mjs --output reports/test-inventory.json
)

# Demo review offline lane (no SQL, backend or credentials)
(
set -euo pipefail
node scripts/ci/demo-review-offline.mjs reports/test-inventory.json
)

# Demo durable owner offline lane (no SQL, backend or credentials)
(
set -euo pipefail
node scripts/ci/test-catalog.mjs --run node-demo-durable-owner reports/test-inventory.json
)

# Demo persistence integrity contracts (offline, no SQL or Docker)
(
set -euo pipefail
python3 -B -m unittest discover -s scripts/ci/demo-persistence-review -p 'test_*.py' -v
)

# Demo physical wire state machine offline lane (no database or external network)
(
set -euo pipefail
node scripts/ci/test-catalog.mjs --run node-demo-wire-lab reports/test-inventory.json
)

# Node native runtime staging and archive contracts (no Docker or database)
(
set -euo pipefail
python3 -B -m unittest discover -s scripts/ci/demo-wire-lab -p 'test_*.py' -v
python3 -B scripts/ci/demo-wire-lab/stage.py --verify-native-runtime --output "$RUNNER_TEMP/node26-native-runtime" --node "$(command -v node)"
)

# Demo authority composition contracts offline (no database or external authentication)
(
set -euo pipefail
node scripts/ci/test-catalog.mjs --run node-demo-authority-contract reports/test-inventory.json
)

# Demo authority bridge offline (declared snapshots only, no authorization)
(
set -euo pipefail
node scripts/ci/test-catalog.mjs --run node-demo-authority-bridge reports/test-inventory.json
)

# Post-deploy smoke contract (offline, no credentials)
(
set -euo pipefail
node --test scripts/ci/post-deploy-smoke.test.mjs
)

# Package script contracts (offline, stubbed commands)
(
set -euo pipefail
node --test scripts/ci/package-scripts.test.mjs
)
