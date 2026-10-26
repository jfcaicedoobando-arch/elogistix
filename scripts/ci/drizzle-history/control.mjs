/** Read-only verification/listing of test-only history; never connects to a DB. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const DIR = 'scripts/ci/drizzle-history';
const COMMIT = 'ec96cf2e4bbb4443be463f1496da0189df2d1bef';
const ARCHIVE = `archive/${COMMIT}`;
// Explicit historical order: the archived idx 22 predates the current idx 22.
export const HISTORY = [
  { file: '0021_refacturar_proforma_rpc.sql', sha256: '8f5c299f5c593fe398e620056d8a2971a9f9ed4e90940310df173023fa9572e5', eligibleName: '20261026184800_replay_refacturar_proforma_rpc.sql' },
  { file: `${ARCHIVE}/0022_refacturar_proforma_abre_edicion.sql`, sha256: '8b4272fdc0abdbbbedac41c46e28694f611a59c240e0509bdf02ec2f8b9446fa' },
  { file: '0022_cotizacion_comercial.sql', sha256: '5cc034df0035d1f9b1722aa9bfad12ff68965bde22273500f55903bf9b60ed38', eligibleName: '20261026184900_replay_cotizacion_comercial.sql' },
  { file: '0023_margen_minimo_utilidad_rpc.sql', sha256: 'b106eb27b920f2d34825e9141a46d2ed51943c4ccad69cca8c2f970d2348c86a', eligibleName: '20261026185000_replay_margen_minimo_utilidad_rpc.sql' },
];
const ARCHIVED_METADATA = [
  [`${ARCHIVE}/meta/0022_snapshot.json`, '002a1cff39197fe3431f23193a4229e1c845cbcd0ab5eaa074efded812b0081d'],
  [`${ARCHIVE}/meta/_journal.json`, '10745ad2cc8bcbf4a6559dda414296966a372ca162fbd6e1ac3d6b382eb96288'],
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function pinned(root, file, expected) {
  const bytes = fs.readFileSync(path.join(root, DIR, file));
  if (hash(bytes) !== expected) throw new Error(`Isolated history hash mismatch: ${file}`);
  return bytes.toString('utf8');
}

function rejectEligibleCopies(root) {
  const forbidden = new Set(HISTORY.map(item => item.sha256));
  const dir = path.join(root, 'supabase/migrations');
  for (const file of fs.readdirSync(dir).filter(file => file.endsWith('.sql'))) {
    if (forbidden.has(hash(fs.readFileSync(path.join(dir, file))))) {
      throw new Error(`Test-only replay must not be deployment-eligible: ${file}`);
    }
  }
}

/** Returns only the current journal sources; recovered history is verified too. */
export function readIsolatedDrizzleReplay(root = process.cwd()) {
  const mapping = JSON.parse(fs.readFileSync(path.join(root, 'drizzle/replay.json'), 'utf8'));
  rejectEligibleCopies(root);
  const out = new Map();
  for (const item of HISTORY) {
    const sql = pinned(root, item.file, item.sha256);
    if (!item.eligibleName) continue;
    const source = fs.readFileSync(path.join(root, 'drizzle/migrations', item.file));
    if (hash(source) !== item.sha256) throw new Error(`Immutable source changed: ${item.file}`);
    if (fs.existsSync(path.join(root, 'supabase/migrations', item.eligibleName))) {
      throw new Error(`Test-only replay must not be deployment-eligible: ${item.eligibleName}`);
    }
    const entries = mapping.filter(entry => entry.file === item.file);
    if (entries.length !== 1 || entries[0].scope !== 'isolated-ci'
      || entries[0].sha256 !== item.sha256 || entries[0].composition
      || JSON.stringify(entries[0].replays) !== JSON.stringify([item.file])) {
      throw new Error(`Isolated history mapping mismatch: ${item.file}`);
    }
    out.set(item.file, sql);
  }
  if (mapping.filter(entry => entry.scope === 'isolated-ci').length !== out.size) {
    throw new Error('Unreviewed isolated history mapping');
  }
  for (const [file, expected] of ARCHIVED_METADATA) pinned(root, file, expected);
  return out;
}

export function listIsolatedHistory(root = process.cwd()) {
  readIsolatedDrizzleReplay(root);
  return HISTORY.map(item => `${DIR}/${item.file}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv[2] !== 'list') throw new Error('Usage: node control.mjs list');
  console.log(listIsolatedHistory().join('\n'));
}
