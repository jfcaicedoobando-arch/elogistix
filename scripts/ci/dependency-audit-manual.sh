#!/usr/bin/env bash
set -euo pipefail

# Install lockfile Playwright Chromium and system dependencies
(
set -euo pipefail
set -euo pipefail
mkdir -p reports/dependency-audit
node node_modules/@playwright/test/cli.js install --with-deps chromium 2>&1 | tee reports/dependency-audit/browser-install.log
)

# Typecheck isolated dependency fixture and tests
(
set -euo pipefail
set -euo pipefail
node node_modules/typescript/bin/tsc -p e2e/visual/dependency-audit/tsconfig.json 2>&1 | tee reports/dependency-audit/typecheck.log
)

# Lint isolated dependency fixture and tests
(
set -euo pipefail
set -euo pipefail
node node_modules/eslint/bin/eslint.js --no-cache e2e/visual/dependency-audit 2>&1 | tee reports/dependency-audit/lint.log
)

# Check all 4 dependency browser cases with a fresh isolated build
(
set -euo pipefail
set -euo pipefail
node node_modules/@playwright/test/cli.js test --config e2e/visual/dependency-audit/playwright.config.ts 2>&1 | tee reports/dependency-audit/browser.log
)

node scripts/ci/dependency-audit-report.mjs
