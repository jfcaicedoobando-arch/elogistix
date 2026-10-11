#!/usr/bin/env node
/** Real Vitest 5 multi-shard contract, tiny synthetic repo, no backend or network. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildCatalog, writeJson } from './test-catalog.mjs';
import { verifyEvidence } from './verify-test-evidence.mjs';
import { createShardPlan } from './vitest-shard-plan.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-vitest-shard-contract-'));
const originalCwd = process.cwd();
const counts = process.argv.slice(2);
const plans = counts.length ? counts.map(count => createShardPlan({ count })) : [createShardPlan()];
if (new Set(plans.map(plan => plan.count)).size !== plans.length) throw new Error('Duplicate smoke shard count');
// Same source fixture and cases for every supported partition (5, 8 and 10).
const fileCount = 40;
const require = createRequire(import.meta.url);
const cli = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const output = process.env.CI_SMOKE_OUTPUT_DIR ? path.resolve(process.env.CI_SMOKE_OUTPUT_DIR) : null;
const put = (name, value) => { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), value); };
const githubContext = new Map(['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_EVENT_NAME'].map(name => [name, process.env[name]]));
const env = { ...process.env, CI: 'true', CI_CACHE_HIT: 'false' };
for (const name of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_EVENT_NAME', 'CI_TEST_SHARD']) delete env[name];
try {
  put('.gitignore', 'node_modules\nreports\n');
  put('package.json', '{"type":"module"}\n');
  put('bun.lock', 'synthetic-lock\n');
  put('scripts/ci/test-catalog/sql-support.json', '{"supabase/tests/rls/_helpers.sql":"Synthetic helper"}\n');
  put('supabase/tests/_guards_manifest.txt', 'supabase/tests/guard.sql\n');
  for (const name of [
    'supabase/tests/guard.sql', 'supabase/tests/rls/_helpers.sql', 'supabase/tests/rls/test_rls_synthetic.sql',
    'supabase/functions/demo/demo_test.ts', 'supabase/functions/demo/smoke_test.ts',
    'tests/pdf/carteraPagination.test.tsx', 'src/demo.perf.ts',
    'e2e/specs/demo.spec.ts', 'e2e/visual/audit119-126/specs/demo.spec.ts', 'e2e/visual/specs/shared-ui.spec.ts',
  ]) put(name, '// Catalog-only synthetic source; never executed\n');
  for (let index = 1; index <= fileCount; index++) put(`src/case${index}.test.ts`, `import { it, expect } from 'vitest'; it('synthetic ${index}', () => expect(${index}).toBe(${index}));\n`);
  fs.symlinkSync(path.join(source, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const reporter = path.join(source, 'scripts/ci/vitest-evidence-reporter.ts');
  put('vitest.config.mjs', `import { defineConfig } from 'vitest/config'; export default defineConfig({test:{maxWorkers:2,reporters:[${JSON.stringify(reporter)}],projects:[{extends:false,test:{name:'node',environment:'node',include:['src/*.test.ts'],pool:'forks',isolate:true,maxWorkers:2}}]}});\n`);
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '-q']); git(['add', '.']); git(['-c', 'user.name=CI fixture', '-c', 'user.email=ci-fixture@example.invalid', 'commit', '-qm', 'Synthetic test fixture']);
  process.chdir(root);
  for (const name of githubContext.keys()) delete process.env[name];
  const summaries = [];
  for (const plan of plans) {
    const directory = `reports/evidence-${plan.count}`;
    for (const index of plan.matrix.shard) {
      const result = spawnSync(process.execPath, [cli, 'run', '--shard=' + index + '/' + plan.count], {
        cwd: root,
        env: { ...env, CI_EVIDENCE_DIR: directory, CI_TEST_MAX_PARALLEL: String(plan.maxParallel), CI_TEST_SHARD: index + '/' + plan.count },
        encoding: 'utf8',
      });
      if (output) {
        fs.mkdirSync(path.join(output, String(plan.count)), { recursive: true });
        fs.writeFileSync(path.join(output, String(plan.count), `shard-${index}.log`), result.stdout + result.stderr);
      }
      if (result.status !== 0) throw new Error(`Synthetic shard ${index}/${plan.count} failed (${result.status}): ${result.stdout}${result.stderr}`);
    }
    // Derive the current fixture catalog rather than trusting a generated count.
    const summary = verifyEvidence(directory, plan.count);
    if (summary.files !== fileCount || summary.cases.passed !== fileCount) throw new Error('Synthetic union is incomplete');
    const reports = plan.matrix.shard.map(index => JSON.parse(fs.readFileSync(`${directory}/vitest-shard-${index}-of-${plan.count}.json`, 'utf8')));
    if (reports.some(report => report.discovered.length !== fileCount || report.selected.length !== fileCount / plan.count || report.files.length !== fileCount / plan.count)) throw new Error('Pre/post-shard event contract changed');
    if (output) {
      fs.cpSync(directory, path.join(output, String(plan.count), 'evidence'), { recursive: true });
      writeJson(path.join(output, String(plan.count), 'summary.json'), { ...summary, counts: buildCatalog().counts });
    }
    summaries.push(summary);
  }
  if (summaries.some(summary => summary.sha !== summaries[0].sha || summary.treeDigest !== summaries[0].treeDigest || JSON.stringify(summary.cases) !== JSON.stringify(summaries[0].cases))) throw new Error('Smoke configurations did not execute the same source and cases');
  if (output) writeJson(path.join(output, 'summary.json'), summaries);
  console.log(JSON.stringify(summaries));
} finally {
  process.chdir(originalCwd);
  for (const [name, value] of githubContext) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  fs.rmSync(root, { recursive: true, force: true });
}
