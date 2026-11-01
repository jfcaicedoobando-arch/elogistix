import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {READ_AUTHORITY_SQL} from '../../../docs/review/demo-authority-provider-entry-20261016/authority-provider.mjs';
import {READ_ISSUANCE_SQL} from '../../../docs/review/demo-authority-provider-entry-20261016/issuer-entry.mjs';
import {EMPTY_CONFIG} from '../../../docs/review/demo-durable-owner-adapter-20261015/driver.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = path => fs.readFileSync(root + path, 'utf8');
const directory = 'docs/review/demo-durable-owner-adapter-20261015/';
const extensionDirectory = 'docs/review/demo-authority-provider-entry-20261016/';
const pins = JSON.parse(read('scripts/ci/demo-authority-entry-review/source-pins.json'));
const expectedSources = [...['driver.mjs', 'issuer.mjs', 'owner.mjs', 'store.mjs', 'store.sql'].map(p => directory + p),
  'scripts/ci/demo-authority-bridge-review/contract.mjs',
  'scripts/ci/demo-authority-bridge-review/synthetic-fixtures.mjs'];

// Original helper bytes from main 22db8becd. Relocation permits only the three
// issuer imports below; neither helper belongs to the historical twelve-file archive.
const helperPins = {
  provider: {bytes: 2346, sha256: 'a13923e6d668794e7ef2b3f898e827c9976cdb4638bee8b7eb1470446b77d897'},
  entry: {bytes: 6284, sha256: '2a3e36f55240c984471a6f35a12cc8cc4d976e03228b36086afeae70aa147973'},
};

function verifyRelocatedHelpers(provider, entry) {
  for (const dependency of ['driver', 'issuer', 'store']) {
    const relocated = `from '../demo-durable-owner-adapter-20261015/${dependency}.mjs';`;
    const original = `from './${dependency}.mjs';`;
    assert.equal(entry.split(relocated).length, 2, `Exactly one relocated ${dependency} import`);
    assert.equal(entry.includes(original), false, `No obsolete sibling ${dependency} import`);
    entry = entry.replace(relocated, original);
  }
  for (const [name, text] of Object.entries({provider, entry})) {
    assert.equal(Buffer.byteLength(text), helperPins[name].bytes, name);
    assert.equal(createHash('sha256').update(text).digest('hex'), helperPins[name].sha256, name);
  }
}

function verifyPins(value) {
  assert.equal(value.baseCommit, 'ecc53750c5d920d898ca2b00a2f717371dc19cf5');
  assert.equal(value.admission, 'NOT_ADMITTED'); assert.equal(value.scope, 'OFFLINE_PROTOCOL_DOUBLES_ONLY');
  assert.deepEqual(value.sources.map(s => s.path).sort(), [...expectedSources].sort());
  for (const source of value.sources) {
    const bytes = fs.readFileSync(root + source.path);
    assert.equal(bytes.length, source.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256, source.path);
    assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex'), source.gitBlobSha1);
  }
}

test('authentic issuer, driver, store, owner and PR358 mapper remain exact pinned dependencies', () => {
  verifyPins(pins);
  for (const mutate of [p => p.sources.pop(), p => p.sources.push(p.sources[0]),
    p => { p.sources[0].sha256 = '0'.repeat(64); }, p => { p.admission = 'ADMITTED'; }]) {
    const changed = structuredClone(pins); mutate(changed); assert.throws(() => verifyPins(changed));
  }
});

test('relocated helpers preserve original bytes except the three historical dependency imports', () => {
  const provider = read(extensionDirectory + 'authority-provider.mjs');
  const entry = read(extensionDirectory + 'issuer-entry.mjs');
  verifyRelocatedHelpers(provider, entry);
  assert.equal(fs.existsSync(root + directory + 'authority-provider.mjs'), false);
  assert.equal(fs.existsSync(root + directory + 'issuer-entry.mjs'), false);
  for (const [changedProvider, changedEntry] of [
    [provider + '// altered helper', entry],
    [provider, entry + '// altered integration'],
    [provider, entry.replace("from '../demo-durable-owner-adapter-20261015/driver.mjs';", "from './driver.mjs';")],
    [provider, entry + "\nimport {SQL} from '../demo-durable-owner-adapter-20261015/store.mjs';"],
  ]) assert.throws(() => verifyRelocatedHelpers(changedProvider, changedEntry));
});

test('new integration has fixed queries, no hash fork, business call, network, or caller evidence resolver', () => {
  const provider = read(extensionDirectory + 'authority-provider.mjs'), entry = read(extensionDirectory + 'issuer-entry.mjs');
  assert.equal(READ_AUTHORITY_SQL, 'SELECT demo_flow_writer.read_authority($1::uuid) AS authority');
  assert.match(READ_ISSUANCE_SQL, /FOR SHARE$/);
  assert.doesNotMatch(provider + entry, /createHash|node:crypto|crypto\.subtle|fetch\(|https?:\/\/|process\.env|Deno\.env/);
  assert.doesNotMatch(provider + entry, /SQL\.(?:business|dispatch|ingress)|createOwner\(|consume\(/);
  assert.match(entry, /createIssuer\(resolver, config\.deployment\)\.derive\(contextId\)/);
  assert.match(entry, /driver\.query\(ISSUE_SQL, envelope\.parameters, 'T', 'T', 'INSERT'\)/);
  assert.match(provider, /mapDeclaredVerifiedSnapshots\(descriptor\.value\)/);
  assert.deepEqual(JSON.parse(read(directory + 'config.example.json')), EMPTY_CONFIG);
  assert.ok(Object.values(EMPTY_CONFIG).every(value => value === ''));
});

test('isolated draft workflow runs the exact offline census with no secrets or backend commands', () => {
  const workflow = read('.github/workflows/demo-authority-entry-review.yml');
  assert.match(workflow, /github\.event\.pull_request\.draft == true/);
  assert.match(workflow, /github\.event\.pull_request\.head\.ref == 'review\/demo-authority-provider-entry-20261016'/);
  assert.match(workflow, /contents: read/); assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /node-version: '26\.13\.0'/);
  assert.ok(workflow.includes("      - 'docs/review/demo-authority-provider-entry-20261016/**'"));
  assert.match(workflow, /node scripts\/ci\/demo-authority-entry-review\/run_review\.mjs --output/);
  assert.doesNotMatch(workflow, /secrets\.|continue-on-error|npm install|npm ci|psql|createdb|docker|supabase|workflow_dispatch|pull_request_target/);
  const actual = fs.readdirSync(root + 'scripts/ci/demo-authority-entry-review').filter(p => /^test_.*\.mjs$/.test(p)).sort();
  assert.deepEqual(actual, ['test_entry.mjs', 'test_provider.mjs', 'test_sources.mjs']);
});
