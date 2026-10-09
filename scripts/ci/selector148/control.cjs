// Only the ephemeral GitHub Actions PostgreSQL service is an allowed target.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const statePath = path.join(root, '.selector148-logs/owned-databases.json');
const contract = require('./contract.json');
const {verifyInstaller}=require('./installer.cjs');
const identifier = s => '"' + s.replaceAll('"', '""') + '"';
const literal = s => "'" + s.replaceAll("'", "''") + "'";
function guard() {
  const e = process.env;
  assert.equal(e.GITHUB_ACTIONS, 'true', 'GitHub Actions service only');
  assert.equal(e.CI, 'true');
  assert.equal(e.SELECTOR148_ISOLATED_CI, '1');
  assert(['localhost', '127.0.0.1'].includes(e.PGHOST));
  assert.equal(e.PGPORT, '5432');
  assert.equal(e.PGUSER, 'postgres');
  assert.equal(e.PGDATABASE, 'postgres');
  for (const key of ['DATABASE_URL', 'SUPABASE_DB_URL', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']) assert(!e[key], key + ' must be unset');
  assert(!e.PGSSLMODE || e.PGSSLMODE === 'disable');
  assert(/^\d+$/.test(e.GITHUB_RUN_ID));
  assert(/^\d+$/.test(e.GITHUB_RUN_ATTEMPT));
  return 'selector148-ci:' + e.GITHUB_RUN_ID + ':' + e.GITHUB_RUN_ATTEMPT;
}
function locate() {
  const dir = path.join(root, 'supabase/migrations');
  const matches = fs.readdirSync(dir).filter(n => n.endsWith('.sql')).filter(n =>
    crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, n))).digest('hex') === contract.registered_installer_sha256);
  assert.equal(matches.length, 1, 'Register exactly one pinned comment-only disabled selector envelope before enabling this CI wiring');
  verifyInstaller(fs.readFileSync(path.join(dir,matches[0]),'utf8'));
  return 'supabase/migrations/' + matches[0];
}
function psql(database, sql) {
  return cp.execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', database, '-c', sql],
    {cwd: root, encoding: 'utf8', env: {...process.env, PGSSLMODE: 'disable'}}).trim();
}
function readState() {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.marker, guard());
  assert(state.databases.every(n => /^ci_selector148_\d+_\d+_[a-z0-9_]+$/.test(n) && n.length <= 63));
  return state;
}
function writeState(state) { fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n'); }
function capture() {
  const marker = guard();
  assert(!fs.existsSync(statePath), 'Refusing to reuse ownership state');
  const parent = `ci_selector148_${process.env.GITHUB_RUN_ID}_${process.env.GITHUB_RUN_ATTEMPT}_parent`;
  assert(parent.length <= 63);
  fs.mkdirSync(path.dirname(statePath), {recursive:true});
  assert.equal(psql('template1', `SELECT count(*) FROM pg_database WHERE datname=${literal(parent)}`), '0');
  psql('template1', `CREATE DATABASE ${identifier(parent)} TEMPLATE ${identifier(process.env.PGDATABASE)}`);
  psql('template1', `COMMENT ON DATABASE ${identifier(parent)} IS ${literal(marker)}`);
  writeState({marker, parent, installer: locate(), databases:[parent]});
  console.log('Captured owned pre-selector template ' + parent);
}
function cleanup() {
  guard();
  if (!fs.existsSync(statePath)) return;
  const state = readState();
  for (const database of [...state.databases].reverse()) {
    const actual = psql('template1', `SELECT coalesce(shobj_description(oid,'pg_database'),'') || '|' || pg_get_userbyid(datdba) FROM pg_database WHERE datname=${literal(database)}`);
    if (!actual) continue;
    assert.equal(actual, state.marker + '|postgres', 'Refusing to drop an unowned database');
    psql('template1', `DROP DATABASE ${identifier(database)} WITH (FORCE)`);
  }
  assert.equal(psql('template1', `SELECT count(*) FROM pg_database WHERE datname IN (${state.databases.map(literal).join(',')})`), '0');
  fs.writeFileSync(path.join(path.dirname(statePath), 'cleanup.json'), JSON.stringify({status:'PASS',removed:state.databases},null,2)+'\n');
}
module.exports = {root, statePath, contract, identifier, literal, guard, locate, readState, writeState};
if (require.main === module) {
  try {
    const command=process.argv[2];
    if (command==='locate') console.log(locate());
    else if(command==='capture') capture();
    else if(command==='cleanup') cleanup();
    else throw new Error('Expected locate, capture or cleanup');
  } catch(error) { console.error(error); process.exitCode=1; }
}
