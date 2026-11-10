#!/usr/bin/env bash
set -euo pipefail
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(process.versions.node, pkg.engines.node);
assert.equal(execFileSync('bun', ['--version'], {encoding:'utf8'}).trim(), pkg.engines.bun);
assert.equal(pkg.packageManager, 'bun@' + pkg.engines.bun);
NODE
before=$(sha256sum bun.lock)
bun install --frozen-lockfile --ignore-scripts
test "$before" = "$(sha256sum bun.lock)"
