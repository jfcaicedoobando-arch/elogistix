#!/usr/bin/env node
/** Isolated Node-only census; no dependencies, network, database, roles or credentials. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = 'scripts/ci/demo-authority-entry-review';
const tests = ['test_entry.mjs', 'test_provider.mjs', 'test_sources.mjs'];
const actual = fs.readdirSync(path.join(root, directory)).filter(p => /^test_.*\.mjs$/.test(p)).sort();
if (JSON.stringify(actual) !== JSON.stringify(tests)) throw Error('HOLD_OFFLINE_TEST_CENSUS');
if (process.argv.length !== 4 || process.argv[2] !== '--output') throw Error('Usage: run_review.mjs --output DIRECTORY');
const output = path.resolve(process.argv[3]);
fs.mkdirSync(output, {recursive: true});
const selected = tests.map(p => `${directory}/${p}`);
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...selected], {cwd: root, encoding: 'utf8'});
fs.writeFileSync(path.join(output, 'node-tests.tap'), result.stdout ?? '');
fs.writeFileSync(path.join(output, 'node-tests.stderr.txt'), result.stderr ?? '');
const summary = {
  schemaVersion: 1, admission: 'NOT_ADMITTED', scope: 'OFFLINE_PROTOCOL_DOUBLES_ONLY',
  status: result.status === 0 ? 'passed' : 'failed', exitCode: result.status, nodeVersion: process.version,
  sourceSha: process.env.GITHUB_SHA ?? null,
  postgres: 'NOT_RUN', runtimeACL: 'NOT_RUN', restoreDurability: 'NOT_RUN',
  realWire: 'NOT_RUN', endpoint: 'UNCONFIGURED', sql17And18Dependency: 'SEPARATE_DRAFT_REQUIRES_INTEGRATION_REVIEW',
  tests: selected.map(p => ({path: p, sha256: createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')})),
};
fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(summary, null, 2) + '\n');
process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
process.exitCode = result.status === 0 ? 0 : 1;
