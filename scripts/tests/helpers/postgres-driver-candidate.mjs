import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);

export function validatePostgresDriverCandidate(declaredVersion, installedVersion) {
  // These behavioral expectations cover v4, not an unreviewed major or range.
  assert.match(declaredVersion ?? '', /^4\.\d+\.\d+$/, 'Pin an exact Postgres.js v4 candidate');
  assert.equal(installedVersion, declaredVersion, 'Installed Postgres.js must match the candidate pin');
  return declaredVersion;
}

export function currentPostgresDriverCandidate() {
  const manifest = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
  const installed = JSON.parse(readFileSync(resolve(dirname(require.resolve('postgres')), '../package.json'), 'utf8'));
  return validatePostgresDriverCandidate(manifest.devDependencies.postgres, installed.version);
}
