// Synthetic orchestration only. Never starts Git, Docker, SQL or a network.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as evidence from '../../../../scripts/ci/nc-publica-replay/source-evidence.mjs';
const options = JSON.parse(process.argv[2]);
const root = options.root, review = 'a'.repeat(40), owned = 'b'.repeat(64), calls = [], logs = [], dynamicImports = [], imports = [];
const event = { action: 'synchronize', pull_request: {
  base: { ref: 'main', repo: { full_name: evidence.REPOSITORY } },
  head: { ref: options.wrongBranch ? 'unadmitted-branch' : 'fix/nc-replay-canonical-20261012',
    sha: review, repo: { full_name: evidence.REPOSITORY } },
} };
const eventPath = path.join(root, 'synthetic-event.json');
fs.writeFileSync(eventPath, JSON.stringify(event));
const scratch = path.join(root, 'scratch');
fs.mkdirSync(scratch);
const fakeProcess = {
  argv: ['synthetic-node', path.join(root, evidence.RUNNER_PATH), options.mode, ...(options.args ?? [])],
  execPath: '/synthetic/node',
  env: { PATH: '/synthetic/only', GITHUB_ACTIONS: options.local ? 'false' : 'true',
    GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: evidence.REPOSITORY,
    GITHUB_EVENT_PATH: eventPath, REVIEW_COMMIT: review, RUNNER_TEMP: scratch },
  on() {},
};
function execFileSync(command, args) {
  calls.push([command, args]);
  if (command === 'git' && JSON.stringify(args) === JSON.stringify(['rev-parse', 'HEAD'])) return review + '\n';
  if (command === '/synthetic/node' && args[0].endsWith('/scripts/db/nc-publica-replay/prepare.mjs')) {
    const prepared = args[args.indexOf('--out') + 1];
    assert(prepared.startsWith(scratch + '/'));
    fs.mkdirSync(prepared);
    fs.writeFileSync(path.join(prepared, 'source-hashes.json'), '{"synthetic":true}\n');
    return 'SYNTHETIC: preparer not executed\n';
  }
  if (command === 'docker' && args[0] === 'create') return owned + '\n';
  if (command === 'docker' && JSON.stringify(args) === JSON.stringify(['rm', '--force', '--volumes', owned])) {
    if (options.removalFailure) throw Error('Synthetic removal failure');
    return '';
  }
  throw Error('Unmocked subprocess refused: ' + command);
}
function spawn(command, args) {
  assert.equal(command, 'docker');
  assert.equal(JSON.stringify(args), JSON.stringify(['start', '--attach', owned]));
  calls.push([command, args]);
  const child = new EventEmitter();
  child.kill = () => { throw Error('No real child exists'); };
  queueMicrotask(() => child.emit('close', options.containerFailure ? 1 : 0));
  return child;
}
const builtins = {
  'node:fs': { default: fs }, 'node:path': { default: path }, 'node:os': { default: os },
  'node:crypto': { default: crypto }, 'node:assert/strict': { default: assert },
  'node:child_process': { execFileSync, spawn }, 'node:url': { fileURLToPath },
  './verify-minimal.mjs': { verifyMinimal() {
    calls.push(['synthetic-verify-minimal', []]);
    if (options.verifierFailure) throw Error('Synthetic evidence verification failure');
    return { synthetic: true };
  } },
};
const context = vm.createContext({ process: fakeProcess, Buffer,
  console: { log: (...args) => logs.push(args.join(' ')), error: (...args) => logs.push(args.join(' ')) },
  fetch: () => { throw Error('Network refused'); } });
const module = new vm.SourceTextModule(fs.readFileSync(path.join(root, evidence.RUNNER_PATH), 'utf8'), {
  context, initializeImportMeta(meta) { meta.url = pathToFileURL(path.join(root, evidence.RUNNER_PATH)).href; },
  async importModuleDynamically(specifier) {
    assert.equal(specifier, './source-evidence.mjs', 'Unmocked dynamic import refused');
    dynamicImports.push(specifier);
    const loaded = new vm.SyntheticModule(Object.keys(evidence), function () {
      for (const [name, value] of Object.entries(evidence)) this.setExport(name, value);
    }, { context });
    await loaded.link(() => { throw Error('Nested import refused'); });
    await loaded.evaluate();
    return loaded;
  },
});
let error;
try {
  await module.link(specifier => {
    imports.push(specifier);
    assert(Object.hasOwn(builtins, specifier), 'Unmocked import refused: ' + specifier);
    const values = builtins[specifier];
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
} catch (failure) { error = failure.message; }
const output = path.join(root, 'reports/nc-publica-replay', options.mode);
const read = name => fs.existsSync(path.join(output, name)) ? JSON.parse(fs.readFileSync(path.join(output, name), 'utf8')) : null;
console.log(JSON.stringify({ error, exitCode: fakeProcess.exitCode ?? 0, calls, logs, dynamicImports, imports,
  record: read('run.json'), staging: read('staging.json') }));
